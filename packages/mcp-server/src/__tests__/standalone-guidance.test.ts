import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SERVER_INSTRUCTIONS, createServer } from '../server.js';
import { registerAllTools } from '../tools/index.js';
import { FormioConfig } from '../config.js';

// Used stand-alone — no skills installed, nothing but the server — every piece
// of configuration guidance has to come from the server itself. baseUrl is not
// cosmetic: it builds the portal-login URL and keys the JWT cache, so silently
// defaulting it to api.form.io points a self-hosted user at the wrong host.
describe('guidance for a stand-alone server', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.FORMIO_PROJECT_URL;
    delete process.env.FORMIO_BASE_URL;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('declares instructions naming both URLs and project_set', async () => {
    const server = createServer();
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    const client = new Client({ name: 'test-client', version: '0.0.0' });
    await client.connect(clientTransport);

    const instructions = client.getInstructions();

    expect(instructions).toBeTruthy();
    expect(instructions).toContain('project_set');
    expect(instructions).toMatch(/project url/i);
    expect(instructions).toMatch(/base url/i);
    await client.close();
  });

  it('names no client, skill, or plugin in its instructions', async () => {
    const server = createServer();
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    const client = new Client({ name: 'test-client', version: '0.0.0' });
    await client.connect(clientTransport);

    const instructions = client.getInstructions() ?? '';

    for (const forbidden of ['Claude', 'Cursor', 'Codex', 'Copilot', 'skill', 'plugin']) {
      expect(instructions, `instructions must not name ${forbidden}`).not.toContain(forbidden);
    }
    await client.close();
  });

  it('raises a resolution error that names the base URL and its default', async () => {
    const unconfigured: FormioConfig = { baseUrl: 'https://api.form.io' };
    const server = new McpServer({ name: 'test', version: '0.0.0' });
    registerAllTools(server, unconfigured);
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    const client = new Client({ name: 'test-client', version: '0.0.0' });
    await client.connect(clientTransport);

    const result = await client.callTool({
      name: 'form_list',
      arguments: { cwd: '/workspace/standalone-unmapped' },
    });
    const text = ((result?.content ?? []) as Array<{ type: string; text?: string }>)
      .filter((part) => part.type === 'text')
      .map((part) => part.text ?? '')
      .join('\n');

    expect(text).toContain('project_set');
    expect(text).toMatch(/base url/i);
    expect(text).toContain('https://api.form.io');
    await client.close();
  });

  it('describes what omitting the base URL costs on project_set', async () => {
    const server = createServer();
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    const client = new Client({ name: 'test-client', version: '0.0.0' });
    await client.connect(clientTransport);

    const { tools } = await client.listTools();
    const projectSet = tools.find((tool) => tool.name === 'project_set');

    expect(projectSet?.description).toMatch(/login/i);
    expect(projectSet?.description).toContain('https://api.form.io');
    await client.close();
  });

  // A bare agent has no skills to consult, so all three valid URL shapes have to
  // be in the instructions. Getting them wrong is not a cosmetic error: a wrong
  // base URL keys the token cache per project and builds a login URL against the
  // project subdomain instead of the deployment.
  it('states all three valid URL shapes and rules out the wrong ones', () => {
    expect(SERVER_INSTRUCTIONS).toMatch(/ALWAYS https:\/\/api\.form\.io/);
    expect(SERVER_INSTRUCTIONS).toMatch(/three valid shapes/i);
    expect(SERVER_INSTRUCTIONS).toMatch(/sub-?domain/i);
    expect(SERVER_INSTRUCTIONS).toMatch(/sub-?director(y|ies)/i);
    expect(SERVER_INSTRUCTIONS).toContain('*.form.io host is never a Base URL');
    expect(SERVER_INSTRUCTIONS).toContain('https://api.form.io/<project> is not a hosted');
  });

  // The sub-domain shape is the one that breaks the tempting shortcuts: the two
  // hosts differ on purpose, so neither can be built from the other.
  it('covers the customer sub-domain shape and forbids deriving either URL from the other', () => {
    expect(SERVER_INSTRUCTIONS).toContain('https://myproject.mysite.com');
    expect(SERVER_INSTRUCTIONS).toContain('https://forms.mysite.com');
    expect(SERVER_INSTRUCTIONS).toMatch(/never build a Project URL by appending/i);
    expect(SERVER_INSTRUCTIONS).toMatch(
      /never derive a Base URL from a Project URL that has no path/i
    );
  });

  it('offers no path-style hosted project URL as an example anywhere in its guidance', () => {
    const examples = SERVER_INSTRUCTIONS.match(/https:\/\/api\.form\.io\/[a-z][\w-]*/g) ?? [];

    expect(examples).toEqual([]);
  });
});
