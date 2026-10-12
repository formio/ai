import fs from 'fs/promises';
import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import os from 'os';

const DEFAULT_CACHE_DIR = path.join(os.homedir(), '.formio');
const CACHE_FILE = 'mcp-tokens.json';

async function readCache(cacheDir: string): Promise<Record<string, string>> {
  const filePath = path.join(cacheDir, CACHE_FILE);
  try {
    const contents = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(contents);
  } catch {
    return {};
  }
}

async function writeCache(cacheDir: string, data: Record<string, string>): Promise<void> {
  await fs.mkdir(cacheDir, { recursive: true });
  const filePath = path.join(cacheDir, CACHE_FILE);
  await fs.writeFile(filePath, JSON.stringify(data), { mode: 0o600 });
}

export async function saveToken(
  baseUrl: string,
  jwt: string,
  cacheDir: string = DEFAULT_CACHE_DIR
): Promise<void> {
  const cache = await readCache(cacheDir);
  cache[baseUrl] = jwt;
  await writeCache(cacheDir, cache);
}

export async function readToken(
  baseUrl: string,
  cacheDir: string = DEFAULT_CACHE_DIR
): Promise<string | null> {
  const cache = await readCache(cacheDir);
  return cache[baseUrl] ?? null;
}

export async function clearToken(
  baseUrl: string,
  cacheDir: string = DEFAULT_CACHE_DIR
): Promise<void> {
  const cache = await readCache(cacheDir);
  delete cache[baseUrl];
  await writeCache(cacheDir, cache);
}

export interface SignOutRequest {
  baseUrl: string;
  cacheDir?: string;
}

export type SignOutOutcome = 'removed' | 'not-cached';

function isTokenMap(value: unknown): value is Record<string, string> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const reason = (error: unknown): string => (error instanceof Error ? error.message : String(error));

// Strict where readCache is tolerant. The server treats an unreadable cache as empty
// because the next login rewrites it; a sign-out that did the same would rewrite a
// file it could not parse as `{}`, signing out of every deployment to remove one.
function readCacheStrictly(filePath: string): Record<string, string> | undefined {
  let contents: string;
  try {
    contents = readFileSync(filePath, 'utf-8');
  } catch (error) {
    if (error instanceof Error && (error as NodeJS.ErrnoException).code === 'ENOENT') {
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
  if (!isTokenMap(parsed)) {
    throw new Error(`Cannot read the token cache at ${filePath}: it is not a JSON object.`);
  }
  return parsed;
}

/**
 * Remove one deployment's cached token, for `project logout`.
 *
 * Synchronous because the CLI that calls it is. A running server notices on its next
 * call: it reads this entry before reusing a token it holds in memory.
 */
export function signOut({ baseUrl, cacheDir = DEFAULT_CACHE_DIR }: SignOutRequest): SignOutOutcome {
  const filePath = path.join(cacheDir, CACHE_FILE);
  const cache = readCacheStrictly(filePath);
  if (!cache || !Object.hasOwn(cache, baseUrl)) {
    return 'not-cached';
  }
  const remaining = Object.fromEntries(Object.entries(cache).filter(([key]) => key !== baseUrl));
  try {
    writeFileSync(filePath, JSON.stringify(remaining), { mode: 0o600 });
  } catch (error) {
    throw new Error(`Cannot write the token cache at ${filePath}: ${reason(error)}`, {
      cause: error,
    });
  }
  return 'removed';
}
