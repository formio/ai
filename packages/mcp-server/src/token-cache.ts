import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  BLOCKING_SLEEP,
  BlockingSleep,
  FingerprintState,
  SleepStrategy,
  TIMER_SLEEP,
  TimerSleep,
  errorCode,
  fingerprintOf,
  sameFingerprint,
  updateFileLocked,
  writeFileAtomically,
} from './atomic-file.js';
import { isRecord } from './tool-errors.js';

const DEFAULT_CACHE_DIR = path.join(os.homedir(), '.formio');
const CACHE_FILE = 'mcp-tokens.json';

/** The cache file's contents: one JWT per deployment, keyed by its base URL. */
export type TokenFile = Readonly<Record<string, unknown>>;

const cachePath = (cacheDir: string): string => path.join(cacheDir, CACHE_FILE);

const reason = (error: unknown): string => (error instanceof Error ? error.message : String(error));

// The one reader. Undefined means the file does not exist, which is a cache holding no
// tokens; a file that exists and cannot be read or parsed throws, because it says
// nothing about any token — treating it as empty would discard tokens it may well hold.
function readCacheStrictly(filePath: string): TokenFile | undefined {
  let contents: string;
  try {
    contents = fs.readFileSync(filePath, 'utf-8');
  } catch (error) {
    if (errorCode(error) === 'ENOENT') {
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

interface CacheUpdate<T> {
  cacheDir: string;
  read: (cacheDir: string) => TokenFile | undefined;
  /** The change, applied to the file as it is on disk under the lock; undefined when absent. */
  change: (tokens: TokenFile | undefined) => { next?: TokenFile; result: T };
}

/**
 * Every write is a locked read-modify-write (see updateFileLocked): the cache is shared
 * by every server process and the CLI on this machine, so a write that read the file
 * before another process's write landed would drop that process's token.
 */
function updateCache<T>(request: CacheUpdate<T> & { sleep: BlockingSleep }): T;
function updateCache<T>(request: CacheUpdate<T> & { sleep: TimerSleep }): Promise<T>;
function updateCache<T>({
  cacheDir,
  read,
  change,
  sleep,
}: CacheUpdate<T> & { sleep: SleepStrategy }): T | Promise<T> {
  const filePath = cachePath(cacheDir);
  return updateFileLocked({
    filePath,
    read: () => read(cacheDir),
    update: change,
    write: (next: TokenFile | undefined) => writeCache(cacheDir, next ?? {}),
    lockFailure: ({ lockPath, cause }) =>
      new Error(`Cannot take the token cache's lock file ${lockPath}: ${reason(cause)}`, {
        cause,
      }),
    sleep,
  });
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
  await updateCache({
    cacheDir,
    read: readCache,
    change: (tokens) => ({ next: { ...tokens, [baseUrl]: jwt }, result: undefined }),
    sleep: TIMER_SLEEP,
  });
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
  await updateCache({
    cacheDir,
    read: readCache,
    change: (tokens = {}) => ({ next: without(tokens, baseUrl), result: undefined }),
    sleep: TIMER_SLEEP,
  });
}

/**
 * The cache file as last read, for the server's check before it reuses a token it holds
 * in memory. `tokens` is undefined when the file exists and cannot be read or parsed —
 * nothing is known about any token then — and empty when there is no file.
 */
export interface CacheSnapshot {
  /** 'missing' when there was no file; absent when it could not even be stat'd. */
  readonly fingerprint?: FingerprintState;
  readonly tokens?: TokenFile;
}

export interface CacheSnapshotRequest {
  /** The snapshot the last call returned; reused as-is when the file has not changed. */
  previous?: CacheSnapshot;
  cacheDir?: string;
}

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
 * Synchronous because the CLI that calls it is: it waits for the cache's lock by
 * blocking, where the server's own writes wait on a timer. A running server notices on its next
 * call: it reads this entry before reusing a token it holds in memory.
 */
export function signOut({ baseUrl, cacheDir = DEFAULT_CACHE_DIR }: SignOutRequest): SignOutOutcome {
  return updateCache({
    cacheDir,
    read: (dir) => readCacheStrictly(cachePath(dir)),
    change: (cache): { next?: TokenFile; result: SignOutOutcome } =>
      cache && Object.hasOwn(cache, baseUrl)
        ? { next: without(cache, baseUrl), result: 'removed' }
        : { result: 'not-cached' },
    sleep: BLOCKING_SLEEP,
  });
}
