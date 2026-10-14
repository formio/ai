import fs from 'fs';
import path from 'path';
import os from 'os';
import { BLOCKING_SLEEP, errorCode, fingerprintOf, sameFingerprint, updateFileLocked, writeFileAtomically, } from './atomic-file.js';
import { projectCommand } from './cli-launch.js';
import { readHttpUrlEnv } from './config.js';
import { ToolError } from './tool-errors.js';
const DEFAULT_CACHE_DIR = path.join(os.homedir(), '.formio');
const PROJECTS_FILE = 'projects.json';
// A map that exists but cannot be read is not an empty map. Reporting it as one
// made every directory look unmapped, and the documented recovery — interview,
// then project_set — wrote a fresh single-entry file over every other mapping.
// Callers get a distinguishable failure so the file survives for repair.
export class ProjectMapUnreadableError extends ToolError {
    /** The file and cause, so a caller on a path with a DIFFERENT remedy can say its own. */
    filePath;
    reason;
    // The remedy names BOTH vocabularies, for the same reason the unset-project error
    // does: this string reaches an agent holding MCP tools AND a shell reader running
    // `project get` — which is what formio-mcp-setup runs, before any tool exists to
    // call.
    //
    // `scope` decides whether a human has to act first, and the two answers are genuinely
    // different. Damage to the FILE — unparseable, or not a map at all — stops every
    // writer too, so the command below cannot run until somebody repairs or removes it.
    // Damage to ONE ENTRY does not: a writer replaces that entry in place, and telling
    // the reader to delete the file would destroy every other directory's mapping to fix
    // one. Saying "repair first" for both sent readers to do exactly that.
    //
    // A held LOCK is a third answer. The map itself is intact; what stops the write is a
    // lock file another writer holds — a running process on this host is never broken —
    // or one a writer on another host left behind that this waiter has not yet seen
    // unchanged for long enough. Deleting the lock is the remedy only when no other writer is
    // running, so the message says exactly that and names the write to retry.
    constructor({ filePath, cause, cwd, scope = 'file' }) {
        const remap = cwd
            ? `map ${cwd} again: call project_set with cwd set to it, or run: ${projectCommand(`set --project-url <project_url> --cwd ${cwd}`)}`
            : `map the directory again with project_set, or run: ${projectCommand('set --project-url <project_url> --cwd <absolute path>')}`;
        const how = scope === 'entry'
            ? `Only this directory's entry is affected and the rest of the file is intact, so do NOT delete it — that would discard every other directory's mapping. Replace the entry instead: ${remap}.`
            : scope === 'lock'
                ? `The map itself is intact. Retry the write; if it keeps failing and no other Form.io MCP server or \`project set\` is running, delete that lock file, then ${remap}.`
                : `Repair or delete that file FIRST — no command can write it while it cannot be read, so nothing below will run until it is. Then ${remap}.`;
        const reason = cause instanceof Error ? cause.message : String(cause);
        super({
            code: 'CONFIG_UNREADABLE',
            message: scope === 'lock'
                ? `Cannot take the Form.io project map's lock file ${filePath}: ${reason}. ` + how
                : `Cannot read the Form.io project map at ${filePath}: ${reason}. ` + how,
        });
        this.name = 'ProjectMapUnreadableError';
        this.filePath = filePath;
        this.reason = reason;
    }
}
function describe(value) {
    if (value === null) {
        return 'null';
    }
    return Array.isArray(value) ? 'an array' : `a ${typeof value}`;
}
// Exported so a caller that rejects an entry's CONTENTS can name the same file
// this module names. The URL-shape rules live in the resolver rather than here,
// and deliberately not in writeProjectEntry either: replacing an entry is the
// documented repair for a mapping holding an unusable URL, so validating the entry
// being replaced would fail the one write that fixes it (see writeProjectEntry).
export function projectMapPath(cacheDir = DEFAULT_CACHE_DIR) {
    return path.join(cacheDir, PROJECTS_FILE);
}
// The path rules of the platform being asked about, which tests set to another one.
const pathFor = (platform) => platform === 'win32' ? path.win32 : path.posix;
// Platforms whose default filesystems compare names case-insensitively.
const CASE_FOLDING = new Set(['darwin', 'win32']);
// A Git-Bash or MSYS spelling of a drive, `/c/...`, which Windows itself reads as a
// folder named `c` on the current drive.
const DRIVE_PREFIX = /^\/([a-zA-Z])(?=\/|$)/;
// The real path of the deepest part that exists, with the rest appended as spelled, so
// a directory not created yet still compares equal under its real parent. Asked only
// of paths in this host's own flavour: a simulated platform's path names nothing here.
function realpathOfExisting(dir, rules) {
    if (rules !== path) {
        return { path: dir, exists: false };
    }
    try {
        return { path: fs.realpathSync.native(dir), exists: true };
    }
    catch {
        const parent = rules.dirname(dir);
        return parent === dir
            ? { path: dir, exists: false }
            : {
                path: rules.join(realpathOfExisting(parent, rules).path, rules.basename(dir)),
                exists: false,
            };
    }
}
function canonicalOf(dir, platform) {
    const rules = pathFor(platform);
    const spelled = platform === 'win32'
        ? dir.replace(DRIVE_PREFIX, (_, drive) => `${drive.toUpperCase()}:\\`)
        : dir;
    return realpathOfExisting(rules.resolve(spelled), rules);
}
/**
 * A directory's canonical path, in its true case: what the map stores as a key, what
 * messages show, and what directories are compared by.
 *
 * On Windows a `/c/...` path is read as `C:\...`. The path is resolved, and the real
 * path of its existing part is taken: symbolic links are followed (`/tmp` and
 * `/private/tmp` are one directory on macOS), and on a case-insensitive volume the
 * case the filesystem stores is returned, so `c:\users\me` that exists as
 * `C:\Users\Me` is spelled the second way. A part that does not exist keeps the case
 * it was given.
 *
 * `platform` is the platform whose rules apply; the running one unless a test simulates
 * another.
 */
