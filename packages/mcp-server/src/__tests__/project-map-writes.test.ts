import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { pathToFileURL } from 'url';
import { readProjectEntry, removeProjectEntry, writeProjectEntry } from '../project-map.js';
import { ToolError } from '../tool-errors.js';

const packageRoot = path.resolve(__dirname, '../..');
const tsxEntry = path.resolve(packageRoot, 'node_modules/tsx/dist/cli.mjs');
const projectMapModule = pathToFileURL(path.resolve(packageRoot, 'src/project-map.ts')).href;

// The map is shared by every server process on the machine. A write takes a lock file
// beside it, re-reads under the lock, and renames a complete temporary file over the
// map, so a reader never sees a partial file and concurrent writers never drop each
// other's entries.
describe('project map writes', () => {
  let cacheDir: string;
  const mapFile = () => path.join(cacheDir, 'projects.json');
  const lockFile = () => path.join(cacheDir, 'projects.json.lock');
  const leftovers = () => fs.readdirSync(cacheDir).filter((name) => name !== 'projects.json');
  // Fast timings, so a timeout case takes milliseconds rather than the 5 s default.
  const lock = { retryMs: 5, timeoutMs: 150, staleMs: 10_000 };

  beforeEach(() => {
    cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-map-writes-'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    fs.rmSync(cacheDir, { recursive: true, force: true });
  });

  const write = (cwd: string, projectUrl: string) =>
    writeProjectEntry({ cwd, env: { FORMIO_PROJECT_URL: projectUrl }, cacheDir, lock });

  describe('atomic replacement', () => {
    it.each([
      ['writeProjectEntry', () => write('/work/b', 'https://b.form.io')],
      ['removeProjectEntry', () => void removeProjectEntry({ cwd: '/work/a', cacheDir, lock })],
    ])('%s writes a 0600 temporary file beside the map and renames it over', (_, change) => {
      write('/work/a', 'https://a.form.io');
      const writeFile = vi.spyOn(fs, 'writeFileSync');
      const rename = vi.spyOn(fs, 'renameSync');

      change();

      expect(rename).toHaveBeenCalledOnce();
      const [from, to] = rename.mock.calls[0];
      expect(to).toBe(mapFile());
      expect(path.dirname(String(from))).toBe(cacheDir);
      expect(from).not.toBe(mapFile());
      // The map itself is never written in place.
      expect(writeFile.mock.calls.map(([target]) => target)).not.toContain(mapFile());
      expect(writeFile).toHaveBeenCalledWith(
        from,
        expect.any(String),
        expect.objectContaining({ mode: 0o600 })
      );
      expect((fs.statSync(mapFile()).mode & 0o777).toString(8)).toBe('600');
      expect(leftovers()).toEqual([]);
    });

    it('a write that fails leaves the previous map intact, no temporary file, and no lock', () => {
      write('/work/a', 'https://a.form.io');
      vi.spyOn(fs, 'renameSync').mockImplementation(() => {
        throw new Error('EXDEV: cross-device link not permitted');
      });

      expect(() => write('/work/b', 'https://b.form.io')).toThrow(mapFile());

      expect(JSON.parse(fs.readFileSync(mapFile(), 'utf-8'))).toEqual({
        '/work/a': { env: { FORMIO_PROJECT_URL: 'https://a.form.io' } },
      });
      expect(leftovers()).toEqual([]);
    });
  });

  describe('the lock', () => {
    it('is taken with exclusive create and removed after a successful write', () => {
      const open = vi.spyOn(fs, 'openSync');

      write('/work/a', 'https://a.form.io');

      expect(open).toHaveBeenCalledWith(lockFile(), 'wx', expect.anything());
      expect(fs.existsSync(lockFile())).toBe(false);
    });

    it('is removed after a write that fails', () => {
      vi.spyOn(fs, 'renameSync').mockImplementation(() => {
        throw new Error('EIO: i/o error');
      });

      expect(() => write('/work/a', 'https://a.form.io')).toThrow();

      expect(fs.existsSync(lockFile())).toBe(false);
    });

    it('fails with CONFIG_UNREADABLE naming the lock file when it cannot be taken in time', () => {
      write('/work/a', 'https://a.form.io');
      fs.writeFileSync(lockFile(), '');

      let failure: unknown;
      try {
        write('/work/b', 'https://b.form.io');
      } catch (error) {
        failure = error;
      }

      expect(failure).toBeInstanceOf(ToolError);
      expect((failure as ToolError).code).toBe('CONFIG_UNREADABLE');
      expect((failure as ToolError).message).toContain(lockFile());
      // Nothing was written, and the lock another writer holds is left alone.
      expect(readProjectEntry('/work/b', cacheDir)).toBeNull();
      expect(fs.existsSync(lockFile())).toBe(true);
    });

    it('replaces a lock older than the stale limit and proceeds', () => {
      fs.writeFileSync(lockFile(), '');
      const old = new Date(Date.now() - 11_000);
      fs.utimesSync(lockFile(), old, old);

      write('/work/a', 'https://a.form.io');

      expect(readProjectEntry('/work/a', cacheDir)?.env.FORMIO_PROJECT_URL).toBe(
        'https://a.form.io'
      );
      expect(fs.existsSync(lockFile())).toBe(false);
    });

    it('re-reads the map under the lock, so an entry written while it waited survives', async () => {
      // Another process holds the lock, writes its entry, and releases the lock; this
      // write waits for it and must keep that entry rather than a snapshot taken earlier.
      fs.writeFileSync(lockFile(), '');
      const holder = spawn(process.execPath, [
        '-e',
        `const fs = require('fs');
         setTimeout(() => {
           fs.writeFileSync(${JSON.stringify(mapFile())}, JSON.stringify({ '/work/other': { env: { FORMIO_PROJECT_URL: 'https://other.form.io' } } }));
           fs.rmSync(${JSON.stringify(lockFile())});
         }, 300);`,
      ]);
      const exited = new Promise((resolve) => holder.on('exit', resolve));

      writeProjectEntry({
        cwd: '/work/a',
        env: { FORMIO_PROJECT_URL: 'https://a.form.io' },
        cacheDir,
        lock: { retryMs: 10, timeoutMs: 10_000, staleMs: 10_000 },
      });
      await exited;

      expect(readProjectEntry('/work/other', cacheDir)?.env.FORMIO_PROJECT_URL).toBe(
        'https://other.form.io'
      );
      expect(readProjectEntry('/work/a', cacheDir)?.env.FORMIO_PROJECT_URL).toBe(
        'https://a.form.io'
      );
    }, 20_000);
  });

  // Separate processes, each writing many directories, released at the same instant.
  // An unserialized read-modify-write loses entries here; the lock keeps every one.
  it('keeps every entry when several processes write at once', async () => {
    const writers = 3;
    const perWriter = 15;
    const script = path.join(cacheDir, 'writer.mts');
    fs.writeFileSync(
      script,
      `import { writeProjectEntry } from ${JSON.stringify(projectMapModule)};
       const [cacheDir, id, count, startAt] = process.argv.slice(2);
       while (Date.now() < Number(startAt)) {}
       for (let i = 0; i < Number(count); i += 1) {
         writeProjectEntry({
           cwd: '/work/w' + id + '/d' + i,
           env: { FORMIO_PROJECT_URL: 'https://w' + id + '-' + i + '.form.io' },
           cacheDir,
         });
       }`
    );
    const startAt = Date.now() + 3_000;
    const runs = Array.from({ length: writers }, (_, id) => {
      const child = spawn(process.execPath, [
        tsxEntry,
        script,
        cacheDir,
        String(id),
        String(perWriter),
        String(startAt),
      ]);
      const stderr: string[] = [];
      child.stderr.on('data', (chunk) => stderr.push(String(chunk)));
      return new Promise<{ code: number | null; stderr: string }>((resolve) =>
        child.on('exit', (code) => resolve({ code, stderr: stderr.join('') }))
      );
    });

    const results = await Promise.all(runs);

    expect(results).toEqual(results.map(() => ({ code: 0, stderr: '' })));
    const map = JSON.parse(fs.readFileSync(mapFile(), 'utf-8')) as Record<string, unknown>;
    expect(Object.keys(map)).toHaveLength(writers * perWriter);
    expect(fs.existsSync(lockFile())).toBe(false);
  }, 60_000);
});
