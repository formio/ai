import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { describe, expect, it } from 'vitest';
import { readProjectEntry, writeProjectEntry } from '../project-map.js';
import { registerProjectSetTool } from '../tools/project_set.js';

// The tool and the `project set` command are one behavior described twice, so the
// partial-update rule has to hold on both. An agent relaying the base-URL error
// reaches for the tool, not the shell.
describe('project_set accepts one URL at a time', () => {
  async function createTestClient() {
    const server = new McpServer({ name: 'test', version: '0.0.0' });
    registerProjectSetTool(server, {
      cwd: () => '/w/server-cwd',
    });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    const client = new Client({ name: 'test-client', version: '0.0.0' });
    await client.connect(clientTransport);
    return client;
  }

  async function call(args: Record<string, unknown>) {
    const client = await createTestClient();
    return client.callTool({ name: 'project_set', arguments: args });
  }

  it('updates only the base URL for a directory that already has a project', async () => {
    writeProjectEntry({
      cwd: '/w/tool-mapped',
      env: { FORMIO_PROJECT_URL: 'https://myproject.mysite.com' },
    });

    const result = await call({ baseUrl: 'https://forms.mysite.com', cwd: '/w/tool-mapped' });

    expect(result.isError ?? false).toBe(false);
    const entry = readProjectEntry('/w/tool-mapped');
    expect(entry?.env.FORMIO_BASE_URL).toBe('https://forms.mysite.com');
    expect(entry?.env.FORMIO_PROJECT_URL).toBe('https://myproject.mysite.com');
  });

  it('rejects a call supplying neither URL, naming both', async () => {
    writeProjectEntry({ cwd: '/w/tool-mapped2', env: { FORMIO_PROJECT_URL: 'https://x.form.io' } });

    const result = await call({ cwd: '/w/tool-mapped2' });

    expect(result.isError).toBe(true);
    expect(JSON.stringify(result.content)).toMatch(/projectUrl/);
    expect(JSON.stringify(result.content)).toMatch(/baseUrl/);
  });

  it('still requires a project URL for an unmapped directory', async () => {
    const result = await call({ baseUrl: 'https://forms.mysite.com', cwd: '/w/tool-unmapped' });

    expect(result.isError).toBe(true);
    expect(JSON.stringify(result.content)).toMatch(/projectUrl/);
  });
});
