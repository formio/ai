import fs from 'fs';
import path from 'path';
import os from 'os';
import { writeFileAtomically } from './atomic-file.js';
import { isRecord } from './tool-errors.js';

const DEFAULT_CACHE_DIR = path.join(os.homedir(), '.formio');
const CACHE_FILE = 'mcp-tokens.json';

/** The cache file's contents: one JWT per deployment, keyed by its base URL. */
export type TokenFile = Readonly<Record<string, unknown>>;

const cachePath = (cacheDir: string): string => path.join(cacheDir, CACHE_FILE);

const reason = (error: unknown): string => (error instanceof Error ? error.message : String(error));

const isMissing = (error: unknown): boolean =>
  error instanceof Error && (error as NodeJS.ErrnoException).code === 'ENOENT';

// The one reader. Undefined means the file does not exist, which is a cache holding no
// tokens; a file that exists and cannot be read or parsed throws, because it says
// nothing about any token — treating it as empty would discard tokens it may well hold.
function readCacheStrictly(filePath: string): TokenFile | undefined {
  let contents: string;
  try {
    contents = fs.readFileSync(filePath, 'utf-8');
  } catch (error) {
    if (isMissing(error)) {
      return undefined;
    }
    throw new Error(`Cannot read the token cache at ${filePath}: ${reason(error)}`, {
      cause: error,
    });
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(contents);
  } catch (error) {
    throw new Error(`Cannot read the token cache at ${filePath}: ${reason(error)}`, {
      cause: error,
    });
  }
  if (!isRecord(parsed)) {
    throw new Error(`Cannot read the token cache at ${filePath}: it is not a JSON object.`);
  }
  return parsed;
}

// Tolerant, for the server's own read-modify-write: the next login rewrites the file,
// so an unreadable one is treated as empty there.
function readCache(cacheDir: string): TokenFile {
  try {
    return readCacheStrictly(cachePath(cacheDir)) ?? {};
  } catch {
    return {};
  }
}

// The one writer, through the shared atomic replacement: a concurrent reader — another
// server, or the CLI — sees the old file or the new one, never a partial one.
function writeCache(cacheDir: string, tokens: TokenFile): void {
  const filePath = cachePath(cacheDir);
  try {
    writeFileAtomically({ filePath, contents: JSON.stringify(tokens) });
  } catch (error) {
    throw new Error(`Cannot write the token cache at ${filePath}: ${reason(error)}`, {
      cause: error,
    });
  }
}

const tokenIn = (tokens: TokenFile, baseUrl: string): string | null => {
  const token = tokens[baseUrl];
  return typeof token === 'string' ? token : null;
};

const without = (tokens: TokenFile, baseUrl: string): TokenFile =>
  Object.fromEntries(Object.entries(tokens).filter(([key]) => key !== baseUrl));

export async function saveToken(
  baseUrl: string,
  jwt: string,
  cacheDir: string = DEFAULT_CACHE_DIR
): Promise<void> {
  writeCache(cacheDir, { ...readCache(cacheDir), [baseUrl]: jwt });
}

export async function readToken(
  baseUrl: string,
  cacheDir: string = DEFAULT_CACHE_DIR
): Promise<string | null> {
  return tokenIn(readCache(cacheDir), baseUrl);
}

export async function clearToken(
  baseUrl: string,
  cacheDir: string = DEFAULT_CACHE_DIR
): Promise<void> {
  writeCache(cacheDir, without(readCache(cacheDir), baseUrl));
}

/** What identifies one version of the cache file without reading it. */
interface CacheFingerprint {
  mtimeMs: number;
  size: number;
  ino: number;
}

/**
 * The cache file as last read, for the server's check before it reuses a token it holds
 * in memory. `tokens` is undefined when the file exists and cannot be read or parsed —
 * nothing is known about any token then — and empty when there is no file.
 */
export interface CacheSnapshot {
  /** 'missing' when there was no file; absent when it could not even be stat'd. */
  readonly fingerprint?: CacheFingerprint | 'missing';
  readonly tokens?: TokenFile;
}

export interface CacheSnapshotRequest {
  /** The snapshot the last call returned; reused as-is when the file has not changed. */
  previous?: CacheSnapshot;
  cacheDir?: string;
}

function fingerprintOf(filePath: string): CacheFingerprint | 'missing' | undefined {
  try {
    const { mtimeMs, size, ino } = fs.statSync(filePath);
    return { mtimeMs, size, ino };
  } catch (error) {
    return isMissing(error) ? 'missing' : undefined;
  }
}

const sameFingerprint = (
  a: CacheFingerprint | 'missing',
  b: CacheFingerprint | 'missing'
): boolean =>
  a === 'missing' || b === 'missing'
    ? a === b
    : a.mtimeMs === b.mtimeMs && a.size === b.size && a.ino === b.ino;

/**
 * Read the cache file only when it changed since `previous` was read: its modification
 * time, size, or inode (every write renames a new file into place) differ, or it
 * appeared or disappeared. Stat'd BEFORE it is read, so a write landing between the two
 * leaves a fingerprint older than the contents, and the next call reads again.
 */
export function readCacheSnapshot({
  previous,
  cacheDir = DEFAULT_CACHE_DIR,
}: CacheSnapshotRequest = {}): CacheSnapshot {
  const filePath = cachePath(cacheDir);
  const fingerprint = fingerprintOf(filePath);
  if (fingerprint === undefined) {
    return {};
  }
  if (previous?.fingerprint !== undefined && sameFingerprint(previous.fingerprint, fingerprint)) {
    return previous;
  }
  if (fingerprint === 'missing') {
    return { fingerprint, tokens: {} };
  }
  try {
    return { fingerprint, tokens: readCacheStrictly(filePath) ?? {} };
  } catch {
    return { fingerprint };
  }
}

export interface SignOutRequest {
  baseUrl: string;
  cacheDir?: string;
}

export type SignOutOutcome = 'removed' | 'not-cached';

/**
 * Remove one deployment's cached token, for `project logout`.
 *
 * Strict where the server's reads are tolerant: a file it cannot parse is reported, never
 * rewritten as `{}`, which would sign out of every deployment to remove one.
 *
 * Synchronous because the CLI that calls it is. A running server notices on its next
 * call: it reads this entry before reusing a token it holds in memory.
 */
export function signOut({ baseUrl, cacheDir = DEFAULT_CACHE_DIR }: SignOutRequest): SignOutOutcome {
  const cache = readCacheStrictly(cachePath(cacheDir));
  if (!cache || !Object.hasOwn(cache, baseUrl)) {
    return 'not-cached';
  }
  writeCache(cacheDir, without(cache, baseUrl));
  return 'removed';
}
