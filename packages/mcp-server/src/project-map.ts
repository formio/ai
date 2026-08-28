import fs from 'fs';
import path from 'path';
import os from 'os';
import { projectCommand } from './cli-launch.js';
import { readHttpUrlEnv } from './config.js';

const DEFAULT_CACHE_DIR = path.join(os.homedir(), '.formio');
const PROJECTS_FILE = 'projects.json';

// A record holds a project and its deployment as a pair, so an entry is just the two
// values. The `baseUrlFor` field this interface used to carry existed only because a
// deployment could be stored without its project; it has no question left to answer.
export interface ProjectEntry {
  env: Record<string, string>;
}

type ProjectMap = Record<string, ProjectEntry>;

// A map that exists but cannot be read is not an empty map. Reporting it as one
// made every directory look unmapped, and the documented recovery — interview,
// then project_set — wrote a fresh single-entry file over every other mapping.
// Callers get a distinguishable failure so the file survives for repair.
export class ProjectMapUnreadableError extends Error {
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
  constructor(filePath: string, cause: unknown, cwd?: string, scope: 'file' | 'entry' = 'file') {
    const remap = cwd
      ? `map ${cwd} again: call project_set with cwd set to it, or run: ${projectCommand(`set --project-url <project_url> --cwd ${cwd}`)}`
      : `map the directory again with project_set, or run: ${projectCommand('set --project-url <project_url> --cwd <absolute path>')}`;
    const how =
      scope === 'entry'
        ? `Only this directory's entry is affected and the rest of the file is intact, so do NOT delete it — that would discard every other directory's mapping. Replace the entry instead: ${remap}.`
        : `Repair or delete that file FIRST — no command can write it while it cannot be read, so nothing below will run until it is. Then ${remap}.`;
    const reason = cause instanceof Error ? cause.message : String(cause);
    super(`Cannot read the Form.io project map at ${filePath}: ${reason}. ` + how);
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

// `cwd` is carried only so the error can print the command that maps it again.
/**
 * Every key normalized as the file is loaded.
 *
 * Normalizing only the keys this release writes strands the ones earlier releases wrote
 * raw: a directory whose cwd carried a trailing slash keeps its visible entry and reports
 * that nothing is configured, and the next write lands on the normalized twin, leaving a
 * dead key beside a live one that nothing ever cleans up. Doing it on load makes the
 * migration invisible and idempotent — every key is an absolute directory path, so
 * resolving one that is already resolved changes nothing.
 *
 * A collision (both `/dir` and `/dir/` on disk) keeps the LAST one, which is the same
 * rule object-literal parsing already applied to duplicate keys in the file.
 */
function normalizeKeys(map: ProjectMap): ProjectMap {
  return Object.fromEntries(Object.entries(map).map(([key, entry]) => [mapKey(key), entry]));
}

function readMap(cacheDir: string, cwd: string): ProjectMap {
  const filePath = projectMapPath(cacheDir);
  let raw: string;
  try {
    raw = fs.readFileSync(filePath, 'utf-8');
  } catch (error) {
    // No file yet is the ordinary first-run state; anything else (a permission
    // error, an unreadable device) is a real failure and must not read as empty.
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return {};
    }
    throw new ProjectMapUnreadableError(filePath, error, cwd);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new ProjectMapUnreadableError(filePath, error, cwd);
  }
  // Valid JSON of the wrong shape is unreadable for the same reason a syntax
  // error is: nothing can be keyed off it. `null` would throw a bare TypeError
  // that callers catching only this error swallow into "no project configured",
  // and an array or a scalar reads as unmapped and is then written over.
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new ProjectMapUnreadableError(
      filePath,
      new Error(`expected an object mapping directories to entries, found ${describe(parsed)}`),
      cwd
    );
  }
  return normalizeKeys(parsed as ProjectMap);
}