export function canonicalDir(dir, platform = process.platform) {
    return canonicalOf(dir, platform).path;
}
const folds = (platform) => CASE_FOLDING.has(platform);
// Where a stored key is filed, and under which comparison value.
function placement(dir, platform) {
    const { path: canonical, exists } = canonicalOf(dir, platform);
    return !exists && folds(platform)
        ? { table: 'folded', key: canonical.toLowerCase(), canonical: dir === canonical }
        : { table: 'exact', key: canonical, canonical: dir === canonical };
}
function indexMap(map, platform) {
    const tables = { exact: new Map(), folded: new Map() };
    const canonicalHeld = new Set();
    Object.entries(map).forEach(([dir, value]) => {
        const { table, key, canonical } = placement(dir, platform);
        const slot = `${table}\0${key}`;
        if (canonicalHeld.has(slot) && !canonical) {
            return;
        }
        if (canonical) {
            canonicalHeld.add(slot);
        }
        tables[table].set(key, { dir, value });
    });
    return tables;
}
// The entry recorded for exactly this canonical directory, if any.
const entryAt = (index, dir, platform) => index.exact.get(dir) ?? (folds(platform) ? index.folded.get(dir.toLowerCase()) : undefined);
// Whether a directory is the root of a repository: the boundary of the mapping walk,
// as it is of the committed formio.json walk.
const isRepositoryRoot = (dir, rules) => rules === path && fs.existsSync(path.join(dir, '.git'));
/**
 * The entry for the nearest directory, `cwd` itself or an ancestor, that has one.
 *
 * The walk stops at the first directory, the start included, that contains `.git` — the
 * boundary the committed-file walk uses — so a mapping recorded above a repository does
 * not reach into it. Without any `.git` it runs to the filesystem root.
 */
