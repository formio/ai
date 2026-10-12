import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { saveToken, readToken, clearToken, signOut } from '../token-cache.js';
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

  // The CLI's sign-out. Strict where the server's reads are tolerant: a file it cannot
  // parse is reported, never rewritten as empty, which would sign out of every deployment.
  describe('signOut', () => {
    const cacheFile = () => path.join(tmpDir, 'mcp-tokens.json');

    it('removes one deployment and reports it removed, keeping the others and the file mode', async () => {
      await saveToken('https://a.form.io', 'token-a', tmpDir);
      await saveToken('https://b.form.io', 'token-b', tmpDir);

      expect(signOut({ baseUrl: 'https://a.form.io', cacheDir: tmpDir })).toBe('removed');

      expect(JSON.parse(fs.readFileSync(cacheFile(), 'utf-8'))).toEqual({
        'https://b.form.io': 'token-b',
      });
      expect((fs.statSync(cacheFile()).mode & 0o777).toString(8)).toBe('600');
    });

    it('reports nothing cached, without writing, when the deployment has no entry', async () => {
      await saveToken('https://b.form.io', 'token-b', tmpDir);
      const before = fs.statSync(cacheFile()).mtimeMs;

      expect(signOut({ baseUrl: 'https://a.form.io', cacheDir: tmpDir })).toBe('not-cached');
      expect(fs.statSync(cacheFile()).mtimeMs).toBe(before);
    });

    it('reports nothing cached when the file does not exist', () => {
      expect(signOut({ baseUrl: 'https://a.form.io', cacheDir: tmpDir })).toBe('not-cached');
      expect(fs.existsSync(cacheFile())).toBe(false);
    });

    it('throws, naming the file, when the cache is not a JSON object', () => {
      fs.writeFileSync(cacheFile(), '["a"]');

      expect(() => signOut({ baseUrl: 'https://a.form.io', cacheDir: tmpDir })).toThrow(
        cacheFile()
      );
      expect(fs.readFileSync(cacheFile(), 'utf-8')).toBe('["a"]');
    });
  });
});
