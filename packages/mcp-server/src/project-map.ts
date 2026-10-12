import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  BLOCKING_SLEEP,
  BlockingSleep,
  FingerprintState,
  LockOptions,
  SleepStrategy,
  TimerSleep,
  errorCode,
  fingerprintOf,
  sameFingerprint,
  updateFileLocked,
  writeFileAtomically,
} from './atomic-file.js';
import { projectCommand } from './cli-launch.js';
import { readHttpUrlEnv } from './config.js';
import { ToolError } from './tool-errors.js';

const DEFAULT_CACHE_DIR = path.join(os.homedir(), '.formio');
const PROJECTS_FILE = 'projects.json';

// A record holds a project and its deployment as a pair, so an entry is just the two
// values. The `baseUrlFor` field this interface used to carry existed only because a
// deployment could be stored without its project; it has no question left to answer.
export interface ProjectEntry {
  env: Record<string, string>;
  /**
   * The pair in `env` was recorded by `project set --force`, so the domain rules are
   * skipped for it wherever it is read.
   *
   * Stored beside the pair rather than as another `env` key: an FORMIO_* name in this
   * file means the environment variable of that name, and no variable forces anything —
   * the override is a developer at a shell, deliberately not a value a launch
   * configuration or an agent can supply. Absent means false; a forced entry always
   * holds both halves, because force licenses a pair and never half of one.
   */
  forced?: boolean;
}

type ProjectMap = Record<string, ProjectEntry>;

/** What a ProjectMapUnreadableError reports. */
export interface ProjectMapUnreadable {
  /** The map file, or its lock file when `scope` is `lock`. */
  filePath: string;
  cause: unknown;
  /** The directory the failing call was for, named by the remedy. */
  cwd?: string;
  /** What is damaged or held: the whole file, one entry, or the lock. */
  scope?: 'file' | 'entry' | 'lock';
}

// A map that exists but cannot be read is not an empty map. Reporting it as one
// made every directory look unmapped, and the documented recovery — interview,
// then project_set — wrote a fresh single-entry file over every other mapping.
// Callers get a distinguishable failure so the file survives for repair.
export class ProjectMapUnreadableError extends ToolError {
  /** The file and cause, so a caller on a path with a DIFFERENT remedy can say its own. */
  readonly filePath: string;
  readonly reason: string;

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
  constructor({ filePath, cause, cwd, scope = 'file' }: ProjectMapUnreadable) {
    const remap = cwd
      ? `map ${cwd} again: call project_set with cwd set to it, or run: ${projectCommand(`set --project-url <project_url> --cwd ${cwd}`)}`
      : `map the directory again with project_set, or run: ${projectCommand('set --project-url <project_url> --cwd <absolute path>')}`;
    const how =
      scope === 'entry'
        ? `Only this directory's entry is affected and the rest of the file is intact, so do NOT delete it — that would discard every other directory's mapping. Replace the entry instead: ${remap}.`
        : scope === 'lock'
          ? `The map itself is intact. Retry the write; if it keeps failing and no other Form.io MCP server or \`project set\` is running, delete that lock file, then ${remap}.`
          : `Repair or delete that file FIRST — no command can write it while it cannot be read, so nothing below will run until it is. Then ${remap}.`;
    const reason = cause instanceof Error ? cause.message : String(cause);
    super({
      code: 'CONFIG_UNREADABLE',
      message:
        scope === 'lock'
          ? `Cannot take the Form.io project map's lock file ${filePath}: ${reason}. ` + how
          : `Cannot read the Form.io project map at ${filePath}: ${reason}. ` + how,
    });
    this.name = 'ProjectMapUnreadableError';
    this.filePath = filePath;
    this.reason = reason;
  }
}

