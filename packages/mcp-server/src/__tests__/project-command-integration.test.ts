import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { resolve } from 'path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createServer } from '../server.js';
import { registerAllTools } from '../tools/index.js';
import { FormioConfig } from '../config.js';
import { runProjectCommand } from '../cli/project-command.js';
import { resolveProjectConfig } from '../project-resolver.js';

const packageRoot = resolve(__dirname, '../..');
const tsxEntry = resolve(packageRoot, 'node_modules/tsx/dist/cli.mjs');
const stdioEntry = resolve(packageRoot, 'src/stdio.ts');

const FORMIO_ENV_KEYS = [
  'FORMIO_BASE_URL',
  'FORMIO_PROJECT_URL',
  'FORMIO_API_KEY',
  'FORMIO_LOGIN_FORM',
];

// Adding argument branching to the bin risks the one path every client depends
// on. This spawns the real entry point with no arguments and completes an MCP
// handshake against it, so a regression in dispatch cannot pass unnoticed.
describe('bin invoked with no arguments', () => {
  let client: Client | undefined;

  afterEach(async () => {
    await client?.close();
    client = undefined;
  });

  async function inProcessToolNames(): Promise<string[]> {
    const server = createServer();
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    const inProcess = new Client({ name: 'test-client', version: '0.0.0' });
    await inProcess.connect(clientTransport);
    const { tools } = await inProcess.listTools();
    await inProcess.close();
    return tools.map((tool) => tool.name).sort();
  }

  it('serves the full tool list over a stdio transport', async () => {
    const childEnv: Record<string, string> = {
      PATH: process.env.PATH ?? '',
      HOME: process.env.HOME ?? '',
    };

    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [tsxEntry, stdioEntry],
      env: childEnv,
    });

    client = new Client({ name: 'test-client', version: '0.0.0' });
    await client.connect(transport);

    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name).sort()).toEqual(await inProcessToolNames());
  }, 60_000);
});

// The whole point of the command: a project configured before any client
// connected must resolve on the very first tool call, with no project_set call
// in between. This one drives the real ~/.formio cache dir, because that is
// what resolveProjectConfig reads — the cwd key is a path that does not exist.
describe('a project configured by the command', () => {
  const CONFIGURED_CWD = '/workspace/formio-cli-configured-cwd';
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    for (const key of FORMIO_ENV_KEYS) {
      delete process.env[key];
    }
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  // Stops at resolution rather than driving a tool end to end: every
  // project-scoped tool resolves through resolveProjectConfig and then makes a
  // real request, so calling one would test the network and the login flow
  // instead of the mapping.
  it('resolves through the servers project resolver with no prior project_set', () => {
    const written = runProjectCommand([
      'project',
      'set',
      '--project-url',
      'https://cli-configured.invalid/project',
      '--base-url',
      'https://cli-configured.invalid',
      '--cwd',
      CONFIGURED_CWD,
    ]);
    expect(written.exitCode).toBe(0);

    const unconfigured: FormioConfig = { baseUrl: 'https://api.form.io' };
    const resolved = resolveProjectConfig(CONFIGURED_CWD, unconfigured);

    expect(resolved.projectUrl).toBe('https://cli-configured.invalid/project');
    expect(resolved.baseUrl).toBe('https://cli-configured.invalid');
  });

  it('leaves an unmapped working directory raising the actionable tool error', async () => {
    const unconfigured: FormioConfig = { baseUrl: 'https://api.form.io' };
    const server = new McpServer({ name: 'test', version: '0.0.0' });
    registerAllTools(server, unconfigured);
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    const client = new Client({ name: 'test-client', version: '0.0.0' });
    await client.connect(clientTransport);

    const result = await client.callTool({
      name: 'form_list',
      arguments: { cwd: '/workspace/formio-cli-never-mapped' },
    });
    const text = ((result?.content ?? []) as Array<{ type: string; text?: string }>)
      .filter((part) => part.type === 'text')
      .map((part) => part.text ?? '')
      .join('\n');

    expect(text).toContain('No Form.io project is configured');
    await client.close();
  });
});