function writeMap(cacheDir: string, data: ProjectMap): void {
  fs.mkdirSync(cacheDir, { recursive: true });
  fs.writeFileSync(projectMapPath(cacheDir), JSON.stringify(data), {
    mode: 0o600,
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
    throw new ProjectMapUnreadableError(
      projectMapPath(cacheDir),
      new Error(`the entry for ${cwd} ${reason}`),
      cwd,
      'entry'
    );
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
  return value as ProjectEntry;
}

/**
 * The key one directory has, whatever the caller spelled.
 *
 * The map is keyed by absolute path, and `/repo` and `/repo/` are the same folder — kept
 * raw they were two independent records, so configuring a directory through one spelling
 * left the other reporting nothing configured for the directory just configured, and a
 * caller whose cwd sometimes carries a slash silently maintained two. `findCommittedConfig`
 * resolves its path already, so only the mapping was exposed.
 */
function mapKey(cwd: string): string {
  return path.resolve(cwd);
}

export function readProjectEntry(
  cwd: string,
  cacheDir: string = DEFAULT_CACHE_DIR
): ProjectEntry | null {
  const key = mapKey(cwd);
  const map = readMap(cacheDir, key);
  const entry: unknown = map[key];
  return entry === undefined ? null : validateEntry(cacheDir, key, entry);
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
 */
export type ProjectEntryForWrite =
  | { status: 'absent' }
  | { status: 'usable'; entry: ProjectEntry }
  | { status: 'unusable'; reason: string };

export function readProjectEntryForWrite(
  cwd: string,
  cacheDir: string = DEFAULT_CACHE_DIR
): ProjectEntryForWrite {
  const key = mapKey(cwd);
  const map = readMap(cacheDir, key);
  const entry: unknown = map[key];
  if (entry === undefined) {
    return { status: 'absent' };
  }
  try {
    return { status: 'usable', entry: validateEntry(cacheDir, key, entry) };
  } catch (error) {
    return { status: 'unusable', reason: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Why this directory's own entry cannot answer with a project, or undefined if it can.
 *
 * Structural damage is caught by validateEntry above; a value that is simply not an
 * http(s) URL is not, because a record's URLs are validated only where that record wins
 * precedence. Both are "present and unusable" to a writer, and both must stop it
 * concluding that some other record holds the project.
 */
export function unusableRecordProjectUrl(
  mapped: ProjectEntryForWrite,
  cwd: string
): string | undefined {
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
    name: `the project URL recorded for ${cwd}`,
    onIgnored: (message) => (reason = message),
  });
  // The recorded value is quoted back VERBATIM. This entry is the only place it exists,
  // the repair replaces it, and a caller told only that the scheme is wrong cannot give
  // the user back the project they had been targeting.
  return reason === undefined ? undefined : `${reason} The recorded value is ${raw}.`;
}

export interface ProjectEntryWrite {
  cwd: string;
  env: Record<string, string>;
  cacheDir?: string;
}

export function writeProjectEntry({
  cwd,
  env,
  cacheDir = DEFAULT_CACHE_DIR,
}: ProjectEntryWrite): void {
  // The key everything else uses. Passed the raw cwd, an unreadable-map failure printed
  // a re-map command naming a directory spelled differently from the key the write
  // itself would have used.
  const key = mapKey(cwd);
  // Re-read rather than take a map the caller already read. The file is SHARED —
  // every directory on this machine is a key in it — so the window between the
  // caller's read and this write is a window in which another process's mapping can
  // be written and then silently dropped by writing back a stale snapshot. Reading
  // here makes that window as small as the runtime allows. The cost is one read of a
  // small file; the alternative trades it for lost entries nobody can attribute.
  const map = readMap(cacheDir, key);
  // This directory's own entry is NOT validated first. It is what the write replaces,
  // and a malformed one holds nothing worth preserving — validating it made the repair
  // this error names impossible to perform, which is the whole reason entry-level damage
  // is reported differently from damage to the file. The FILE is still validated by
  // readMap above, because a write that cannot read it would destroy every other
  // directory's mapping; those entries travel through verbatim.
  map[key] = { env };
  writeMap(cacheDir, map);
}
