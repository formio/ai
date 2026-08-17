import fs from 'fs';
import path from 'path';
import os from 'os';

const DEFAULT_CACHE_DIR = path.join(os.homedir(), '.formio');
const PROJECTS_FILE = 'projects.json';

export interface ProjectEntry {
  env: Record<string, string>;
}

type ProjectMap = Record<string, ProjectEntry>;

// A map that exists but cannot be read is not an empty map. Reporting it as one
// made every directory look unmapped, and the documented recovery — interview,
// then project_set — wrote a fresh single-entry file over every other mapping.
// Callers get a distinguishable failure so the file survives for repair.
export class ProjectMapUnreadableError extends Error {
  constructor(filePath: string, cause: unknown) {
    super(
      `Cannot read the Form.io project map at ${filePath}: ${cause instanceof Error ? cause.message : String(cause)}. ` +
        `Repair or delete the file, then map this directory again with project_set.`
    );
    this.name = 'ProjectMapUnreadableError';
  }
}

function describe(value: unknown): string {
  if (value === null) {
    return 'null';
  }
  return Array.isArray(value) ? 'an array' : `a ${typeof value}`;
}

// Exported so a caller that rejects an entry's CONTENTS can name the same file
// this module names. The URL-shape rules live in the resolver rather than here:
// writeProjectEntry validates the entry it is about to overwrite, and that
// rewrite is the documented repair for a mapping holding an unusable URL — so a
// check that fails the read must not also fail the fix.
export function projectMapPath(cacheDir: string = DEFAULT_CACHE_DIR): string {
  return path.join(cacheDir, PROJECTS_FILE);
}

function readMap(cacheDir: string): ProjectMap {
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
    throw new ProjectMapUnreadableError(filePath, error);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new ProjectMapUnreadableError(filePath, error);
  }
  // Valid JSON of the wrong shape is unreadable for the same reason a syntax
  // error is: nothing can be keyed off it. `null` would throw a bare TypeError
  // that callers catching only this error swallow into "no project configured",
  // and an array or a scalar reads as unmapped and is then written over.
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new ProjectMapUnreadableError(
      filePath,
      new Error(`expected an object mapping directories to entries, found ${describe(parsed)}`)
    );
  }
  return parsed as ProjectMap;
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
      new Error(`the entry for ${cwd} ${reason}`)
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

export function readProjectEntry(
  cwd: string,
  cacheDir: string = DEFAULT_CACHE_DIR
): ProjectEntry | null {
  const map = readMap(cacheDir);
  const entry: unknown = map[cwd];
  return entry === undefined ? null : validateEntry(cacheDir, cwd, entry);
}

export function writeProjectEntry(
  cwd: string,
  env: Record<string, string>,
  cacheDir: string = DEFAULT_CACHE_DIR
): void {
  const map = readMap(cacheDir);
  // Validated before the rewrite for the same reason the file is: a write is how
  // the surviving mappings get destroyed, and an entry nobody can read is one
  // the user may still want back. Only this directory's entry is checked —
  // mapping /a must not be blocked by whatever /b holds, and /b travels through
  // verbatim.
  if (map[cwd] !== undefined) {
    validateEntry(cacheDir, cwd, map[cwd]);
  }
  map[cwd] = { env };
  writeMap(cacheDir, map);
}
