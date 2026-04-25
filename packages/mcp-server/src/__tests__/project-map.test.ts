import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { readProjectEntry, writeProjectEntry } from '../project-map.js';

describe('project-map', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-projects-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('writeProjectEntry writes env block keyed by cwd', () => {
    writeProjectEntry(
      '/workspace/packages/a',
      { FORMIO_PROJECT_URL: 'https://api.form.io/project-a' },
      tmpDir
    );

    const contents = JSON.parse(fs.readFileSync(path.join(tmpDir, 'projects.json'), 'utf-8'));
    expect(contents).toEqual({
      '/workspace/packages/a': {
        env: { FORMIO_PROJECT_URL: 'https://api.form.io/project-a' },
      },
    });
  });

  it('readProjectEntry returns the entry for a cwd', () => {
    writeProjectEntry(
      '/workspace/packages/a',
      { FORMIO_PROJECT_URL: 'https://api.form.io/project-a' },
      tmpDir
    );

    const entry = readProjectEntry('/workspace/packages/a', tmpDir);
    expect(entry).toEqual({
      env: { FORMIO_PROJECT_URL: 'https://api.form.io/project-a' },
    });
  });

  it('readProjectEntry returns null when file does not exist', () => {
    const missing = path.join(tmpDir, 'nope');
    expect(readProjectEntry('/any', missing)).toBeNull();
  });

  it('readProjectEntry returns null when cwd is not mapped', () => {
    writeProjectEntry(
      '/workspace/packages/a',
      { FORMIO_PROJECT_URL: 'https://api.form.io/project-a' },
      tmpDir
    );
    expect(readProjectEntry('/workspace/packages/b', tmpDir)).toBeNull();
  });

  it('writeProjectEntry preserves entries for other cwds', () => {
    writeProjectEntry(
      '/workspace/packages/a',
      { FORMIO_PROJECT_URL: 'https://api.form.io/a' },
      tmpDir
    );
    writeProjectEntry(
      '/workspace/packages/b',
      { FORMIO_PROJECT_URL: 'https://api.form.io/b' },
      tmpDir
    );

    expect(readProjectEntry('/workspace/packages/a', tmpDir)).toEqual({
      env: { FORMIO_PROJECT_URL: 'https://api.form.io/a' },
    });
    expect(readProjectEntry('/workspace/packages/b', tmpDir)).toEqual({
      env: { FORMIO_PROJECT_URL: 'https://api.form.io/b' },
    });
  });

  it('writeProjectEntry overwrites the env block for the same cwd', () => {
    writeProjectEntry(
      '/workspace/packages/a',
      { FORMIO_PROJECT_URL: 'https://api.form.io/old' },
      tmpDir
    );
    writeProjectEntry(
      '/workspace/packages/a',
      { FORMIO_PROJECT_URL: 'https://api.form.io/new' },
      tmpDir
    );

    expect(readProjectEntry('/workspace/packages/a', tmpDir)).toEqual({
      env: { FORMIO_PROJECT_URL: 'https://api.form.io/new' },
    });
  });

  it('file is created with 0600 permissions', () => {
    writeProjectEntry(
      '/workspace/packages/a',
      { FORMIO_PROJECT_URL: 'https://api.form.io/a' },
      tmpDir
    );
    const stats = fs.statSync(path.join(tmpDir, 'projects.json'));
    expect((stats.mode & 0o777).toString(8)).toBe('600');
  });
});