function describe(value: unknown): string {
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
export function projectMapPath(cacheDir: string = DEFAULT_CACHE_DIR): string {
  return path.join(cacheDir, PROJECTS_FILE);
}

type PlatformPath = typeof path.posix;

// The path rules of the platform being asked about, which tests set to another one.
const pathFor = (platform: NodeJS.Platform): PlatformPath =>
  platform === 'win32' ? path.win32 : path.posix;

// Platforms whose default filesystems compare names case-insensitively.
const CASE_FOLDING: ReadonlySet<NodeJS.Platform> = new Set<NodeJS.Platform>(['darwin', 'win32']);

// A Git-Bash or MSYS spelling of a drive, `/c/...`, which Windows itself reads as a
// folder named `c` on the current drive.
const DRIVE_PREFIX = /^\/([a-zA-Z])(?=\/|$)/;

/** A directory's canonical path, and whether the whole of it exists. */
interface Canonical {
  path: string;
  exists: boolean;
}

// The real path of the deepest part that exists, with the rest appended as spelled, so
// a directory not created yet still compares equal under its real parent. Asked only
// of paths in this host's own flavour: a simulated platform's path names nothing here.
function realpathOfExisting(dir: string, rules: PlatformPath): Canonical {
  if (rules !== path) {
    return { path: dir, exists: false };
  }
  try {
    return { path: fs.realpathSync.native(dir), exists: true };
  } catch {
    const parent = rules.dirname(dir);
    return parent === dir
      ? { path: dir, exists: false }
      : {
          path: rules.join(realpathOfExisting(parent, rules).path, rules.basename(dir)),
          exists: false,
        };
  }
}

function canonicalOf(dir: string, platform: NodeJS.Platform): Canonical {
  const rules = pathFor(platform);
  const spelled =
    platform === 'win32'
      ? dir.replace(DRIVE_PREFIX, (_, drive: string) => `${drive.toUpperCase()}:\\`)
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
export function canonicalDir(dir: string, platform: NodeJS.Platform = process.platform): string {
  return canonicalOf(dir, platform).path;
}

/** A stored entry, under the key it has on disk, unvalidated. */
interface StoredEntry {
  dir: string;
  value: unknown;
}

/** The entry that applies to a directory, and whether it is an ancestor's. */
interface NearestEntry extends StoredEntry {
  inherited: boolean;
}

/**
 * Every stored key by what it is compared by, computed as the map is read and never
 * written back: entries recorded by earlier releases, or by hand, match as they are.
 *
 * A key whose directory exists is compared by its real path, exactly. That is already
 * the case the filesystem stores on a case-insensitive volume, and on a case-sensitive
 * one it keeps `Foo` and `foo` the two directories they are. A key whose directory no
 * longer exists has no real path to ask for, so on macOS and Windows — whose default
 * volumes fold case — it is compared case-insensitively instead (`folded`).
 *
 * Two keys naming one directory (`/dir` and `/dir/`, or two spellings of one path) are
 * resolved in favour of the one already in canonical form — the one a write produced —
 * and otherwise the later one, which is the rule object-literal parsing applies to
 * duplicate keys.
 */
interface MapIndex {
  exact: ReadonlyMap<string, StoredEntry>;
  folded: ReadonlyMap<string, StoredEntry>;
}

const folds = (platform: NodeJS.Platform): boolean => CASE_FOLDING.has(platform);

// Where a stored key is filed, and under which comparison value.
function placement(
  dir: string,
  platform: NodeJS.Platform
): { table: keyof MapIndex; key: string; canonical: boolean } {
  const { path: canonical, exists } = canonicalOf(dir, platform);
  return !exists && folds(platform)
    ? { table: 'folded', key: canonical.toLowerCase(), canonical: dir === canonical }
    : { table: 'exact', key: canonical, canonical: dir === canonical };
}

function indexMap(map: ProjectMap, platform: NodeJS.Platform): MapIndex {
  const tables = { exact: new Map<string, StoredEntry>(), folded: new Map<string, StoredEntry>() };
  const canonicalHeld = new Set<string>();
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
const entryAt = (
  index: MapIndex,
  dir: string,
  platform: NodeJS.Platform
): StoredEntry | undefined =>
  index.exact.get(dir) ?? (folds(platform) ? index.folded.get(dir.toLowerCase()) : undefined);

// Whether a directory is the root of a repository: the boundary of the mapping walk,
// as it is of the committed formio.json walk.
const isRepositoryRoot = (dir: string, rules: PlatformPath): boolean =>
  rules === path && fs.existsSync(path.join(dir, '.git'));

interface NearestEntryRequest {
  index: MapIndex;
  cwd: string;
  platform: NodeJS.Platform;
}

/**
 * The entry for the nearest directory, `cwd` itself or an ancestor, that has one.
 *
 * The walk stops at the first directory, the start included, that contains `.git` — the
 * boundary the committed-file walk uses — so a mapping recorded above a repository does
 * not reach into it. Without any `.git` it runs to the filesystem root.
 */
function nearestEntry({ index, cwd, platform }: NearestEntryRequest): NearestEntry | undefined {
  const rules = pathFor(platform);
  const walk = (dir: string, depth: number): NearestEntry | undefined => {
    const found = entryAt(index, dir, platform);
    if (found) {
      return { ...found, inherited: depth > 0 };
    }
    const parent = rules.dirname(dir);
    return isRepositoryRoot(dir, rules) || parent === dir ? undefined : walk(parent, depth + 1);
  };
  return walk(canonicalDir(cwd, platform), 0);
}

function readMap(cacheDir: string, cwd: string): ProjectMap {
  const filePath = projectMapPath(cacheDir);
  let raw: string;
  try {
    raw = fs.readFileSync(filePath, 'utf-8');
  } catch (error) {
    // No file yet is the ordinary first-run state; anything else (a permission
    // error, an unreadable device) is a real failure and must not read as empty.
    if (errorCode(error) === 'ENOENT') {
      return {};
    }
    throw new ProjectMapUnreadableError({ filePath, cause: error, cwd });
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new ProjectMapUnreadableError({ filePath, cause: error, cwd });
  }
  // Valid JSON of the wrong shape is unreadable for the same reason a syntax
  // error is: nothing can be keyed off it. `null` would throw a bare TypeError
  // that callers catching only this error swallow into "no project configured",
  // and an array or a scalar reads as unmapped and is then written over.
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new ProjectMapUnreadableError({
      filePath,
      cause: new Error(
        `expected an object mapping directories to entries, found ${describe(parsed)}`
      ),
      cwd,
    });
  }
  return parsed as ProjectMap;
}

/** The map as last read, with its comparison index per platform asked about. */
interface MapSnapshot {
  fingerprint: FingerprintState;
  map: ProjectMap;
  indexes: Map<NodeJS.Platform, MapIndex>;
}

// One snapshot per map file. Readers — every tool call resolves its project — reuse the
// parsed map and the canonical path of every stored key until the file changes, which
// every write does by renaming a new file into place.
const snapshots = new Map<string, MapSnapshot>();

interface IndexedMapRequest {
  cacheDir: string;
  cwd: string;
  platform: NodeJS.Platform;
}

/**
 * The map and its index, for a READER. Stat'd before it is read, so a write landing
 * between the two leaves a fingerprint older than the contents and the next call reads
 * again. A file that cannot even be stat'd is read directly, so its failure is the one
 * reported. A write never uses this: under the lock it reads the file afresh.
 */
function readIndexedMap({ cacheDir, cwd, platform }: IndexedMapRequest): MapIndex {
  const filePath = projectMapPath(cacheDir);
  const fingerprint = fingerprintOf(filePath);
  if (fingerprint === undefined) {
    return indexMap(readMap(cacheDir, cwd), platform);
  }
  const held = snapshots.get(filePath);
  const snapshot =
    held && sameFingerprint(held.fingerprint, fingerprint)
      ? held
      : {
          fingerprint,
          map: fingerprint === 'missing' ? {} : readMap(cacheDir, cwd),
          indexes: new Map<NodeJS.Platform, MapIndex>(),
        };
  snapshots.set(filePath, snapshot);
  const index = snapshot.indexes.get(platform) ?? indexMap(snapshot.map, platform);
  snapshot.indexes.set(platform, index);
  return index;
}

function writeMap(cacheDir: string, data: ProjectMap): void {
  const filePath = projectMapPath(cacheDir);
  try {
    writeFileAtomically({ filePath, contents: JSON.stringify(data) });
  } catch (error) {
    throw new Error(
      `Cannot write the Form.io project map at ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error }
    );
  }
}

interface MapUpdate<T> {
  cacheDir: string;
  /** The directory the write is for, named by any failure's remedy. */
  cwd: string;
  lock?: LockOptions;
  /** The change, applied to the map as it is on disk under the lock. */
  change: (map: ProjectMap) => { map?: ProjectMap; result: T };
}

/**
 * The one read-modify-write, through the shared locked update (see updateFileLocked).
 * Under the lock the map is read afresh — never a snapshot taken before the lock, nor the
 * readers' cached one — so another process's entry written meanwhile is kept; the
 * change is applied; and the result replaces the file in one rename. `map` absent means
 * nothing changed and nothing is written.
 *
 * `sleep` is how a wait for the lock passes: blocking for `project set`, which is
 * synchronous throughout, and on a timer for the MCP server's tools.
 */
function updateMap<T>(request: MapUpdate<T> & { sleep: BlockingSleep }): T;
function updateMap<T>(request: MapUpdate<T> & { sleep: SleepStrategy }): T | Promise<T>;
function updateMap<T>({
  cacheDir,
  cwd,
  lock,
  change,
  sleep,
}: MapUpdate<T> & { sleep: SleepStrategy }): T | Promise<T> {
  return updateFileLocked({
    filePath: projectMapPath(cacheDir),
    read: () => readMap(cacheDir, cwd),
    update: (current: ProjectMap) => {
      const { map, result } = change(current);
      return { next: map, result };
    },
    write: (next: ProjectMap) => writeMap(cacheDir, next),
    lockFailure: ({ lockPath, cause }) =>
      new ProjectMapUnreadableError({ filePath: lockPath, cause, cwd, scope: 'lock' }),
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
function validateEntry(cacheDir: string, cwd: string, value: unknown): ProjectEntry {
  const invalid = (reason: string): never => {
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
  const { env } = value as { env?: unknown };
  if (typeof env !== 'object' || env === null || Array.isArray(env)) {
    return invalid(`has no usable env block: found ${describe(env)}`);
  }
  const nonString = Object.entries(env).filter(([, item]) => typeof item !== 'string');
  if (nonString.length > 0) {
    return invalid(
      `has non-string environment values: ${nonString.map(([name, item]) => `${name} is ${describe(item)}`).join(', ')}`
    );
  }
  // A non-boolean here decides whether the domain rules are skipped for this pair, so
  // it is not a field to coerce: `"false"` is truthy, and reading it as an override
  // would silently accept a pair nobody forced.
  const { forced } = value as { forced?: unknown };
  if (forced !== undefined && typeof forced !== 'boolean') {
    return invalid(`has a non-boolean \`forced\` flag: found ${describe(forced)}`);
  }
  return value as ProjectEntry;
}

/**
 * How a failure names the directory asked about: resolved, so `/repo` and `/repo/`
 * print alike, but otherwise as the caller spelled it.
 */
const spelledDir = (cwd: string, platform: NodeJS.Platform): string =>
  pathFor(platform).resolve(cwd);

export interface ProjectEntryLookup {
  cwd: string;
  cacheDir?: string;
  /** Whose path rules apply; the running platform unless a test simulates another. */
  platform?: NodeJS.Platform;
}

/** A mapping entry, and the directory it is recorded for as the map spells it. */
export interface FoundProjectEntry {
  dir: string;
  entry: ProjectEntry;
}

/**
 * The mapping that applies to a directory: the entry for the nearest directory —
 * itself or an ancestor — that has one, compared by canonical path. A malformed entry
 * there fails loudly, naming the directory it is recorded for; it is the record that
 * governs, so a weaker one must not answer in its place.
 */
export function findProjectEntry({
  cwd,
  cacheDir = DEFAULT_CACHE_DIR,
  platform = process.platform,
}: ProjectEntryLookup): FoundProjectEntry | null {
  const found = nearestEntry({
    index: readIndexedMap({ cacheDir, cwd: spelledDir(cwd, platform), platform }),
    cwd,
    platform,
  });
  return found ? { dir: found.dir, entry: validateEntry(cacheDir, found.dir, found.value) } : null;
}

export function readProjectEntry(
  cwd: string,
  cacheDir: string = DEFAULT_CACHE_DIR
): ProjectEntry | null {
  return findProjectEntry({ cwd, cacheDir })?.entry ?? null;
}

/**
 * What a WRITER sees: an entry that is usable, one that exists and is not, or none.
 *
 * A reader must fail loudly on a malformed entry — it is configuration that exists and
 * cannot be honoured. A writer is replacing that entry, so the same failure would block
 * the very repair its error message names. But "unusable" is NOT "absent", and
 * collapsing the two gave the writer a second model of precedence: with this directory's
 * own entry present and broken, the writer concluded the mapping held no project and
 * deferred to the environment, so the reader said "your record is broken, replace it"
 * and the writer said "your project comes from the environment" about one state. The
 * broken entry is still the record that governs this directory; what it cannot do is
 * answer with a value.
 *
 * File-level damage still throws for both: nothing can be written into a map that cannot
 * be parsed without discarding every other directory's mapping.
 *
 * The record is found as a reader finds it — the nearest mapped directory, this one or
 * an ancestor — because that is the record that governs. `dir` is the directory it is
 * recorded for, and `inherited` says it is an ancestor's: this directory has no entry
 * of its own, and a write for it records one.
 */
export type ProjectEntryForWrite =
  | { status: 'absent' }
  | { status: 'usable'; dir: string; inherited: boolean; entry: ProjectEntry }
  | { status: 'unusable'; dir: string; inherited: boolean; reason: string };

export function readProjectEntryForWrite(
  cwd: string,
  cacheDir: string = DEFAULT_CACHE_DIR
): ProjectEntryForWrite {
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
  } catch (error) {
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
export function unusableRecordProjectUrl(mapped: ProjectEntryForWrite): string | undefined {
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
  let reason: string | undefined;
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
export function removeProjectEntry({
  cwd,
  cacheDir = DEFAULT_CACHE_DIR,
  platform = process.platform,
  lock,
}: {
  cwd: string;
  cacheDir?: string;
  platform?: NodeJS.Platform;
  lock?: LockOptions;
}): ProjectEntry | undefined {
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
        result: existing.value as ProjectEntry,
      };
    },
  });
}

