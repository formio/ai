import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FormioConfig } from '../config.js';
import { resolveProjectConfig } from '../project-resolver.js';
import { registerAllTools } from '../tools/index.js';

// project_set is how any client — not just one with a session hook — points a
// working directory at a project. It must therefore be registered for everyone.
describe('project_set registration', () => {
  const originalEnv = process.env;
  const cwd = '/workspace/registration-test';

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.FORMIO_PROJECT_URL;
    delete process.env.FORMIO_BASE_URL;
    delete process.env.FORMIO_PLUGIN_CONTEXT;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  async function connect(config: FormioConfig = { baseUrl: 'https://api.form.io' }) {
    const server = new McpServer({ name: 'test', version: '0.0.0' });
    registerAllTools(server, config, { cwd: () => cwd });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    const client = new Client({ name: 'test-client', version: '0.0.0' });
    await client.connect(clientTransport);
    return client;
  }

  it('is listed with an empty environment', async () => {
    const client = await connect();

    const { tools } = await client.listTools();

    expect(tools.map((tool) => tool.name)).toContain('project_set');
  });

  it('is listed when a stale FORMIO_PLUGIN_CONTEXT is absent or present', async () => {
    process.env.FORMIO_PLUGIN_CONTEXT = '1';
    const client = await connect();

    const { tools } = await client.listTools();

    expect(tools.map((tool) => tool.name)).toContain('project_set');
  });

  it('writes a mapping that project resolution then reads', async () => {
    const client = await connect();

    await client.callTool({
      name: 'project_set',
      arguments: { projectUrl: 'https://registered.form.io' },
    });

    const resolved = resolveProjectConfig(cwd, { baseUrl: 'https://api.form.io' });
    expect(resolved.projectUrl).toBe('https://registered.form.io');
  });

  it('writes projects.json with owner-only permissions', async () => {
    const client = await connect();

    await client.callTool({
      name: 'project_set',
      arguments: { projectUrl: 'https://registered.form.io' },
    });

    const mode = fs.statSync(path.join(os.homedir(), '.formio', 'projects.json')).mode;
    expect(mode & 0o777).toBe(0o600);
  });

  it('states that an environment project URL takes precedence over the mapping', async () => {
    const client = await connect();

    const { tools } = await client.listTools();
    const projectSet = tools.find((tool) => tool.name === 'project_set');

    expect(projectSet?.description).toMatch(/FORMIO_PROJECT_URL/);
    expect(projectSet?.description).toMatch(/precedence|takes precedence|overrides/);
  });
});
