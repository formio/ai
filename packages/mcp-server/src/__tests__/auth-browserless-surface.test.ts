import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FormioConfig } from '../config.js';
import { authenticate } from '../auth.js';
import { ensureAuthenticated, resetAuthState } from '../ensure-auth.js';
import { registerFormListTool } from '../tools/form_list.js';
import { writeProjectEntry } from '../project-map.js';

vi.mock('../auth.js', () => ({ authenticate: vi.fn() }));

const CWD = '/workspace/browserless-surface';

describe('browserless failures on the tool surface', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.SSH_CONNECTION;
    delete process.env.SSH_TTY;
    process.env.CI = 'true';
    resetAuthState();
    vi.mocked(authenticate).mockReset();
  });

  afterEach(() => {
    process.env = originalEnv;
    resetAuthState();
  });

  it('reaches the client as a tool error, leaving the server usable', async () => {
    vi.mocked(authenticate).mockRejectedValue(
      new Error(
        'This environment has no browser available (CI). Set FORMIO_API_KEY instead, publish a port with FORMIO_AUTH_HOST and FORMIO_AUTH_PORT, or set FORMIO_FORCE_BROWSER=1 to try anyway.'
      )
    );
    writeProjectEntry(CWD, { FORMIO_PROJECT_URL: 'https://formio.invalid/example' });
    const config: FormioConfig = { baseUrl: 'https://formio.invalid' };
    const server = new McpServer({ name: 'test', version: '0.0.0' });
    registerFormListTool(server, config);
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    const client = new Client({ name: 'test-client', version: '0.0.0' });
    await client.connect(clientTransport);

    const result = await client.callTool({ name: 'form_list', arguments: { cwd: CWD } });

    expect(result.isError).toBe(true);
    const [first] = result.content as Array<{ type: string; text: string }>;
    expect(first.text).toMatch(/FORMIO_API_KEY/);

    // Still connected: a second call reaches the handler rather than a dead pipe.
    const again = await client.callTool({ name: 'form_list', arguments: { cwd: CWD } });
    expect(again.isError).toBe(true);
  });

  it('never starts the login flow in API-key mode, however browserless the host', async () => {
    await ensureAuthenticated({
      baseUrl: 'https://formio.invalid',
      projectUrl: 'https://formio.invalid/example',
      apiKey: 'abc123',
    });

    expect(vi.mocked(authenticate)).not.toHaveBeenCalled();
  });
});
