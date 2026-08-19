import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readProjectEntry } from '../project-map.js';
import { COMMITTED_CONFIG_FILE } from '../committed-config.js';
import { runProjectCommand } from '../cli/project-command.js';

// Two scopes, chosen explicitly. Inferring it — committed file if one exists,
// mapping otherwise — would make one command do two different things depending on
// the tree, and would let a routine `project set` modify a tracked file.
describe('project set --scope', () => {
  let cacheDir: string;
  let repo: string;

  beforeEach(() => {
    cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-scope-cache-'));
    repo = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-scope-repo-'));
    fs.mkdirSync(path.join(repo, '.git'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(cacheDir, { recursive: true, force: true });
    fs.rmSync(repo, { recursive: true, force: true });
  });

  const run = (args: string[]) =>
    runProjectCommand(['project', 'set', ...args], { cacheDir, env: {} });

  const committed = (dir: string) =>
    JSON.parse(fs.readFileSync(path.join(dir, COMMITTED_CONFIG_FILE), 'utf8')) as Record<
      string,
      unknown
    >;

  // Today's behavior, pinned so the default cannot drift.
  it('defaults to the personal scope and creates no committed file', () => {
    const result = run(['--project-url', 'https://x.form.io', '--cwd', repo]);

    expect(result.exitCode).toBe(0);
    expect(readProjectEntry(repo, cacheDir)?.env.FORMIO_PROJECT_URL).toBe('https://x.form.io');
    expect(fs.existsSync(path.join(repo, COMMITTED_CONFIG_FILE))).toBe(false);
  });

  it('writes the committed file in the named directory when none exists', () => {
    const nested = path.join(repo, 'apps', 'web');
    fs.mkdirSync(nested, { recursive: true });

    const result = run(['--project-url', 'https://x.form.io', '--scope', 'repo', '--cwd', nested]);

    expect(result.exitCode).toBe(0);
    expect(committed(nested).projectUrl).toBe('https://x.form.io');
    expect(fs.existsSync(path.join(repo, COMMITTED_CONFIG_FILE))).toBe(false);
    expect(result.stdout).toContain(path.join(nested, COMMITTED_CONFIG_FILE));
  });

  // "The nearest file" is not evident from the arguments, so the path is printed.
  it('updates the nearest existing file rather than creating a nested one', () => {
    fs.writeFileSync(
      path.join(repo, COMMITTED_CONFIG_FILE),
      JSON.stringify({ projectUrl: 'https://old.form.io' })
    );
    const nested = path.join(repo, 'apps', 'web');
    fs.mkdirSync(nested, { recursive: true });

    const result = run([
      '--project-url',
      'https://new.form.io',
      '--scope',
      'repo',
      '--cwd',
      nested,
    ]);

    expect(result.exitCode).toBe(0);
    expect(committed(repo).projectUrl).toBe('https://new.form.io');
    expect(fs.existsSync(path.join(nested, COMMITTED_CONFIG_FILE))).toBe(false);
    expect(result.stdout).toContain(path.join(repo, COMMITTED_CONFIG_FILE));
  });

  it('updates only the base URL of an existing committed file', () => {
    fs.writeFileSync(
      path.join(repo, COMMITTED_CONFIG_FILE),
      JSON.stringify({ projectUrl: 'https://myproject.mysite.com' })
    );

    const result = run([
      '--base-url',
      'https://forms.mysite.com',
      '--scope',
      'repo',
      '--cwd',
      repo,
    ]);

    expect(result.exitCode).toBe(0);
    expect(committed(repo)).toMatchObject({
      projectUrl: 'https://myproject.mysite.com',
      baseUrl: 'https://forms.mysite.com',
    });
  });

  it('fails in repo scope when neither URL is supplied', () => {
    const result = run(['--scope', 'repo', '--cwd', repo]);

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain('--project-url');
    expect(result.stderr).toContain('--base-url');
  });

  it('rejects an unknown scope, naming the valid values', () => {
    const result = run(['--project-url', 'https://x.form.io', '--scope', 'global', '--cwd', repo]);

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain('user');
    expect(result.stderr).toContain('repo');
  });

  it('preserves unknown keys when updating an existing file', () => {
    fs.writeFileSync(
      path.join(repo, COMMITTED_CONFIG_FILE),
      JSON.stringify({ $schema: './formio.schema.json', projectUrl: 'https://old.form.io' })
    );

    run(['--project-url', 'https://new.form.io', '--scope', 'repo', '--cwd', repo]);

    expect(committed(repo).$schema).toBe('./formio.schema.json');
  });
});
