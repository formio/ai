import fs from 'fs/promises';
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
