import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readProjectEntry } from '../project-map.js';
import { COMMITTED_CONFIG_FILE, findCommittedConfig } from '../committed-config.js';
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
  it('updates the nearest existing file when it already names this project', () => {
    fs.writeFileSync(
      path.join(repo, COMMITTED_CONFIG_FILE),
      JSON.stringify({ projectUrl: 'https://same.form.io' })
    );
    const nested = path.join(repo, 'apps', 'web');
    fs.mkdirSync(nested, { recursive: true });

    const result = run([
      '--project-url',
      'https://same.form.io',
      '--base-url',
      'https://api.form.io',
      '--scope',
      'repo',
      '--cwd',
      nested,
    ]);

    expect(result.exitCode).toBe(0);
    expect(committed(repo).baseUrl).toBe('https://api.form.io');
    expect(fs.existsSync(path.join(nested, COMMITTED_CONFIG_FILE))).toBe(false);
    expect(result.stdout).toContain(path.join(repo, COMMITTED_CONFIG_FILE));
  });

  // The read side walks up and takes the nearest file, so a monorepo's folders
  // can target different projects. Rewriting the ancestor instead made that
  // impossible to create AND silently re-pointed every sibling folder.
  describe('recording a different project for one folder', () => {
    const seedRoot = () =>
      fs.writeFileSync(
        path.join(repo, COMMITTED_CONFIG_FILE),
        JSON.stringify({ projectUrl: 'https://root.form.io' })
      );

    it('writes the file in the named directory', () => {
      seedRoot();
      const nested = path.join(repo, 'apps', 'web');
      fs.mkdirSync(nested, { recursive: true });

      const result = run([
        '--project-url',
        'https://web.form.io',
        '--scope',
        'repo',
        '--cwd',
        nested,
      ]);

      expect(result.exitCode).toBe(0);
      expect(committed(nested).projectUrl).toBe('https://web.form.io');
    });

    it('leaves the ancestor — and so the folders beside it — alone', () => {
      seedRoot();
      const nested = path.join(repo, 'apps', 'web');
      const sibling = path.join(repo, 'apps', 'api');
      fs.mkdirSync(nested, { recursive: true });
      fs.mkdirSync(sibling, { recursive: true });

      run(['--project-url', 'https://web.form.io', '--scope', 'repo', '--cwd', nested]);

      expect(committed(repo).projectUrl).toBe('https://root.form.io');
      expect(findCommittedConfig(sibling)?.projectUrl).toBe('https://root.form.io');
      expect(findCommittedConfig(nested)?.projectUrl).toBe('https://web.form.io');
    });

    // The caller asked to record a project and got a file in a directory they may
    // not have expected; unsaid, this write is indistinguishable from one that
    // re-pointed the whole tree.
    it('says which file still governs everything else', () => {
      seedRoot();
      const nested = path.join(repo, 'apps', 'web');
      fs.mkdirSync(nested, { recursive: true });

      const result = run([
        '--project-url',
        'https://web.form.io',
        '--scope',
        'repo',
        '--cwd',
        nested,
      ]);

      expect(result.stdout).toContain(path.join(repo, COMMITTED_CONFIG_FILE));
      expect(result.stdout).toContain('https://root.form.io');
    });

    it('rewrites the file in the caller’s own directory rather than shadowing it', () => {
      seedRoot();

      const result = run([
        '--project-url',
        'https://new.form.io',
        '--scope',
        'repo',
        '--cwd',
        repo,
      ]);

      expect(result.exitCode).toBe(0);
      expect(committed(repo).projectUrl).toBe('https://new.form.io');
    });
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
