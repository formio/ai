import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { readProjectEntry } from '../project-map.js';
import { registerProjectSetTool } from '../tools/project_set.js';

async function createTestClient(options?: { cwd?: () => string }) {
  const server = new McpServer({ name: 'test', version: '0.0.0' });
  registerProjectSetTool(server, options);

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);

  const client = new Client({ name: 'test-client', version: '0.0.0' });
  await client.connect(clientTransport);

  return { client };
}

function projectsJsonPath(): string {
  return path.join(os.homedir(), '.formio', 'projects.json');
}

describe('project_set tool', () => {
  const cwd = '/workspace/pkg-a';

  it('persists the chosen URL to projects.json for the cwd', async () => {
    const { client } = await createTestClient({ cwd: () => cwd });

    const result = await client.callTool({
      name: 'project_set',
      arguments: { projectUrl: 'https://api.form.io/next' },
    });

    expect(readProjectEntry(cwd)).toEqual({
      env: { FORMIO_PROJECT_URL: 'https://api.form.io/next' },
    });
    const [first] = result.content as Array<{ type: string; text: string }>;
    expect(first.text).toContain('https://api.form.io/next');
  });

  it('strips a trailing slash from the provided URL before persisting', async () => {
    const { client } = await createTestClient({ cwd: () => cwd });

    await client.callTool({
      name: 'project_set',
      arguments: { projectUrl: 'https://api.form.io/next/' },
    });

    expect(readProjectEntry(cwd)).toEqual({
      env: { FORMIO_PROJECT_URL: 'https://api.form.io/next' },
    });
  });

  it('rejects a value that is not a valid URL and does not write', async () => {
    const { client } = await createTestClient({ cwd: () => cwd });

    const result = await client.callTool({
      name: 'project_set',
      arguments: { projectUrl: 'not a url' },
    });

    expect(result.isError).toBe(true);
    expect(readProjectEntry(cwd)).toBeNull();
  });

  it('rejects a non-http protocol and does not write', async () => {
    const { client } = await createTestClient({ cwd: () => cwd });

    const result = await client.callTool({
      name: 'project_set',
      arguments: { projectUrl: 'ftp://api.form.io/next' },
    });

    expect(result.isError).toBe(true);
    expect(readProjectEntry(cwd)).toBeNull();
  });

  it('is listed in available tools', async () => {
    const { client } = await createTestClient({ cwd: () => cwd });
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name)).toContain('project_set');
  });

  it('reports the previous mapped URL in the success message when overwriting', async () => {
    const { client } = await createTestClient({ cwd: () => cwd });

    await client.callTool({
      name: 'project_set',
      arguments: { projectUrl: 'https://api.form.io/first' },
    });
    const result = await client.callTool({
      name: 'project_set',
      arguments: { projectUrl: 'https://api.form.io/second' },
    });

    const [first] = result.content as Array<{ type: string; text: string }>;
    expect(first.text).toContain('https://api.form.io/second');
    expect(first.text).toContain('was https://api.form.io/first');
    expect(readProjectEntry(cwd)).toEqual({
      env: { FORMIO_PROJECT_URL: 'https://api.form.io/second' },
    });
  });

  it('is a no-op when the on-disk mapping for cwd already matches', async () => {
    const { client } = await createTestClient({ cwd: () => cwd });

    await client.callTool({
      name: 'project_set',
      arguments: { projectUrl: 'https://api.form.io/same' },
    });
    const mtimeBefore = fs.statSync(projectsJsonPath()).mtimeMs;

    await new Promise((resolve) => setTimeout(resolve, 10));
    const result = await client.callTool({
      name: 'project_set',
      arguments: { projectUrl: 'https://api.form.io/same/' },
    });

    const [first] = result.content as Array<{ type: string; text: string }>;
    expect(first.text).toContain('already');
    expect(first.text).toContain('no change');
    const mtimeAfter = fs.statSync(projectsJsonPath()).mtimeMs;
    expect(mtimeAfter).toBe(mtimeBefore);
  });

  it('persists under the explicit cwd argument when provided, ignoring server cwd', async () => {
    const serverCwd = '/workspace/server-root';
    const userCwd = '/workspace/server-root/packages/inner';
    const { client } = await createTestClient({ cwd: () => serverCwd });

    await client.callTool({
      name: 'project_set',
      arguments: { projectUrl: 'https://api.form.io/next', cwd: userCwd },
    });

    expect(readProjectEntry(userCwd)).toEqual({
      env: { FORMIO_PROJECT_URL: 'https://api.form.io/next' },
    });
    expect(readProjectEntry(serverCwd)).toBeNull();
  });

  it('does not write to projects.json when the URL is rejected', async () => {
    const { client } = await createTestClient({ cwd: () => cwd });

    await client.callTool({
      name: 'project_set',
      arguments: { projectUrl: 'ftp://api.form.io/next' },
    });

    expect(readProjectEntry(cwd)).toBeNull();
  });
});
