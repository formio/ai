import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { saveToken, readToken, clearToken } from '../token-cache.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('token-cache', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-cache-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('saveToken writes JWT to cache file keyed by project URL', async () => {
    await saveToken('https://example.form.io/myproject', 'jwt-token-123', tmpDir);

    const cacheFile = path.join(tmpDir, 'mcp-tokens.json');
    const contents = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
    expect(contents).toEqual({ 'https://example.form.io/myproject': 'jwt-token-123' });
  });

  it('readToken returns cached JWT for a given project URL', async () => {
    await saveToken('https://example.form.io/myproject', 'jwt-token-123', tmpDir);

    const token = await readToken('https://example.form.io/myproject', tmpDir);
    expect(token).toBe('jwt-token-123');
  });

  it('readToken returns null when cache file does not exist', async () => {
    const nonExistentDir = path.join(tmpDir, 'nonexistent');

    const token = await readToken('https://example.form.io/myproject', nonExistentDir);
    expect(token).toBeNull();
  });

  it('clearToken removes entry for a project URL without affecting others', async () => {
    await saveToken('https://a.form.io/p1', 'token-a', tmpDir);
    await saveToken('https://b.form.io/p2', 'token-b', tmpDir);

    await clearToken('https://a.form.io/p1', tmpDir);

    const tokenA = await readToken('https://a.form.io/p1', tmpDir);
    const tokenB = await readToken('https://b.form.io/p2', tmpDir);
    expect(tokenA).toBeNull();
    expect(tokenB).toBe('token-b');
  });

  it('cache file is created with 0600 permissions', async () => {
    await saveToken('https://example.form.io/myproject', 'jwt-token-123', tmpDir);

    const cacheFile = path.join(tmpDir, 'mcp-tokens.json');
    const stats = fs.statSync(cacheFile);
    const permissions = (stats.mode & 0o777).toString(8);
    expect(permissions).toBe('600');
  });
});
