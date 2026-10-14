import fs from 'fs';
import path from 'path';
import os from 'os';
import { BLOCKING_SLEEP, TIMER_SLEEP, errorCode, fingerprintOf, sameFingerprint, updateFileLocked, writeFileAtomically, } from './atomic-file.js';
import { isRecord } from './tool-errors.js';
const DEFAULT_CACHE_DIR = path.join(os.homedir(), '.formio');
const CACHE_FILE = 'mcp-tokens.json';
const cachePath = (cacheDir) => path.join(cacheDir, CACHE_FILE);
const reason = (error) => (error instanceof Error ? error.message : String(error));
// The one reader. Undefined means the file does not exist, which is a cache holding no
// tokens; a file that exists and cannot be read or parsed throws, because it says
// nothing about any token — treating it as empty would discard tokens it may well hold.
function readCacheStrictly(filePath) {
    let contents;
    try {
        contents = fs.readFileSync(filePath, 'utf-8');
    }
    catch (error) {
        if (errorCode(error) === 'ENOENT') {
            return undefined;
        }
        throw new Error(`Cannot read the token cache at ${filePath}: ${reason(error)}`, {
            cause: error,
        });
    }
    let parsed;
    try {
        parsed = JSON.parse(contents);
    }
    catch (error) {
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
function readCache(cacheDir) {
    try {
        return readCacheStrictly(cachePath(cacheDir)) ?? {};
    }
    catch {
        return {};
    }
}
// The one writer, through the shared atomic replacement: a concurrent reader — another
// server, or the CLI — sees the old file or the new one, never a partial one.
function writeCache(cacheDir, tokens) {
    const filePath = cachePath(cacheDir);
    try {
        writeFileAtomically({ filePath, contents: JSON.stringify(tokens) });
    }
    catch (error) {
        throw new Error(`Cannot write the token cache at ${filePath}: ${reason(error)}`, {
            cause: error,
        });
    }
}
function updateCache({ cacheDir, read, change, sleep, }) {
    const filePath = cachePath(cacheDir);
    return updateFileLocked({
        filePath,
        read: () => read(cacheDir),
        update: change,
        write: (next) => writeCache(cacheDir, next ?? {}),
        lockFailure: ({ lockPath, cause }) => new Error(`Cannot take the token cache's lock file ${lockPath}: ${reason(cause)}`, {
            cause,
        }),
        sleep,
    });
}
const tokenIn = (tokens, baseUrl) => {
    const token = tokens[baseUrl];
    return typeof token === 'string' ? token : null;
};
const without = (tokens, baseUrl) => Object.fromEntries(Object.entries(tokens).filter(([key]) => key !== baseUrl));
export async function saveToken(baseUrl, jwt, cacheDir = DEFAULT_CACHE_DIR) {
    await updateCache({
        cacheDir,
        read: readCache,
        change: (tokens) => ({ next: { ...tokens, [baseUrl]: jwt }, result: undefined }),
        sleep: TIMER_SLEEP,
    });
}
export async function readToken(baseUrl, cacheDir = DEFAULT_CACHE_DIR) {
    return tokenIn(readCache(cacheDir), baseUrl);
}
export async function clearToken(baseUrl, cacheDir = DEFAULT_CACHE_DIR) {
    await updateCache({
        cacheDir,
        read: readCache,
        change: (tokens = {}) => ({ next: without(tokens, baseUrl), result: undefined }),
        sleep: TIMER_SLEEP,
    });
}
/**
 * Read the cache file only when it changed since `previous` was read: its modification
 * time, size, or inode (every write renames a new file into place) differ, or it
 * appeared or disappeared. Stat'd BEFORE it is read, so a write landing between the two
 * leaves a fingerprint older than the contents, and the next call reads again.
 */
export function readCacheSnapshot({ previous, cacheDir = DEFAULT_CACHE_DIR, } = {}) {
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
    }
    catch {
        return { fingerprint };
    }
}
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
export function signOut({ baseUrl, cacheDir = DEFAULT_CACHE_DIR }) {
    return updateCache({
        cacheDir,
        read: (dir) => readCacheStrictly(cachePath(dir)),
        change: (cache) => cache && Object.hasOwn(cache, baseUrl)
            ? { next: without(cache, baseUrl), result: 'removed' }
            : { result: 'not-cached' },
        sleep: BLOCKING_SLEEP,
    });
}
