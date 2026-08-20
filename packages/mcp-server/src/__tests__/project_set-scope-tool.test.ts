import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readProjectEntry } from '../project-map.js';
import { COMMITTED_CONFIG_FILE } from '../committed-config.js';
import { registerProjectSetTool } from '../tools/project_set.js';

// The tool and the command are one behavior described twice, so the scope has to
// mean the same thing on both. An agent relaying the resolution error reaches for
// the tool, not the shell.
describe('project_set scope', () => {
  let repo: string;

  beforeEach(() => {
    repo = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-tool-scope-'));
    fs.mkdirSync(path.join(repo, '.git'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(repo, { recursive: true, force: true });
  });

  async function call(args: Record<string, unknown>) {
    const server = new McpServer({ name: 'test', version: '0.0.0' });
    registerProjectSetTool(server, { cwd: () => repo, baseUrl: () => undefined });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    const client = new Client({ name: 'test-client', version: '0.0.0' });
    await client.connect(clientTransport);
    return client.callTool({ name: 'project_set', arguments: args });
  }

  const committed = () =>
    JSON.parse(fs.readFileSync(path.join(repo, COMMITTED_CONFIG_FILE), 'utf8')) as Record<
      string,
      unknown
    >;

  it('writes the committed file for scope repo', async () => {
    const result = await call({ projectUrl: 'https://x.form.io', cwd: repo, scope: 'repo' });

    expect(result.isError ?? false).toBe(false);
    expect(committed().projectUrl).toBe('https://x.form.io');
  });

  it('writes the personal mapping when scope is omitted', async () => {
    const result = await call({ projectUrl: 'https://x.form.io', cwd: repo });

    expect(result.isError ?? false).toBe(false);
    expect(readProjectEntry(repo)?.env.FORMIO_PROJECT_URL).toBe('https://x.form.io');
    expect(fs.existsSync(path.join(repo, COMMITTED_CONFIG_FILE))).toBe(false);
  });

  it('says which file it wrote for scope repo', async () => {
    const result = await call({ projectUrl: 'https://x.form.io', cwd: repo, scope: 'repo' });

    expect(JSON.stringify(result.content)).toContain(COMMITTED_CONFIG_FILE);
  });

  it('describes both scopes in its tool description', async () => {
    const server = new McpServer({ name: 'test', version: '0.0.0' });
    registerProjectSetTool(server, { cwd: () => repo, baseUrl: () => undefined });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    const client = new Client({ name: 'test-client', version: '0.0.0' });
    await client.connect(clientTransport);

    const { tools } = await client.listTools();
    const description = tools.find((tool) => tool.name === 'project_set')?.description ?? '';

    expect(description).toContain(COMMITTED_CONFIG_FILE);
    expect(description).toMatch(/scope/i);
  });

  // The mapping file is ~/.formio/projects.json — plural, at a named path. The
  // description called it "project.json file in formio configuration folder",
  // which is a file that does not exist: an agent repeating it to the user sends
  // them to edit the wrong path, and the one real path is the one the CLI's own
  // usage text prints.
  it('names the mapping file by its real path', async () => {
    const server = new McpServer({ name: 'test', version: '0.0.0' });
    registerProjectSetTool(server, { cwd: () => repo, baseUrl: () => undefined });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    const client = new Client({ name: 'test-client', version: '0.0.0' });
    await client.connect(clientTransport);

    const { tools } = await client.listTools();
    const description = tools.find((tool) => tool.name === 'project_set')?.description ?? '';

    expect(description).toContain('~/.formio/projects.json');
    expect(description).not.toMatch(/project\.json/);
    expect(description).not.toMatch(/formio configuration folder/);
  });
});
