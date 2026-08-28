import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readProjectEntry } from '../project-map.js';
import { runProjectCommand } from '../cli/project-command.js';
import { resolveProject } from '../project-resolver.js';

// The half-configured directory — a project on record, its deployment underivable —
// is the shape this configuration surface exists to serve, so the remedy it prints has
// to be a command that RUNS and that leaves the directory resolved.
//
// A record holds the project and its deployment together, so where the deployment goes
// depends on where the project already is: the mapping's own pair is amended in place,
// while a project held by a committed file or the environment needs the pair recorded
// where THAT project lives. The refusal names that write rather than splitting one
// configuration across two records.
describe('repairing an underivable base URL', () => {
  let cacheDir: string;
  let repo: string;

  beforeEach(() => {
    cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-repair-cache-'));
    repo = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-repair-repo-'));
    fs.mkdirSync(path.join(repo, '.git'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(cacheDir, { recursive: true, force: true });
    fs.rmSync(repo, { recursive: true, force: true });
  });

  const commit = (config: Record<string, string>) =>
    fs.writeFileSync(path.join(repo, 'formio.json'), JSON.stringify(config));

  const run = (args: string[], env: NodeJS.ProcessEnv = {}) =>
    runProjectCommand(['project', ...args], { cacheDir, env });

  describe('when the mapping holds the project', () => {
    beforeEach(() => {
      const written = run([
        'set',
        '--project-url',
        'https://myproject.mysite.com',
        '--base-url',
        'https://forms.mysite.com',
        '--cwd',
        repo,
      ]);
      expect(written.exitCode).toBe(0);
    });

    it('amends the pair in place when a new deployment is supplied', () => {
      const result = run(['set', '--base-url', 'https://api.mysite.com', '--cwd', repo]);

      expect(result.exitCode).toBe(0);
      expect(readProjectEntry(repo, cacheDir)?.env).toEqual({
        FORMIO_PROJECT_URL: 'https://myproject.mysite.com',
        FORMIO_BASE_URL: 'https://api.mysite.com',
      });
    });

    it('resolves the amended pair afterwards', () => {
      run(['set', '--base-url', 'https://api.mysite.com', '--cwd', repo]);
      const { config } = resolveProject(repo, {}, { cacheDir, onNote: () => {} });

      expect(config.projectUrl).toBe('https://myproject.mysite.com');
      expect(config.baseUrl).toBe('https://api.mysite.com');
    });
  });

  describe('when a committed formio.json holds the project', () => {
    beforeEach(() => commit({ projectUrl: 'https://myproject.mysite.com' }));

    it('reports the directory as half configured', () => {
      expect(run(['get', '--cwd', repo]).exitCode).toBe(3);
    });

    // Refused rather than written: the deployment belongs beside the project, and the
    // mapping is not where that project is. The committed file is hand-authored — this
    // command never writes it — so the refusal names the file and the key to add.
    it('refuses a deployment alone and names the edit that records the pair', () => {
      const result = run(['set', '--base-url', 'https://api.mysite.com', '--cwd', repo]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain(path.join(repo, 'formio.json'));
      expect(result.stderr).toContain('"baseUrl"');
      expect(result.stderr).toContain('https://myproject.mysite.com');
      expect(readProjectEntry(repo, cacheDir)).toBeNull();
    });

    it('the edit it describes records the pair in that file, which resolves it', () => {
      commit({ projectUrl: 'https://myproject.mysite.com', baseUrl: 'https://api.mysite.com' });

      const { config, sources } = resolveProject(repo, {}, { cacheDir, onNote: () => {} });
      expect(config.baseUrl).toBe('https://api.mysite.com');
      expect(sources.baseUrl).toBe('committed');
    });
  });

  describe('when only FORMIO_PROJECT_URL holds the project', () => {
    const env = { FORMIO_PROJECT_URL: 'https://myproject.mysite.com' };

    it('reports the directory as half configured', () => {
      expect(run(['get', '--cwd', repo], env).exitCode).toBe(3);
    });

    it('refuses a deployment alone and names the write that records the pair', () => {
      const result = run(['set', '--base-url', 'https://api.mysite.com', '--cwd', repo], env);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('--project-url https://myproject.mysite.com');
      expect(result.stderr).toContain('--base-url');
    });

    it('records the pair in the mapping, which then governs and resolves', () => {
      const written = run(
        [
          'set',
          '--project-url',
          'https://myproject.mysite.com',
          '--base-url',
          'https://api.mysite.com',
          '--cwd',
          repo,
        ],
        env
      );

      expect(written.exitCode).toBe(0);
      const { config, sources } = resolveProject(
        repo,
        { projectUrl: 'https://myproject.mysite.com' },
        { cacheDir, onNote: () => {} }
      );
      expect(config.baseUrl).toBe('https://api.mysite.com');
      expect(sources.baseUrl).toBe('mapping');
    });
  });

  // A project URL that names no deployment cannot be recorded alone: the record would
  // hold half a configuration, which is the shape every guard in the old design existed
  // to police.
  describe('recording a project that names no deployment', () => {
    it('refuses the write and names the value it needs', () => {
      const result = run(['set', '--project-url', 'https://myproject.mysite.com', '--cwd', repo]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('--base-url');
      expect(readProjectEntry(repo, cacheDir)).toBeNull();
    });

    it('accepts it when the deployment comes with it', () => {
      const result = run([
        'set',
        '--project-url',
        'https://myproject.mysite.com',
        '--base-url',
        'https://api.mysite.com',
        '--cwd',
        repo,
      ]);

      expect(result.exitCode).toBe(0);
    });
  });
});
