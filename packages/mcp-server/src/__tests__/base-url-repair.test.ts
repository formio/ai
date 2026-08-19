import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { readProjectEntry, writeProjectEntry } from '../project-map.js';
import { runProjectCommand } from '../cli/project-command.js';
import { resolveProject } from '../project-resolver.js';
import { registerProjectSetTool } from '../tools/project_set.js';

// The half-configured directory — a project on record, its deployment
// underivable — is the shape this whole configuration surface exists to serve, so
// the remedy it prints has to be a command that RUNS. It named `project set
// --base-url ... --cwd ...` while both writers required a project URL from the
// working-directory mapping alone, which a repo-scoped project never puts there:
// the message sent the user to a command that answered "no project mapped yet"
// for a directory whose project it had just printed.
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

  const run = (args: string[]) => runProjectCommand(['project', ...args], { cacheDir, env: {} });

  describe('when the project came from a committed formio.json', () => {
    beforeEach(() => {
      commit({ projectUrl: 'https://myproject.mysite.com' });
    });

    it('accepts --base-url alone, the flag its own error names', () => {
      const result = run(['set', '--base-url', 'https://forms.mysite.com', '--cwd', repo]);

      expect(result.stderr).not.toMatch(/no project mapped yet/i);
      expect(result.exitCode).toBe(0);
    });

    it('runs the exact command the failing project get printed', () => {
      const remedy = run(['get', '--cwd', repo])
        .stderr.split('\n')
        .find((line) => line.startsWith('Run: formio-mcp project set'));
      expect(remedy).toBeDefined();

      const args = (remedy as string)
        .replace('Run: formio-mcp ', '')
        .split(' ')
        .slice(1)
        .map((token) => (token === '<base_url>' ? 'https://forms.mysite.com' : token));

      expect(run(args).exitCode).toBe(0);
      expect(run(['get', '--cwd', repo]).exitCode).toBe(0);
    });

    it('records only the deployment, leaving the project where it is committed', () => {
      run(['set', '--base-url', 'https://forms.mysite.com', '--cwd', repo]);

      const entry = readProjectEntry(repo, cacheDir);
      expect(entry?.env.FORMIO_BASE_URL).toBe('https://forms.mysite.com');
      expect(entry?.env.FORMIO_PROJECT_URL).toBeUndefined();
    });

    it('resolves the repaired pair afterwards', () => {
      run(['set', '--base-url', 'https://forms.mysite.com', '--cwd', repo]);

      const { config, sources } = resolveProject(repo, {}, { cacheDir, onNote: () => {} });

      expect(config.projectUrl).toBe('https://myproject.mysite.com');
      expect(config.baseUrl).toBe('https://forms.mysite.com');
      expect(sources.projectUrl).toBe('committed');
      expect(sources.baseUrl).toBe('mapping');
    });

    it('still refuses --base-url alone where nothing configures a project', () => {
      const bare = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-repair-bare-'));

      const result = run(['set', '--base-url', 'https://forms.mysite.com', '--cwd', bare]);

      expect(result.exitCode).toBe(2);
      expect(result.stderr).toMatch(/--project-url is required/);
      fs.rmSync(bare, { recursive: true, force: true });
    });
  });

  // The tool half of the same repair. An agent relaying the resolution error
  // reaches for project_set, not the shell, and requireBaseUrl's message tells it
  // to "pass baseUrl alongside the cwd" — with no project URL, because it
  // deliberately does not re-ask for one.
  describe('through the project_set tool', () => {
    async function call(args: Record<string, unknown>) {
      const server = new McpServer({ name: 'test', version: '0.0.0' });
      registerProjectSetTool(server, { cwd: () => repo, baseUrl: () => undefined });
      const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
      await server.connect(serverTransport);
      const client = new Client({ name: 'test-client', version: '0.0.0' });
      await client.connect(clientTransport);
      return client.callTool({ name: 'project_set', arguments: args });
    }

    it('accepts baseUrl alone against a committed project', async () => {
      commit({ projectUrl: 'https://myproject.mysite.com' });

      const result = await call({ baseUrl: 'https://forms.mysite.com', cwd: repo });

      expect(result.isError ?? false).toBe(false);
      expect(readProjectEntry(repo)?.env.FORMIO_BASE_URL).toBe('https://forms.mysite.com');
    });

    it('still requires a project URL where nothing configures one', async () => {
      const result = await call({ baseUrl: 'https://forms.mysite.com', cwd: repo });

      expect(result.isError).toBe(true);
      expect(JSON.stringify(result.content)).toMatch(/projectUrl is required/);
    });
  });
});