function nearestEntry({ index, cwd, platform }) {
    const rules = pathFor(platform);
    const walk = (dir, depth) => {
        const found = entryAt(index, dir, platform);
        if (found) {
            return { ...found, inherited: depth > 0 };
        }
        const parent = rules.dirname(dir);
        return isRepositoryRoot(dir, rules) || parent === dir ? undefined : walk(parent, depth + 1);
    };
    return walk(canonicalDir(cwd, platform), 0);
}
function readMap(cacheDir, cwd) {
    const filePath = projectMapPath(cacheDir);
    let raw;
    try {
        raw = fs.readFileSync(filePath, 'utf-8');
    }
    catch (error) {
        // No file yet is the ordinary first-run state; anything else (a permission
        // error, an unreadable device) is a real failure and must not read as empty.
        if (errorCode(error) === 'ENOENT') {
            return {};
        }
        throw new ProjectMapUnreadableError({ filePath, cause: error, cwd });
    }
    let parsed;
    try {
        parsed = JSON.parse(raw);
    }
    catch (error) {
        throw new ProjectMapUnreadableError({ filePath, cause: error, cwd });
    }
    // Valid JSON of the wrong shape is unreadable for the same reason a syntax
    // error is: nothing can be keyed off it. `null` would throw a bare TypeError
    // that callers catching only this error swallow into "no project configured",
    // and an array or a scalar reads as unmapped and is then written over.
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        throw new ProjectMapUnreadableError({
            filePath,
            cause: new Error(`expected an object mapping directories to entries, found ${describe(parsed)}`),
            cwd,
        });
    }
    return parsed;
}
// One snapshot per map file. Readers — every tool call resolves its project — reuse the
// parsed map and the canonical path of every stored key until the file changes, which
// every write does by renaming a new file into place.
const snapshots = new Map();
/**
 * The map and its index, for a READER. Stat'd before it is read, so a write landing
 * between the two leaves a fingerprint older than the contents and the next call reads
 * again. A file that cannot even be stat'd is read directly, so its failure is the one
 * reported. A write never uses this: under the lock it reads the file afresh.
 */
function readIndexedMap({ cacheDir, cwd, platform }) {
    const filePath = projectMapPath(cacheDir);
    const fingerprint = fingerprintOf(filePath);
    if (fingerprint === undefined) {
        return indexMap(readMap(cacheDir, cwd), platform);
    }
    const held = snapshots.get(filePath);
    const snapshot = held && sameFingerprint(held.fingerprint, fingerprint)
        ? held
        : {
            fingerprint,
            map: fingerprint === 'missing' ? {} : readMap(cacheDir, cwd),
            indexes: new Map(),
        };
    snapshots.set(filePath, snapshot);
    const index = snapshot.indexes.get(platform) ?? indexMap(snapshot.map, platform);
    snapshot.indexes.set(platform, index);
    return index;
}
function writeMap(cacheDir, data) {
    const filePath = projectMapPath(cacheDir);
    try {
        writeFileAtomically({ filePath, contents: JSON.stringify(data) });
    }
    catch (error) {
        throw new Error(`Cannot write the Form.io project map at ${filePath}: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
    }
}
function updateMap({ cacheDir, cwd, lock, change, sleep, }) {
    return updateFileLocked({
        filePath: projectMapPath(cacheDir),
        read: () => readMap(cacheDir, cwd),
        update: (current) => {
            const { map, result } = change(current);
            return { next: map, result };
        },
        write: (next) => writeMap(cacheDir, next),
        lockFailure: ({ lockPath, cause }) => new ProjectMapUnreadableError({ filePath: lockPath, cause, cwd, scope: 'lock' }),
        lock,
        sleep,
    });
}
// Per entry, not per file. The top-level shape check above says the file is a
// map; it says nothing about what a directory maps to, and every caller then
// reaches straight for `entry.env.FORMIO_BASE_URL`. A hand-edited entry that is a
// string, or an object with no `env`, used to surface as a bare TypeError
// reported as a generic failure — the exact outcome ProjectMapUnreadableError
// replaced for the file as a whole. Checked lazily, for the one directory being
// asked about: the map is shared, so a malformed entry for someone else's
// workspace must not fail this one's lookup.
function validateEntry(cacheDir, cwd, value) {
    const invalid = (reason) => {
        throw new ProjectMapUnreadableError({
            filePath: projectMapPath(cacheDir),
            cause: new Error(`the entry for ${cwd} ${reason}`),
            cwd,
            scope: 'entry',
        });
    };
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return invalid(`should be an object with an env block, found ${describe(value)}`);
    }
    const { env } = value;
    if (typeof env !== 'object' || env === null || Array.isArray(env)) {
        return invalid(`has no usable env block: found ${describe(env)}`);
    }
    const nonString = Object.entries(env).filter(([, item]) => typeof item !== 'string');
    if (nonString.length > 0) {
        return invalid(`has non-string environment values: ${nonString.map(([name, item]) => `${name} is ${describe(item)}`).join(', ')}`);
    }
    // A non-boolean here decides whether the domain rules are skipped for this pair, so
    // it is not a field to coerce: `"false"` is truthy, and reading it as an override
    // would silently accept a pair nobody forced.
    const { forced } = value;
    if (forced !== undefined && typeof forced !== 'boolean') {
        return invalid(`has a non-boolean \`forced\` flag: found ${describe(forced)}`);
    }
    return value;
}
/**
 * How a failure names the directory asked about: resolved, so `/repo` and `/repo/`
 * print alike, but otherwise as the caller spelled it.
 */