interface DirectoryRemoval {
  map: ProjectMap;
  /** The canonical path of the directory whose entries go, under every spelling. */
  dir: string;
  platform: NodeJS.Platform;
}

// Every entry recorded for one directory, whatever spelling it was recorded under, so
// a write never leaves a twin beside the key it writes. Compared as lookups compare:
// by real path, with case folded only for a stored key whose directory is gone.
const withoutDirectory = ({ map, dir, platform }: DirectoryRemoval): ProjectMap =>
  Object.fromEntries(
    Object.entries(map).filter(([stored]) => {
      const { table, key } = placement(stored, platform);
      return key !== (table === 'folded' ? dir.toLowerCase() : dir);
    })
  );

export interface ProjectEntryWrite {
  cwd: string;
  env: Record<string, string>;
  /** Whether this pair was forced past the domain rules. Written only when true. */
  forced?: boolean;
  cacheDir?: string;
  /** Whose path rules apply; the running platform unless a test simulates another. */
  platform?: NodeJS.Platform;
  lock?: LockOptions;
}

/**
 * Record a directory's own entry. `sleep` is how a wait for the map's lock passes: the
 * blocking default returns once written, for `project set`; TIMER_SLEEP returns a
 * promise and leaves the MCP server's event loop running while it waits.
 */
export function writeProjectEntry(request: ProjectEntryWrite & { sleep?: BlockingSleep }): void;
export function writeProjectEntry(
  request: ProjectEntryWrite & { sleep: TimerSleep }
): Promise<void>;
export function writeProjectEntry({
  cwd,
  env,
  forced = false,
  cacheDir = DEFAULT_CACHE_DIR,
  platform = process.platform,
  lock,
  sleep = BLOCKING_SLEEP,
}: ProjectEntryWrite & { sleep?: SleepStrategy }): void | Promise<void> {
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
