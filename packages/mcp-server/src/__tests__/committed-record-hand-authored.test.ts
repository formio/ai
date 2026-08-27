import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { runProjectCommand } from '../cli/project-command.js';
import { registerProjectGetTool } from '../tools/project_get.js';
import { registerProjectSetTool } from '../tools/project_set.js';
import { connectTools } from './test-helpers.js';

/**
 * The committed formio.json is a record the server READS and never writes. It is
 * designed for hand authorship — two keys, versioned, reviewed in a diff — and the
 * server cannot write it safely: the reader tolerates a formio.json this server did
 * not define (any stray file by that name in the user's repository), and a writer
 * that lands on such a file either corrupts it or holds a refusal nobody can act on.
 * The reader disowns those files; a writer cannot.
 *
 * So every message that used to name a `--scope repo` write instead instructs the
 * edit, naming the exact file and the exact key — and this suite EXECUTES those
 * instructions: it performs the edit each message describes and asserts the next
 * read resolves what the message promised.
 */

describe('the committed record is hand-authored, and every instruction about it runs', () => {
  let cacheDir: string;
  let repo: string;

  beforeEach(() => {
    cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-hand-cache-'));
    repo = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-hand-repo-'));
    fs.mkdirSync(path.join(repo, '.git'), { recursive: true });
    fs.rmSync(path.join(os.homedir(), '.formio'), { recursive: true, force: true });
  });

  afterEach(() => {
    fs.rmSync(cacheDir, { recursive: true, force: true });
    fs.rmSync(repo, { recursive: true, force: true });
  });

  const committedPath = () => path.join(repo, 'formio.json');

  const getCli = (env: NodeJS.ProcessEnv = {}) =>
    runProjectCommand(['project', 'get', '--cwd', repo], { cacheDir, env });

  const toolClient = async (env: NodeJS.ProcessEnv = {}) => {
    return connectTools((server) => {
      registerProjectSetTool(server, { cwd: () => repo, projectUrl: () => env.FORMIO_PROJECT_URL });
      registerProjectGetTool(
        server,
        { projectUrl: env.FORMIO_PROJECT_URL, baseUrl: env.FORMIO_BASE_URL },
        { cwd: () => repo }
      );
    });
  };

  const callTool = async (
    client: Client,
    name: string,
    args: Record<string, unknown>
  ): Promise<{
    isError?: boolean;
    text: string;
    structured?: Record<string, unknown>;
  }> => {
    const result = (await client.callTool({ name, arguments: args })) as unknown as {
      isError?: boolean;
      content: Array<{ text: string }>;
      structuredContent?: Record<string, unknown>;
    };
    return {
      isError: result.isError,
      text: result.content.map((entry) => entry.text).join('\n'),
      structured: result.structuredContent,
    };
  };

  describe('the CLI refuses the removed scope flag rather than writing elsewhere', () => {
    it('rejects --scope as an unknown flag', () => {
      const result = runProjectCommand(
        ['project', 'set', '--project-url', 'https://x.form.io', '--scope', 'repo', '--cwd', repo],
        { cacheDir, env: {} }
      );
      expect(result.exitCode, result.stderr).toBe(2);
      expect(result.stderr).toMatch(/Unknown flag: --scope/);
      // Nothing was recorded anywhere.
      expect(fs.existsSync(committedPath())).toBe(false);
      expect(fs.existsSync(path.join(cacheDir, 'projects.json'))).toBe(false);
    });

    it('rejects any unknown flag', () => {
      const result = runProjectCommand(
        ['project', 'set', '--project-url', 'https://x.form.io', '--bogus', 'x', '--cwd', repo],
        { cacheDir, env: {} }
      );
      expect(result.exitCode, result.stderr).toBe(2);
      expect(result.stderr).toMatch(/Unknown flag: --bogus/);
    });
  });

  describe('a committed project whose deployment cannot be derived', () => {
    beforeEach(() =>
      fs.writeFileSync(
        committedPath(),
        JSON.stringify({ projectUrl: 'https://myproject.mysite.com' })
      )
    );

    it('CLI: names the file and the key, and the edit it describes resolves', () => {
      const result = getCli();
      expect(result.exitCode, result.stderr).toBe(3);
      expect(result.stderr).toContain(committedPath());
      expect(result.stderr).toMatch(/"baseUrl"/);
      expect(result.stderr).not.toMatch(/--scope/);

      // Perform the edit the message instructs.
      const config = JSON.parse(fs.readFileSync(committedPath(), 'utf8')) as Record<
        string,
        unknown
      >;
      fs.writeFileSync(
        committedPath(),
        JSON.stringify({ ...config, baseUrl: 'https://api.mysite.com' })
      );

      const after = getCli();
      expect(after.exitCode, after.stderr).toBe(0);
      expect(after.stdout).toContain('https://myproject.mysite.com');
      expect(after.stdout).toContain('https://api.mysite.com');
    });

    it('tool: names the file and the key, carries no project_set remedy, and the edit resolves', async () => {
      const client = await toolClient();
      const report = await callTool(client, 'project_get', { cwd: repo });
      expect(report.structured?.status).toBe('base-url-unresolved');
      expect(report.text).toContain(committedPath());
      expect(report.text).toMatch(/"baseUrl"/);
      // No structured call remedy: the fix is an edit to a file the message names,
      // and project_set writes only the machine-local mapping.
      expect(report.structured?.remedy).toBeUndefined();
      expect(report.text).not.toMatch(/scope/);

      const config = JSON.parse(fs.readFileSync(committedPath(), 'utf8')) as Record<
        string,
        unknown
      >;
      fs.writeFileSync(
        committedPath(),
        JSON.stringify({ ...config, baseUrl: 'https://api.mysite.com' })
      );

      const after = await callTool(client, 'project_get', { cwd: repo });
      expect(after.structured?.status, after.text).toBe('ok');
      expect(after.structured?.baseUrl).toBe('https://api.mysite.com');
    });
  });

  describe('a deployment offered while a committed file holds the project', () => {
    beforeEach(() =>
      fs.writeFileSync(
        committedPath(),
        JSON.stringify({ projectUrl: 'https://myproject.mysite.com' })
      )
    );

    it('CLI: refuses, names the file and the key, and the edit it describes resolves', () => {
      const result = runProjectCommand(
        ['project', 'set', '--base-url', 'https://api.mysite.com', '--cwd', repo],
        { cacheDir, env: {} }
      );
      expect(result.exitCode, result.stderr).toBe(1);
      expect(result.stderr).toContain(committedPath());
      expect(result.stderr).toMatch(/"baseUrl"/);
      expect(result.stderr).not.toMatch(/--scope/);

      const config = JSON.parse(fs.readFileSync(committedPath(), 'utf8')) as Record<
        string,
        unknown
      >;
      fs.writeFileSync(
        committedPath(),
        JSON.stringify({ ...config, baseUrl: 'https://api.mysite.com' })
      );
      const after = getCli();
      expect(after.exitCode, after.stderr).toBe(0);
      expect(after.stdout).toContain('https://api.mysite.com');
    });

    it('tool: refuses naming the file and the key', async () => {
      const client = await toolClient();
      const result = await callTool(client, 'project_set', {
        cwd: repo,
        baseUrl: 'https://api.mysite.com',
      });
      expect(result.isError).toBe(true);
      expect(result.text).toContain(committedPath());
      expect(result.text).toMatch(/"baseUrl"/);
      expect(result.text).not.toMatch(/scope/);
    });
  });

  describe('a mapping written under a committed file', () => {
    it('says the file governs and directs the change to an edit, naming no writer', () => {
      fs.writeFileSync(
        committedPath(),
        JSON.stringify({ projectUrl: 'https://committed.form.io' })
      );
      const result = runProjectCommand(
        ['project', 'set', '--project-url', 'https://committed.form.io', '--cwd', repo],
        { cacheDir, env: {} }
      );

      expect(result.exitCode, result.stderr).toBe(0);
      expect(result.stdout).toMatch(/does not take effect/);
      expect(result.stdout).not.toMatch(/--scope/);
    });
  });

  describe('an unusable committed file', () => {
    it('is repaired by fixing the file, exactly as the message instructs', () => {
      fs.writeFileSync(committedPath(), '{not json');
      const broken = getCli();
      expect(broken.exitCode, broken.stderr).toBe(2);
      expect(broken.stderr).toContain(committedPath());
      expect(broken.stderr).not.toMatch(/--scope|scope "repo"|scope: "repo"/);

      fs.writeFileSync(committedPath(), JSON.stringify({ projectUrl: 'https://ok.form.io' }));
      const after = getCli();
      expect(after.exitCode, after.stderr).toBe(0);
      expect(after.stdout).toContain('https://ok.form.io');
    });
  });

  describe('a hand-authored committed record is what the next read resolves', () => {
    it.each([
      ['a fresh file', {}, { projectUrl: 'https://fresh.form.io' }, 'https://api.form.io'],
      [
        'a file re-pointed to another project',
        {},
        { projectUrl: 'https://new.mysite.com', baseUrl: 'https://api.mysite.com' },
        'https://api.mysite.com',
      ],
      [
        'a file written while the environment names another project',
        { FORMIO_PROJECT_URL: 'https://env.form.io' },
        { projectUrl: 'https://committed.form.io' },
        'https://api.form.io',
      ],
    ])('%s', (_name, env, config, expectedBaseUrl) => {
      fs.writeFileSync(committedPath(), JSON.stringify(config));
      const result = getCli(env);
      expect(result.exitCode, result.stderr).toBe(0);
      expect(result.stdout).toContain(config.projectUrl);
      expect(result.stdout).toContain(expectedBaseUrl);
    });
  });
});