const spelledDir = (cwd, platform) => pathFor(platform).resolve(cwd);
/**
 * The mapping that applies to a directory: the entry for the nearest directory —
 * itself or an ancestor — that has one, compared by canonical path. A malformed entry
 * there fails loudly, naming the directory it is recorded for; it is the record that
 * governs, so a weaker one must not answer in its place.
 */
export function findProjectEntry({ cwd, cacheDir = DEFAULT_CACHE_DIR, platform = process.platform, }) {
    const found = nearestEntry({
        index: readIndexedMap({ cacheDir, cwd: spelledDir(cwd, platform), platform }),
        cwd,
        platform,
    });
    return found ? { dir: found.dir, entry: validateEntry(cacheDir, found.dir, found.value) } : null;
}
export function readProjectEntry(cwd, cacheDir = DEFAULT_CACHE_DIR) {
    return findProjectEntry({ cwd, cacheDir })?.entry ?? null;
}
export function readProjectEntryForWrite(cwd, cacheDir = DEFAULT_CACHE_DIR) {
    const platform = process.platform;
    const found = nearestEntry({
        index: readIndexedMap({ cacheDir, cwd: spelledDir(cwd, platform), platform }),
        cwd,
        platform,
    });
    if (found === undefined) {
        return { status: 'absent' };
    }
    const { dir, inherited } = found;
    try {
        return { status: 'usable', dir, inherited, entry: validateEntry(cacheDir, dir, found.value) };
    }
    catch (error) {
        return {
            status: 'unusable',
            dir,
            inherited,
            reason: error instanceof Error ? error.message : String(error),
        };
    }
}
/**
 * Why the mapping that governs a directory cannot answer with a project, or undefined
 * if it can.
 *
 * Structural damage is caught by validateEntry above; a value that is simply not an
 * http(s) URL is not, because a record's URLs are validated only where that record wins
 * precedence. Both are "present and unusable" to a writer, and both must stop it
 * concluding that some other record holds the project.
 */
