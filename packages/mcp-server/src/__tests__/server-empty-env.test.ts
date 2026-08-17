import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createServer } from '../server.js';

// Clients and registry crawlers launch the server with no configuration at all
// in order to read tools/list. Startup must therefore never depend on any
// FORMIO_* variable, and it must not depend on how the process was launched.
describe('createServer with an empty environment', () => {
  const originalEnv = process.env;

  const FORMIO_ENV_KEYS = [
    'FORMIO_BASE_URL',
    'FORMIO_PROJECT_URL',
    'FORMIO_API_KEY',
    'FORMIO_LOGIN_FORM',
    'FORMIO_FORCE_BROWSER',
    'FORMIO_PLUGIN_CONTEXT',
  ];

  beforeEach(() => {
    process.env = { ...originalEnv };
    for (const key of FORMIO_ENV_KEYS) {
      delete process.env[key];
    }
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  async function listToolNames(): Promise<string[]> {
    const server = createServer();
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    const client = new Client({ name: 'test-client', version: '0.0.0' });
    await client.connect(clientTransport);
    const { tools } = await client.listTools();
    return tools.map((tool) => tool.name);
  }

  it('creates a server and completes the MCP handshake', async () => {
    await expect(listToolNames()).resolves.toBeInstanceOf(Array);
  });

  it('registers every Form.io tool', async () => {
    const names = await listToolNames();

    expect(names).toEqual(
      expect.arrayContaining([
        'hello',
        'form_create',
        'form_get',
        'form_list',
        'form_update',
        'form_revisions_list',
        'form_revision_get',
        'role_create',
        'role_list',
        'role_update',
        'action_types_list',
        'action_type_get',
        'action_create',
        'action_list',
        'action_get',
        'action_update',
        'action_delete',
        'project_export',
        'project_import',
      ])
    );
  });

  it('creates a server even when a stale FORMIO_PLUGIN_CONTEXT is present', async () => {
    process.env.FORMIO_PLUGIN_CONTEXT = '1';

    await expect(listToolNames()).resolves.toContain('form_list');
  });
});
