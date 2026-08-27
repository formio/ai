import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runProjectCommand } from '../cli/project-command.js';
import { registerProjectGetTool } from '../tools/project_get.js';
import { connectTools } from './test-helpers.js';

/**
 * The pair rule holds at READ time, for every record, including records no writer
 * produced: a hand-written formio.json, a hand-edited mapping entry, an environment
 * variable. Both writers already refuse an API-root project URL and a pair that
 * collapses onto one server; a reader that accepts the same values hands every tool a
 * deployment-root target the writers exist to prevent.
 *
 * The refusal is per-record, in that record's own repair vocabulary:
 * - a committed file fails naming the file, like every other unusable committed value;
 * - a mapping entry fails naming the entry and the project_set rewrite that replaces it;
 * - the environment — the weakest source, a suggestion — is ignored with a note, and
 *   resolution falls through to the interview.
 */

interface ReadResult {
  ok: boolean;
  exitCode?: number;
  projectUrl?: string;
  baseUrl?: string;
  status?: string;
  output: string;
}

describe('pair validity is enforced at read time, per record', () => {
  let cacheDir: string;
  let repo: string;

  beforeEach(() => {
    cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-pair-cache-'));
    repo = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-pair-repo-'));
    fs.mkdirSync(path.join(repo, '.git'), { recursive: true });
    fs.rmSync(path.join(os.homedir(), '.formio'), { recursive: true, force: true });
  });

  afterEach(() => {
    fs.rmSync(cacheDir, { recursive: true, force: true });
    fs.rmSync(repo, { recursive: true, force: true });
  });

  const committedPath = () => path.join(repo, 'formio.json');

  function commit(config: Record<string, string>) {
    fs.writeFileSync(committedPath(), JSON.stringify(config));
  }

  function seedCli(env: Record<string, string>) {
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(path.join(cacheDir, 'projects.json'), JSON.stringify({ [repo]: { env } }));
  }

  function seedTool(env: Record<string, string>) {
    const dir = path.join(os.homedir(), '.formio');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'projects.json'), JSON.stringify({ [repo]: { env } }));
  }

  const readCli = (env: NodeJS.ProcessEnv = {}): ReadResult => {
    const result = runProjectCommand(['project', 'get', '--cwd', repo], { cacheDir, env });
    return {
      ok: result.exitCode === 0,
      exitCode: result.exitCode,
      output: result.stdout + result.stderr,
      projectUrl: result.stdout.match(/Project URL: (\S+)/)?.[1],
      baseUrl: result.stdout.match(/Base URL:\s+(\S+)/)?.[1],
    };
  };

  const readTool = async (env: NodeJS.ProcessEnv = {}): Promise<ReadResult> => {
    const client = await connectTools((server) =>
      registerProjectGetTool(
        server,
        { projectUrl: env.FORMIO_PROJECT_URL, baseUrl: env.FORMIO_BASE_URL },
        { cwd: () => repo }
      )
    );
    const result = (await client.callTool({
      name: 'project_get',
      arguments: { cwd: repo },
    })) as unknown as {
      isError?: boolean;
      content: Array<{ text: string }>;
      structuredContent?: { status?: string; projectUrl?: string; baseUrl?: string };
    };
    return {
      ok: !result.isError && result.structuredContent?.status === 'ok',
      status: result.structuredContent?.status,
      projectUrl: result.structuredContent?.projectUrl,
      baseUrl: result.structuredContent?.baseUrl,
      output: result.content.map((entry) => entry.text).join('\n'),
    };
  };

  describe('an environment project that is the API root', () => {
    const env = { FORMIO_PROJECT_URL: 'https://api.form.io' };

    it('is ignored with a note, and the CLI reports not-configured', () => {
      const result = readCli(env);
      expect(result.exitCode, result.output).toBe(1);
      expect(result.output).toMatch(/Ignoring FORMIO_PROJECT_URL/);
      expect(result.output).toMatch(/API root/);
    });

    it('is ignored with a note, and the tool reports not-configured', async () => {
      const result = await readTool(env);
      expect(result.status, result.output).toBe('not-configured');
      expect(result.output).toMatch(/Ignoring FORMIO_PROJECT_URL/);
      expect(result.output).toMatch(/API root/);
    });
  });

  describe('an environment pair naming one server for both URLs', () => {
    const env = {
      FORMIO_PROJECT_URL: 'https://myproject.mysite.com',
      FORMIO_BASE_URL: 'https://myproject.mysite.com',
    };

    it('is ignored with a note naming the Open Source collapse, CLI', () => {
      const result = readCli(env);
      expect(result.exitCode, result.output).toBe(1);
      expect(result.output).toMatch(/Ignoring FORMIO_PROJECT_URL/);
      expect(result.output).toMatch(/Open Source/);
    });

    it('is ignored with a note naming the Open Source collapse, tool', async () => {
      const result = await readTool(env);
      expect(result.status, result.output).toBe('not-configured');
      expect(result.output).toMatch(/Open Source/);
    });
  });

  describe('a committed formio.json naming the API root as its project', () => {
    beforeEach(() => commit({ projectUrl: 'https://api.form.io' }));

    it('fails naming the file and the cause, CLI', () => {
      const result = readCli();
      expect(result.exitCode, result.output).toBe(2);
      expect(result.output).toContain(committedPath());
      expect(result.output).toMatch(/API root/);
    });

    it('fails naming the file and the cause, tool', async () => {
      const result = await readTool();
      expect(result.ok).toBe(false);
      expect(result.status).toBeUndefined();
      expect(result.output).toContain(committedPath());
      expect(result.output).toMatch(/API root/);
    });
  });

  describe('a committed formio.json whose pair collapses onto one server', () => {
    beforeEach(() =>
      commit({
        projectUrl: 'https://myproject.mysite.com',
        baseUrl: 'https://myproject.mysite.com',
      })
    );

    it('fails naming the file and the Open Source diagnosis, CLI', () => {
      const result = readCli();
      expect(result.exitCode, result.output).toBe(2);
      expect(result.output).toContain(committedPath());
      expect(result.output).toMatch(/Open Source/);
    });

    it('fails naming the file and the Open Source diagnosis, tool', async () => {
      const result = await readTool();
      expect(result.ok).toBe(false);
      expect(result.output).toContain(committedPath());
      expect(result.output).toMatch(/Open Source/);
    });
  });

  describe('a mapping entry naming the API root as its project', () => {
    it('fails naming the entry and the project_set rewrite, CLI', () => {
      seedCli({ FORMIO_PROJECT_URL: 'https://api.form.io' });
      const result = readCli();
      expect(result.exitCode, result.output).toBe(2);
      expect(result.output).toContain(repo);
      expect(result.output).toMatch(/API root/);
      expect(result.output).toMatch(/project_set|project set/);
    });

    it('fails naming the entry and the project_set rewrite, tool', async () => {
      seedTool({ FORMIO_PROJECT_URL: 'https://api.form.io' });
      const result = await readTool();
      expect(result.ok).toBe(false);
      expect(result.output).toContain(repo);
      expect(result.output).toMatch(/API root/);
      expect(result.output).toMatch(/project_set/);
    });
  });

  describe('a mapping entry whose pair collapses onto one server', () => {
    it('fails naming the entry and the Open Source diagnosis, CLI', () => {
      seedCli({
        FORMIO_PROJECT_URL: 'https://myproject.mysite.com',
        FORMIO_BASE_URL: 'https://myproject.mysite.com',
      });
      const result = readCli();
      expect(result.exitCode, result.output).toBe(2);
      expect(result.output).toContain(repo);
      expect(result.output).toMatch(/Open Source/);
      expect(result.output).toMatch(/project_set|project set/);
    });
  });

  describe('a record that can never win precedence', () => {
    it('does not fail the directory when its stranded value is unusable', () => {
      // The entry holds a deployment and no project, so it cannot win; its unusable
      // value must not fail a resolution it takes no part in.
      seedCli({ FORMIO_BASE_URL: 'notaurl' });
      const result = readCli({ FORMIO_PROJECT_URL: 'https://envproj.form.io' });
      expect(result.exitCode, result.output).toBe(0);
      expect(result.projectUrl).toBe('https://envproj.form.io');
    });

    it('does not fail the directory when a committed file governs over it', () => {
      commit({ projectUrl: 'https://committed.form.io' });
      seedCli({ FORMIO_PROJECT_URL: 'notaurl' });
      const result = readCli();
      expect(result.exitCode, result.output).toBe(0);
      expect(result.projectUrl).toBe('https://committed.form.io');
    });
  });

  describe('a winning mapping entry with an unusable value', () => {
    it('still fails entry-scoped, naming the value', () => {
      seedCli({ FORMIO_PROJECT_URL: 'https://myproject.mysite.com', FORMIO_BASE_URL: 'notaurl' });
      const result = readCli();
      expect(result.exitCode, result.output).toBe(2);
      expect(result.output).toMatch(/FORMIO_BASE_URL/);
      expect(result.output).toContain(repo);
    });

    it('still fails entry-scoped when the project itself is unusable', () => {
      seedCli({ FORMIO_PROJECT_URL: 'notaurl' });
      const result = readCli();
      expect(result.exitCode, result.output).toBe(2);
      expect(result.output).toMatch(/FORMIO_PROJECT_URL/);
    });
  });
});