export function unusableRecordProjectUrl(mapped) {
    if (mapped.status === 'unusable') {
        return mapped.reason;
    }
    if (mapped.status === 'absent') {
        return undefined;
    }
    const raw = mapped.entry.env.FORMIO_PROJECT_URL;
    if (raw === undefined) {
        return undefined;
    }
    let reason;
    // Named for where the value LIVES. `readHttpUrlEnv` builds its message around the name
    // it is given, and passing the variable's name for a value read out of the mapping
    // file produced "Ignoring FORMIO_PROJECT_URL: …" about a record on disk — sending a
    // caller to hunt for an environment variable that need not exist, and calling the
    // value ignored when it is the reason the call is being refused. In this repository a
    // FORMIO_* name means the environment variable and nothing else.
    readHttpUrlEnv({
        raw,
        name: `the project URL recorded for ${mapped.dir}`,
        onIgnored: (message) => (reason = message),
    });
    // The recorded value is quoted back VERBATIM. This entry is the only place it exists,
    // the repair replaces it, and a caller told only that the scheme is wrong cannot give
    // the user back the project they had been targeting.
    return reason === undefined ? undefined : `${reason} The recorded value is ${raw}.`;
}
/**
 * Clear one directory's entry, and report what it held.
 *
 * The one operation that takes a record OUT. It exists because a pair recorded with
 * `project set --force` is preserved by any write that leaves both halves untouched —
 * re-recording it without the flag reports "no change" and keeps the override — so
 * something has to be able to say "forget this directory", after which the ordinary
 * rules judge whatever is recorded next. Returns the entry that was removed, or
 * undefined when there was nothing to remove, so a caller can name the value it
 * discarded rather than clearing it silently.
 *
 * Reads the file under the map's lock, for the same reason writeProjectEntry does: the
 * map is shared by every directory on this machine, so a stale snapshot written back
 * drops another process's mapping.
 */
export function removeProjectEntry({ cwd, cacheDir = DEFAULT_CACHE_DIR, platform = process.platform, lock, }) {
    // This directory's own entry, under whatever spelling it was recorded — never an
    // ancestor's, which belongs to every other directory beneath it.
    const dir = canonicalDir(cwd, platform);
    return updateMap({
        cacheDir,
        cwd: spelledDir(cwd, platform),
        lock,
        // `project set --reset` is the only caller, and the CLI is synchronous.
        sleep: BLOCKING_SLEEP,
        change: (map) => {
            const existing = entryAt(indexMap(map, platform), dir, platform);
            if (existing === undefined) {
                return { result: undefined };
            }
            // Reported as it was on disk, unvalidated: the caller is being told what was
            // discarded, and a malformed entry is exactly the kind this clears. Validating it
            // would fail the one operation that removes it.
            return {
                map: withoutDirectory({ map, dir, platform }),
                result: existing.value,
            };
        },
    });
}
// Every entry recorded for one directory, whatever spelling it was recorded under, so
// a write never leaves a twin beside the key it writes. Compared as lookups compare:
// by real path, with case folded only for a stored key whose directory is gone.
const withoutDirectory = ({ map, dir, platform }) => Object.fromEntries(Object.entries(map).filter(([stored]) => {
    const { table, key } = placement(stored, platform);
    return key !== (table === 'folded' ? dir.toLowerCase() : dir);
}));
export function writeProjectEntry({ cwd, env, forced = false, cacheDir = DEFAULT_CACHE_DIR, platform = process.platform, lock, sleep = BLOCKING_SLEEP, }) {
    // Stored under the canonical path of the directory it was given, in its true case —
    // its own entry, even beneath a mapped ancestor — replacing any other spelling of
    // that directory.
    const key = canonicalDir(cwd, platform);
    // Re-read under the lock rather than take a map the caller already read. The file is
    // SHARED — every directory on this machine is a key in it — so a snapshot read
    // before the lock and written back silently drops another process's mapping.
    //
    // This directory's own entry is NOT validated first. It is what the write replaces,
    // and a malformed one holds nothing worth preserving — validating it made the repair
    // this error names impossible to perform, which is the whole reason entry-level damage
    // is reported differently from damage to the file. The FILE is still validated by
    // the read under the lock, because a write that cannot read it would destroy every other
    // directory's mapping; those entries travel through verbatim.
    // The flag is written only when it is true, so an ordinary entry keeps the shape it
    // has always had: this file is read by hand and diffed in bug reports, and a
    // `"forced": false` on every entry advertises an override nobody asked for.
    return updateMap({
        cacheDir,
        cwd: spelledDir(cwd, platform),
        lock,
        sleep,
        change: (map) => ({
            map: {
                ...withoutDirectory({ map, dir: key, platform }),
                [key]: { env, ...(forced ? { forced: true } : {}) },
            },
            result: undefined,
        }),
    });
}
