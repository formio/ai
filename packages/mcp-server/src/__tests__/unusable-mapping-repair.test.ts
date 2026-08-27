import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { readProjectEntry } from '../project-map.js';
import { runProjectCommand } from '../cli/project-command.js';
import { registerProjectSetTool } from '../tools/project_set.js';

// A mapping holding a project URL that is not a URL is what the resolver refuses,
// and the message it refuses with names `project_set` as the repair. Both writers
// then re-normalized the STORED value strictly — even when the caller supplied a
// replacement for it — so the documented repair failed with the very error it was
// run to clear, naming a value the caller never typed. The only remaining escape
// was hand-editing ~/.formio/projects.json, which every skill forbids outright.
//
// The base-URL half of the same entry was already read tolerantly for exactly this
// reason. This is the project-URL half held to the same rule: a stored value is
// data, not the caller's typing.
describe('repairing a mapping whose project URL is unusable', () => {
  let cacheDir: string;
  let repo: string;

  const write = (env: Record<string, string>) => {
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(path.join(cacheDir, 'projects.json'), JSON.stringify({ [repo]: { env } }));
  };

  beforeEach(() => {
    cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-unusable-cache-'));
    repo = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-unusable-repo-'));
    fs.mkdirSync(path.join(repo, '.git'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(cacheDir, { recursive: true, force: true });
    fs.rmSync(repo, { recursive: true, force: true });
  });

  describe('project set', () => {
    it('replaces the unusable value with the one the caller supplied', () => {
      write({ FORMIO_PROJECT_URL: 'notaurl' });

      const result = runProjectCommand(
        [
          'project',
          'set',
          '--project-url',
          'https://good.mysite.com',
          '--base-url',
          'https://api.mysite.com',
          '--cwd',
          repo,
        ],
        { cacheDir, env: {} }
      );

      expect(result.exitCode).toBe(0);
      expect(readProjectEntry(repo, cacheDir)).toEqual({
        env: {
          FORMIO_PROJECT_URL: 'https://good.mysite.com',
          FORMIO_BASE_URL: 'https://api.mysite.com',
        },
      });
    });

    it('leaves the directory resolvable afterwards', () => {
      write({ FORMIO_PROJECT_URL: 'notaurl' });
      runProjectCommand(
        ['project', 'set', '--project-url', 'https://forms.mysite.com/good', '--cwd', repo],
        { cacheDir, env: {} }
      );

      const result = runProjectCommand(['project', 'get', '--cwd', repo], { cacheDir, env: {} });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('https://forms.mysite.com/good');
    });

    // An unusable stored value is not a project, so it cannot stand in for the one
    // this call is missing: --base-url alone has nothing to attach a deployment to.
    //
    // It is also not ABSENT, which is the part that used to go wrong. The entry still
    // governs this directory, so the refusal names it — and quotes the recorded value
    // back, because this entry is the only place it exists and the repair replaces it.
    it('is refused for a base URL alone, naming the entry and the value it holds', () => {
      write({ FORMIO_PROJECT_URL: 'notaurl' });

      const result = runProjectCommand(
        ['project', 'set', '--base-url', 'https://api.mysite.com', '--cwd', repo],
        { cacheDir, env: {} }
      );

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('notaurl');
      expect(result.stderr).toContain('--project-url');
    });
  });

  describe('the project_set tool', () => {
    const client = async () => {
      const server = new McpServer({ name: 'test', version: '0.0.0' });
      registerProjectSetTool(server, {
        cwd: () => repo,
        projectUrl: () => undefined,
      });
      const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
      await server.connect(serverTransport);
      const connected = new Client({ name: 'test-client', version: '0.0.0' });
      await connected.connect(clientTransport);
      return connected;
    };

    // The tool writes to the real default cache dir, which setup.ts points at a
    // per-worker tmp HOME. Its entry is keyed by the same repo path.
    const writeDefault = (env: Record<string, string>) => {
      const dir = path.join(os.homedir(), '.formio');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'projects.json'), JSON.stringify({ [repo]: { env } }));
    };

    it('replaces the unusable value with the one the caller supplied', async () => {
      writeDefault({ FORMIO_PROJECT_URL: 'notaurl' });
      const connected = await client();

      const result = await connected.callTool({
        name: 'project_set',
        arguments: {
          projectUrl: 'https://good.mysite.com',
          baseUrl: 'https://api.mysite.com',
          cwd: repo,
        },
      });

      expect(result.isError).toBeFalsy();
      expect(readProjectEntry(repo)).toEqual({
        env: {
          FORMIO_PROJECT_URL: 'https://good.mysite.com',
          FORMIO_BASE_URL: 'https://api.mysite.com',
        },
      });
    });

    it('is refused for a baseUrl alone, naming the entry and the value it holds', async () => {
      writeDefault({ FORMIO_PROJECT_URL: 'notaurl' });
      const connected = await client();

      const result = await connected.callTool({
        name: 'project_set',
        arguments: { baseUrl: 'https://api.mysite.com', cwd: repo },
      });

      expect(result.isError).toBe(true);
      expect(JSON.stringify(result.content)).toContain('notaurl');
      expect(JSON.stringify(result.content)).toContain('projectUrl');
    });
  });
});

// What the command says it did is what formio-mcp-setup relays to the user, so the
// headline has to name the value that actually changed. It branched on "is there a
// project URL to write" — true whenever one was already mapped — so a --base-url
// call reported "Project set" for a call that set no project.
describe('what a base-URL-only update reports', () => {
  let cacheDir: string;
  let repo: string;

  beforeEach(() => {
    cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-label-cache-'));
    repo = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-label-repo-'));
    fs.mkdirSync(path.join(repo, '.git'), { recursive: true });
    runProjectCommand(
      [
        'project',
        'set',
        '--project-url',
        'https://myproject.mysite.com',
        '--base-url',
        'https://forms.mysite.com',
        '--cwd',
        repo,
      ],
      { cacheDir, env: {} }
    );
  });

  afterEach(() => {
    fs.rmSync(cacheDir, { recursive: true, force: true });
    fs.rmSync(repo, { recursive: true, force: true });
  });

  it('names the Base URL, not the project, when only the deployment was passed', () => {
    const result = runProjectCommand(
      ['project', 'set', '--base-url', 'https://api.mysite.com', '--cwd', repo],
      { cacheDir, env: {} }
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout.split('\n')[0]).toContain('Base URL set for');
  });

  it('still names the project when a project URL was passed', () => {
    const result = runProjectCommand(
      [
        'project',
        'set',
        '--project-url',
        'https://other.mysite.com',
        '--base-url',
        'https://forms.mysite.com',
        '--cwd',
        repo,
      ],
      { cacheDir, env: {} }
    );

    expect(result.stdout.split('\n')[0]).toContain('Project set for');
  });

  // The line below the headline still reports both, so nothing is lost by naming
  // only what changed.
  it('reports the project it left alone underneath', () => {
    const result = runProjectCommand(
      ['project', 'set', '--base-url', 'https://api.mysite.com', '--cwd', repo],
      { cacheDir, env: {} }
    );

    expect(result.stdout).toContain('Project URL: https://myproject.mysite.com');
    expect(result.stdout).toContain('Base URL:    https://api.mysite.com');
  });
});
