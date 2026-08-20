import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { runProjectCommand } from '../cli/project-command.js';
import { resolveProject } from '../project-resolver.js';
import { registerProjectSetTool } from '../tools/project_set.js';

// Both writers computed "what this directory will resolve to once the write
// lands" as `mapping ?? committed`, but resolution runs the other way round: a
// committed formio.json outranks the mapping. With both on record for one
// directory the writers therefore answered about a project that does NOT govern
// it — reporting it as active, and asking the base-URL derivation questions
// against it.
describe('a committed formio.json outranks the mapping', () => {
  let cacheDir: string;
  let repo: string;

  beforeEach(() => {
    cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-outranks-cache-'));
    repo = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-outranks-repo-'));
    fs.mkdirSync(path.join(repo, '.git'), { recursive: true });
    // The committed file names one project; the mapping is about to name another.
    fs.writeFileSync(
      path.join(repo, 'formio.json'),
      JSON.stringify({ projectUrl: 'https://committed.form.io' })
    );
  });

  afterEach(() => {
    fs.rmSync(cacheDir, { recursive: true, force: true });
    fs.rmSync(repo, { recursive: true, force: true });
  });

  const run = (args: string[]) => runProjectCommand(['project', ...args], { cacheDir, env: {} });

  const callTool = async (args: Record<string, unknown>) => {
    const server = new McpServer({ name: 'test', version: '0.0.0' });
    // The tool has no cacheDir seam: setup.ts redirects HOME to a per-worker tmp
    // dir, so the mapping it writes lands there rather than in the real
    // ~/.formio. Only the reported message matters to this test.
    registerProjectSetTool(server, { baseUrl: () => undefined });
    const client = new Client({ name: 'test-client', version: '0.0.0' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    const result = (await client.callTool({ name: 'project_set', arguments: args })) as {
      content: { text: string }[];
    };
    await client.close();
    return result.content.map((entry) => entry.text).join('\n');
  };

  it('is the project `project set` reports as active, not the one it just mapped', () => {
    const result = run(['set', '--project-url', 'https://mapped.form.io', '--cwd', repo]);

    // The mapping write itself is legitimate — it is what a later removal of the
    // committed file falls back to — but the directory resolves to the committed
    // project, and saying otherwise sends the user to look for their forms in the
    // wrong project.
    expect(resolveProject(repo, {}, { cacheDir, onNote: () => {} }).config.projectUrl).toBe(
      'https://committed.form.io'
    );
    expect(result.stdout + result.stderr).toContain('https://committed.form.io');
    expect(result.stdout + result.stderr).toMatch(/formio\.json/);
  });

  it('is the project the project_set tool reports as active', async () => {
    const text = await callTool({ projectUrl: 'https://mapped.form.io', cwd: repo });

    expect(text).toContain('https://committed.form.io');
    expect(text).toMatch(/formio\.json/);
  });

  // The derivation questions are the sharp end: they decide whether a mapped
  // base URL is carried or dropped, and whether the caller is asked for one at
  // all. Asked against the wrong project they can answer backwards — here the
  // committed project derives its own deployment (api.form.io) while the mapped
  // one, a path-less customer domain, does not.
  it('answers the base-URL derivation question against the governing project', () => {
    fs.writeFileSync(
      path.join(repo, 'formio.json'),
      JSON.stringify({ projectUrl: 'https://committed.form.io' })
    );

    const result = run(['set', '--project-url', 'https://myproject.mysite.com', '--cwd', repo]);

    // The governing project is on form.io, so its deployment is derivable and
    // nothing should demand a base URL for this directory.
    expect(result.stderr).not.toMatch(/base url/i);
    expect(result.exitCode).toBe(0);
  });
});
