import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { writeProjectEntry } from '../project-map.js';
import { COMMITTED_CONFIG_FILE } from '../committed-config.js';
import { EXIT_BASE_URL_UNRESOLVED, runProjectCommand } from '../cli/project-command.js';

// With three layers, "my project_set did nothing" becomes the obvious support
// question, and output that names only the winner cannot answer it. Reporting the
// shadowed layer turns an invisible precedence rule into a visible one.
describe('project get reports the winning layer and what it shadowed', () => {
  let cacheDir: string;
  let repo: string;

  beforeEach(() => {
    cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-layers-cache-'));
    repo = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-layers-repo-'));
    fs.mkdirSync(path.join(repo, '.git'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(cacheDir, { recursive: true, force: true });
    fs.rmSync(repo, { recursive: true, force: true });
  });

  function commit(contents: Record<string, unknown>, dir = repo): void {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, COMMITTED_CONFIG_FILE), JSON.stringify(contents));
  }

  const get = (env: NodeJS.ProcessEnv = {}, cwd = repo) =>
    runProjectCommand(['project', 'get', '--cwd', cwd], { cacheDir, env });

  // The upward walk means the governing file is often not in the directory the
  // caller is standing in, so "a committed file" is not an answer.
  it('names the winning committed file by absolute path', () => {
    commit({ projectUrl: 'https://committed.form.io' });
    const nested = path.join(repo, 'apps', 'web');
    fs.mkdirSync(nested, { recursive: true });

    const result = get({}, nested);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain(path.join(repo, COMMITTED_CONFIG_FILE));
  });

  it('reports a personal mapping shadowed by a committed file, naming its project', () => {
    commit({ projectUrl: 'https://committed.form.io' });
    writeProjectEntry({
      cwd: repo,
      env: { FORMIO_PROJECT_URL: 'https://mapped.form.io' },
      cacheDir: cacheDir,
    });

    const result = get();

    expect(result.stdout).toContain('https://committed.form.io');
    expect(result.stdout).toMatch(/shadow/i);
    expect(result.stdout).toContain('https://mapped.form.io');
  });

  it('reports an environment value shadowed by a file rather than omitting it', () => {
    commit({ projectUrl: 'https://committed.form.io' });

    const result = get({ FORMIO_PROJECT_URL: 'https://env-project.form.io' });

    expect(result.stdout).toMatch(/shadow/i);
    expect(result.stdout).toContain('https://env-project.form.io');
  });

  it('reports an environment value shadowed by a mapping', () => {
    writeProjectEntry({
      cwd: repo,
      env: { FORMIO_PROJECT_URL: 'https://mapped.form.io' },
      cacheDir: cacheDir,
    });

    const result = get({ FORMIO_PROJECT_URL: 'https://env-project.form.io' });

    expect(result.stdout).toContain('https://mapped.form.io');
    expect(result.stdout).toMatch(/shadow/i);
    expect(result.stdout).toContain('https://env-project.form.io');
  });

  it('reports no shadowing when only one layer supplies the project', () => {
    commit({ projectUrl: 'https://committed.form.io' });

    expect(get().stdout).not.toMatch(/shadow/i);
  });

  it('names both project set and formio.json when nothing is configured', () => {
    const result = get();

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain('project set');
    expect(result.stderr).toContain(COMMITTED_CONFIG_FILE);
  });

  it('exits 2 and names the path on a broken committed file', () => {
    fs.writeFileSync(path.join(repo, COMMITTED_CONFIG_FILE), '{ not json');

    const result = get();

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain(path.join(repo, COMMITTED_CONFIG_FILE));
    expect(result.stderr).not.toMatch(/No Form\.io project is configured/);
  });

  it('names the committed edit that records the pair when the base URL is unresolved', () => {
    commit({ projectUrl: 'https://myproject.mysite.com' });

    const result = get();

    expect(result.exitCode).toBe(EXIT_BASE_URL_UNRESOLVED);
    expect(result.stderr).toContain(path.join(repo, 'formio.json'));
    expect(result.stderr).toMatch(/"baseUrl"/);
    expect(result.stderr).toMatch(/JWT/i);
  });
});
