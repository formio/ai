import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { ProjectMapUnreadableError, readProjectEntry, writeProjectEntry } from '../project-map.js';

describe('project-map', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-projects-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('writeProjectEntry writes env block keyed by cwd', () => {
    writeProjectEntry({
      cwd: '/workspace/packages/a',
      env: { FORMIO_PROJECT_URL: 'https://project-a.form.io' },
      cacheDir: tmpDir,
    });

    const contents = JSON.parse(fs.readFileSync(path.join(tmpDir, 'projects.json'), 'utf-8'));
    expect(contents).toEqual({
      '/workspace/packages/a': {
        env: { FORMIO_PROJECT_URL: 'https://project-a.form.io' },
      },
    });
  });

  it('readProjectEntry returns the entry for a cwd', () => {
    writeProjectEntry({
      cwd: '/workspace/packages/a',
      env: { FORMIO_PROJECT_URL: 'https://project-a.form.io' },
      cacheDir: tmpDir,
    });

    const entry = readProjectEntry('/workspace/packages/a', tmpDir);
    expect(entry).toEqual({
      env: { FORMIO_PROJECT_URL: 'https://project-a.form.io' },
    });
  });

  it('readProjectEntry returns null when file does not exist', () => {
    const missing = path.join(tmpDir, 'nope');
    expect(readProjectEntry('/any', missing)).toBeNull();
  });

  it('readProjectEntry returns null when cwd is not mapped', () => {
    writeProjectEntry({
      cwd: '/workspace/packages/a',
      env: { FORMIO_PROJECT_URL: 'https://project-a.form.io' },
      cacheDir: tmpDir,
    });
    expect(readProjectEntry('/workspace/packages/b', tmpDir)).toBeNull();
  });

  it('writeProjectEntry preserves entries for other cwds', () => {
    writeProjectEntry({
      cwd: '/workspace/packages/a',
      env: { FORMIO_PROJECT_URL: 'https://a.form.io' },
      cacheDir: tmpDir,
    });
    writeProjectEntry({
      cwd: '/workspace/packages/b',
      env: { FORMIO_PROJECT_URL: 'https://b.form.io' },
      cacheDir: tmpDir,
    });

    expect(readProjectEntry('/workspace/packages/a', tmpDir)).toEqual({
      env: { FORMIO_PROJECT_URL: 'https://a.form.io' },
    });
    expect(readProjectEntry('/workspace/packages/b', tmpDir)).toEqual({
      env: { FORMIO_PROJECT_URL: 'https://b.form.io' },
    });
  });

  it('writeProjectEntry overwrites the env block for the same cwd', () => {
    writeProjectEntry({
      cwd: '/workspace/packages/a',
      env: { FORMIO_PROJECT_URL: 'https://old-project.form.io' },
      cacheDir: tmpDir,
    });
    writeProjectEntry({
      cwd: '/workspace/packages/a',
      env: { FORMIO_PROJECT_URL: 'https://new-project.form.io' },
      cacheDir: tmpDir,
    });

    expect(readProjectEntry('/workspace/packages/a', tmpDir)).toEqual({
      env: { FORMIO_PROJECT_URL: 'https://new-project.form.io' },
    });
  });

  // A file that cannot be parsed is not an empty map. Treating it as one made
  // every mapping look absent, and the documented recovery — interview, then
  // project set — then wrote a fresh single-entry file over every other
  // directory's mapping. Failing loudly keeps the file intact for repair.
  describe('an unreadable map', () => {
    beforeEach(() => {
      fs.writeFileSync(path.join(tmpDir, 'projects.json'), '{"/workspace": {"env"');
    });

    it('makes readProjectEntry throw rather than report nothing mapped', () => {
      expect(() => readProjectEntry('/workspace', tmpDir)).toThrow(ProjectMapUnreadableError);
    });

    it('names the file so the user can repair it', () => {
      expect(() => readProjectEntry('/workspace', tmpDir)).toThrow(/projects\.json/);
    });

    it('refuses to overwrite it from writeProjectEntry', () => {
      expect(() =>
        writeProjectEntry({
          cwd: '/workspace',
          env: { FORMIO_PROJECT_URL: 'https://x.form.io' },
          cacheDir: tmpDir,
        })
      ).toThrow(ProjectMapUnreadableError);
      expect(fs.readFileSync(path.join(tmpDir, 'projects.json'), 'utf-8')).toBe(
        '{"/workspace": {"env"'
      );
    });
  });

  // Valid JSON that is not a map of entries is unreadable for the same reason a
  // syntax error is: nothing can be keyed off it. Without the shape check, `null`
  // throws a bare TypeError that the CLI's resolveOrNull swallows into "no
  // project configured", and an array or a string silently reads as unmapped and
  // is then written over.
  describe.each([
    ['null', 'null'],
    ['an array', '[]'],
    ['a string', '"nope"'],
    ['a number', '42'],
  ])('a map file holding %s', (_label, contents) => {
    beforeEach(() => {
      fs.writeFileSync(path.join(tmpDir, 'projects.json'), contents);
    });

    it('makes readProjectEntry throw ProjectMapUnreadableError', () => {
      expect(() => readProjectEntry('/workspace', tmpDir)).toThrow(ProjectMapUnreadableError);
    });

    it('refuses to overwrite it from writeProjectEntry', () => {
      expect(() =>
        writeProjectEntry({
          cwd: '/workspace',
          env: { FORMIO_PROJECT_URL: 'https://x.form.io' },
          cacheDir: tmpDir,
        })
      ).toThrow(ProjectMapUnreadableError);
      expect(fs.readFileSync(path.join(tmpDir, 'projects.json'), 'utf-8')).toBe(contents);
    });
  });

  // Top-level shape was checked and per-entry shape was not, so a file whose
  // entries are malformed passed validation and every reader then did
  // `entry.env.FORMIO_BASE_URL` on a string or a bare object — a raw TypeError
  // reported as a generic failure, which is precisely what
  // ProjectMapUnreadableError exists to replace. An entry is an object with an
  // `env` object of strings, or the file is unreadable.
  describe.each([
    ['an entry that is a string', '{"/workspace": "https://x.form.io"}'],
    ['an entry with no env block', '{"/workspace": {}}'],
    ['an entry whose env is a string', '{"/workspace": {"env": "https://x.form.io"}}'],
    ['an entry whose env holds a non-string', '{"/workspace": {"env": {"FORMIO_BASE_URL": 7}}}'],
    ['an entry that is null', '{"/workspace": null}'],
  ])('a map file with %s', (_label, contents) => {
    beforeEach(() => {
      fs.writeFileSync(path.join(tmpDir, 'projects.json'), contents);
    });

    it('makes readProjectEntry throw ProjectMapUnreadableError, naming the directory', () => {
      expect(() => readProjectEntry('/workspace', tmpDir)).toThrow(ProjectMapUnreadableError);
      expect(() => readProjectEntry('/workspace', tmpDir)).toThrow(/\/workspace/);
    });

    // Replaced, not refused. This entry is what the write is FOR: the error the reader
    // raises names re-mapping the directory as the repair, and a writer that refuses to
    // overwrite it makes that repair impossible — while telling the reader to delete a
    // file that holds every other directory's mapping. Nothing in a malformed entry is
    // worth preserving against the user's explicit re-map.
    it('replaces it from writeProjectEntry', () => {
      expect(() =>
        writeProjectEntry({
          cwd: '/workspace',
          env: { FORMIO_PROJECT_URL: 'https://x.form.io' },
          cacheDir: tmpDir,
        })
      ).not.toThrow();
      expect(readProjectEntry('/workspace', tmpDir)).toEqual({
        env: { FORMIO_PROJECT_URL: 'https://x.form.io' },
      });
    });

    // The rest of the file is not this write's business, malformed or not.
    it('leaves another directory untouched while doing so', () => {
      const preserved = JSON.parse(contents) as Record<string, unknown>;
      preserved['/other'] = { env: { FORMIO_PROJECT_URL: 'https://other.form.io' } };
      fs.writeFileSync(path.join(tmpDir, 'projects.json'), JSON.stringify(preserved));

      writeProjectEntry({
        cwd: '/workspace',
        env: { FORMIO_PROJECT_URL: 'https://x.form.io' },
        cacheDir: tmpDir,
      });

      expect(readProjectEntry('/other', tmpDir)).toEqual({
        env: { FORMIO_PROJECT_URL: 'https://other.form.io' },
      });
    });
  });

  // A directory this caller never asked about must not fail its lookup: the map
  // is shared, and one bad entry written by hand would otherwise take every
  // other workspace down with it.
  it('reads a well-formed entry alongside a malformed one for another directory', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'projects.json'),
      '{"/broken": "nope", "/good": {"env": {"FORMIO_PROJECT_URL": "https://good.form.io"}}}'
    );

    expect(readProjectEntry('/good', tmpDir)).toEqual({
      env: { FORMIO_PROJECT_URL: 'https://good.form.io' },
    });
    expect(() => readProjectEntry('/broken', tmpDir)).toThrow(ProjectMapUnreadableError);
  });

  it('maps another directory without disturbing a malformed sibling entry', () => {
    fs.writeFileSync(path.join(tmpDir, 'projects.json'), '{"/broken": "nope"}');

    writeProjectEntry({
      cwd: '/good',
      env: { FORMIO_PROJECT_URL: 'https://good.form.io' },
      cacheDir: tmpDir,
    });

    const raw = JSON.parse(fs.readFileSync(path.join(tmpDir, 'projects.json'), 'utf-8')) as Record<
      string,
      unknown
    >;
    expect(raw['/broken']).toBe('nope');
    expect(raw['/good']).toEqual({ env: { FORMIO_PROJECT_URL: 'https://good.form.io' } });
  });

  it('file is created with 0600 permissions', () => {
    writeProjectEntry({
      cwd: '/workspace/packages/a',
      env: { FORMIO_PROJECT_URL: 'https://a.form.io' },
      cacheDir: tmpDir,
    });
    const stats = fs.statSync(path.join(tmpDir, 'projects.json'));
    expect((stats.mode & 0o777).toString(8)).toBe('600');
  });
});