// A mapped base URL belongs to the project it was mapped with. Carrying it across
// a re-point leaves one deployment answering for another, and — because the
// mapping outranks derivation — it then answers for that directory forever. Same
// reasoning the environment global is already gated by, applied to the value the
// gate was reached through.
describe('re-pointing a directory at another project', () => {
  let cacheDir: string;

  beforeEach(() => {
    cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-repoint-'));
  });

  afterEach(() => {
    fs.rmSync(cacheDir, { recursive: true, force: true });
  });

  const set = (args: string[]) =>
    runProjectCommand(['project', 'set', ...args], { cacheDir, env: {} });

  const seed = (cwd: string) =>
    writeProjectEntry(
      cwd,
      {
        FORMIO_PROJECT_URL: 'https://myproject.mysite.com',
        FORMIO_BASE_URL: 'https://forms.mysite.com',
      },
      cacheDir
    );

  it('drops the previous deployment when the new project derives its own', () => {
    seed('/w/repoint');

    set(['--project-url', 'https://examples.form.io', '--cwd', '/w/repoint']);

    expect(readProjectEntry('/w/repoint', cacheDir)?.env.FORMIO_BASE_URL).toBeUndefined();
  });

  it('resolves the new project against its own deployment', () => {
    seed('/w/repoint-resolve');

    set(['--project-url', 'https://examples.form.io', '--cwd', '/w/repoint-resolve']);
    const { config, sources } = resolveProject(
      '/w/repoint-resolve',
      {},
      { cacheDir, onNote: () => {} }
    );

    expect(config.baseUrl).toBe('https://api.form.io');
    expect(sources.baseUrl).toBe('derived');
  });

  it('keeps the mapped deployment when the new project derives none', () => {
    seed('/w/repoint-underivable');

    set(['--project-url', 'https://other.mysite.com', '--cwd', '/w/repoint-underivable']);

    expect(readProjectEntry('/w/repoint-underivable', cacheDir)?.env.FORMIO_BASE_URL).toBe(
      'https://forms.mysite.com'
    );
  });

  // Not a re-point: the project is unchanged, so the recorded deployment is this
  // project's own explicit answer and outranks what its shape would imply.
  it('keeps an explicitly recorded deployment when the project does not change', () => {
    writeProjectEntry(
      '/w/reset-same',
      {
        FORMIO_PROJECT_URL: 'https://forms.mysite.com/myproject',
        FORMIO_BASE_URL: 'https://api.mysite.com',
      },
      cacheDir
    );

    set(['--project-url', 'https://forms.mysite.com/myproject', '--cwd', '/w/reset-same']);

    expect(readProjectEntry('/w/reset-same', cacheDir)?.env.FORMIO_BASE_URL).toBe(
      'https://api.mysite.com'
    );
  });

  it('keeps a deployment supplied in the same call as the new project', () => {
    seed('/w/repoint-explicit');

    set([
      '--project-url',
      'https://examples.form.io',
      '--base-url',
      'https://api.mysite.com',
      '--cwd',
      '/w/repoint-explicit',
    ]);

    expect(readProjectEntry('/w/repoint-explicit', cacheDir)?.env.FORMIO_BASE_URL).toBe(
      'https://api.mysite.com'
    );
  });
});
