import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { readProjectEntry, writeProjectEntry } from '../project-map.js';
import { runProjectCommand } from '../cli/project-command.js';

// The base-URL error names `project set --base-url <url>` as its remedy. With
// --project-url required, that command could not run: the user would have to
// re-supply a value the mapping already holds, from a message that deliberately
// did not ask for it. Either flag alone is a valid update on a mapped directory.
describe('project set updates one URL at a time', () => {
  let cacheDir: string;

  beforeEach(() => {
    cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-project-partial-'));
  });

  afterEach(() => {
    fs.rmSync(cacheDir, { recursive: true, force: true });
  });

  function set(args: string[]) {
    return runProjectCommand(['project', 'set', ...args], { cacheDir, env: {} });
  }

  it('accepts --base-url alone for a directory that already has a project', () => {
    writeProjectEntry(
      '/w/mapped',
      { FORMIO_PROJECT_URL: 'https://myproject.mysite.com' },
      cacheDir
    );

    const result = set(['--base-url', 'https://forms.mysite.com', '--cwd', '/w/mapped']);

    expect(result.exitCode).toBe(0);
    const entry = readProjectEntry('/w/mapped', cacheDir);
    expect(entry?.env.FORMIO_BASE_URL).toBe('https://forms.mysite.com');
    expect(entry?.env.FORMIO_PROJECT_URL).toBe('https://myproject.mysite.com');
  });

  it('accepts --project-url alone and keeps the mapped base URL', () => {
    writeProjectEntry(
      '/w/mapped2',
      {
        FORMIO_PROJECT_URL: 'https://old.mysite.com',
        FORMIO_BASE_URL: 'https://forms.mysite.com',
      },
      cacheDir
    );

    const result = set(['--project-url', 'https://new.mysite.com', '--cwd', '/w/mapped2']);

    expect(result.exitCode).toBe(0);
    const entry = readProjectEntry('/w/mapped2', cacheDir);
    expect(entry?.env.FORMIO_PROJECT_URL).toBe('https://new.mysite.com');
    expect(entry?.env.FORMIO_BASE_URL).toBe('https://forms.mysite.com');
  });

  // With nothing mapped there is no project to attach a deployment to, so the
  // project URL is still the required half.
  it('still requires --project-url for an unmapped directory', () => {
    const result = set(['--base-url', 'https://forms.mysite.com', '--cwd', '/w/unmapped']);

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain('--project-url');
  });

  it('fails when neither URL is supplied, naming both', () => {
    writeProjectEntry('/w/mapped3', { FORMIO_PROJECT_URL: 'https://x.form.io' }, cacheDir);

    const result = set(['--cwd', '/w/mapped3']);

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain('--project-url');
    expect(result.stderr).toContain('--base-url');
  });
});
