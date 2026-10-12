import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { saveToken, readToken, clearToken, signOut, readCacheSnapshot } from '../token-cache.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('token-cache', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-cache-test-'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
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
  // Every write goes to a temporary file in the same directory and is renamed over the
  // cache, so a reader — another server, or the CLI — sees the old file or the new one,
  // never a partial one.
  describe('atomic writes', () => {
    const cacheFile = () => path.join(tmpDir, 'mcp-tokens.json');
    const leftovers = () => fs.readdirSync(tmpDir).filter((name) => name !== 'mcp-tokens.json');

    it.each([
      ['saveToken', () => saveToken('https://b.form.io', 'token-b', tmpDir)],
      ['clearToken', () => clearToken('https://a.form.io', tmpDir)],
      ['signOut', async () => void signOut({ baseUrl: 'https://a.form.io', cacheDir: tmpDir })],
    ])('%s writes a 0600 temporary file beside the cache and renames it over', async (_, write) => {
      await saveToken('https://a.form.io', 'token-a', tmpDir);
      const writeFile = vi.spyOn(fs, 'writeFileSync');
      const rename = vi.spyOn(fs, 'renameSync');

      await write();

      expect(rename).toHaveBeenCalledOnce();
      const [from, to] = rename.mock.calls[0];
      expect(to).toBe(cacheFile());
      expect(path.dirname(String(from))).toBe(tmpDir);
      expect(from).not.toBe(cacheFile());
      // The cache file itself is never written in place.
      expect(writeFile.mock.calls.map(([target]) => target)).not.toContain(cacheFile());
      expect(writeFile).toHaveBeenCalledWith(
        from,
        expect.any(String),
        expect.objectContaining({ mode: 0o600 })
      );
      expect((fs.statSync(cacheFile()).mode & 0o777).toString(8)).toBe('600');
      expect(leftovers()).toEqual([]);
    });

    it('a write that fails leaves the previous file intact and no temporary file behind', async () => {
      await saveToken('https://a.form.io', 'token-a', tmpDir);
      vi.spyOn(fs, 'renameSync').mockImplementation(() => {
        throw new Error('EXDEV: cross-device link not permitted');
      });

      await expect(saveToken('https://b.form.io', 'token-b', tmpDir)).rejects.toThrow(cacheFile());

      expect(JSON.parse(fs.readFileSync(cacheFile(), 'utf-8'))).toEqual({
        'https://a.form.io': 'token-a',
      });
      expect(leftovers()).toEqual([]);
    });
  });

  // What the server's on-disk check reads. A missing file holds no tokens; a file that
  // cannot be read or parsed says nothing about any token, so it is reported as such
  // rather than as empty.
  describe('readCacheSnapshot', () => {
    const cacheFile = () => path.join(tmpDir, 'mcp-tokens.json');

    it('reports a missing file as holding no tokens', () => {
      expect(readCacheSnapshot({ cacheDir: tmpDir }).tokens).toEqual({});
    });

    it('reports the tokens a readable file holds', async () => {
      await saveToken('https://a.form.io', 'token-a', tmpDir);

      expect(readCacheSnapshot({ cacheDir: tmpDir }).tokens).toEqual({
        'https://a.form.io': 'token-a',
      });
    });

    it.each([
      ['torn mid-write', '{"https://a.form.io": "tok'],
      ['not an object', '["a"]'],
    ])('reports a file %s as unreadable, not as empty', (_, contents) => {
      fs.writeFileSync(cacheFile(), contents);

      expect(readCacheSnapshot({ cacheDir: tmpDir }).tokens).toBeUndefined();
    });

    it('keeps readToken tolerant: an unreadable file reads as no token', async () => {
      fs.writeFileSync(cacheFile(), '{"https://a.form.io": "tok');

      expect(await readToken('https://a.form.io', tmpDir)).toBeNull();
    });

    it('does not re-read a file whose size and modification time are unchanged', async () => {
      await saveToken('https://a.form.io', 'token-a', tmpDir);
      const read = vi.spyOn(fs, 'readFileSync');
      const first = readCacheSnapshot({ cacheDir: tmpDir });

      const second = readCacheSnapshot({ previous: first, cacheDir: tmpDir });

      expect(read).toHaveBeenCalledOnce();
      expect(second).toBe(first);
    });

    it('re-reads a file that changed since the last read', async () => {
      await saveToken('https://a.form.io', 'token-a', tmpDir);
      const first = readCacheSnapshot({ cacheDir: tmpDir });
      await saveToken('https://a.form.io', 'token-a-renewed', tmpDir);
      const read = vi.spyOn(fs, 'readFileSync');

      const second = readCacheSnapshot({ previous: first, cacheDir: tmpDir });

      expect(read).toHaveBeenCalledOnce();
      expect(second.tokens).toEqual({ 'https://a.form.io': 'token-a-renewed' });
    });

    it('re-reads after the file is removed and reports no tokens', async () => {
      await saveToken('https://a.form.io', 'token-a', tmpDir);
      const first = readCacheSnapshot({ cacheDir: tmpDir });
      fs.rmSync(cacheFile());

      expect(readCacheSnapshot({ previous: first, cacheDir: tmpDir }).tokens).toEqual({});
    });
  });
});
