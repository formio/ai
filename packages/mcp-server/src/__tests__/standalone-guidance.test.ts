import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { BASE_URL_UNRESOLVED_GUIDANCE } from '../config.js';
import { SERVER_INSTRUCTIONS, createServer } from '../server.js';
import { registerAllTools } from '../tools/index.js';
import { FormioConfig } from '../config.js';

// Used stand-alone — no skills installed, nothing but the server — every piece
// of configuration guidance has to come from the server itself. It describes ONE
// value to supply, the Project URL: baseUrl is not cosmetic — it builds the
// portal-login URL and keys the JWT cache — but it is DERIVED from the project
// URL wherever it can be, and asked for only in the one shape that names no
// deployment to derive from.
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

  it('declares instructions naming the Project URL as the one value, and project_set', async () => {
    const server = createServer();
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    const client = new Client({ name: 'test-client', version: '0.0.0' });
    await client.connect(clientTransport);

    const instructions = client.getInstructions();

    expect(instructions).toBeTruthy();
    expect(instructions).toContain('project_set');
    expect(instructions).toMatch(/project url/i);
    // The base URL is described, because a stand-alone agent has to know what it
    // is when the server asks for one — but never as a second value to collect
    // up front.
    expect(instructions).toMatch(/base url/i);
    expect(instructions).toMatch(/ONE value/);
    expect(instructions).toMatch(/derived rather than defaulted/i);
    expect(instructions).not.toMatch(/ask the user for two/i);
    expect(instructions).not.toMatch(/in a single round/i);
    expect(instructions).not.toMatch(/persist both/i);
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

  it('raises a resolution error that asks for the Project URL', async () => {
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
    // Asks for ONE value. The base URL is derived from whichever project URL the
    // user supplies, so guidance about it cannot be acted on yet.
    expect(text).toMatch(/Project URL/i);
    expect(text).toContain('https://examples.form.io');
    expect(text).not.toMatch(/--base-url/);
    await client.close();
  });

  it('tells project_set callers the base URL is normally derived', async () => {
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
  // The instructions describe the ONE value a user supplies. They no longer recite
  // the base-URL invariant, because the server derives that value rather than
  // asking for it — stating it invited the two-co-equal-values framing this
  // configuration surface exists to remove.
  it('states the project-URL shapes and rules out the wrong ones', () => {
    expect(SERVER_INSTRUCTIONS).toMatch(/Project URL/i);
    expect(SERVER_INSTRUCTIONS).toMatch(/sub-?domain/i);
    expect(SERVER_INSTRUCTIONS).toMatch(/sub-?domain/i);
    expect(SERVER_INSTRUCTIONS).toMatch(/sub-?director(y|ies)/i);
    expect(SERVER_INSTRUCTIONS).toContain('*.form.io host is never a Base URL');
    expect(SERVER_INSTRUCTIONS).toContain('https://api.form.io/<project> is not a hosted');
  });

  // The sub-domain shape is the one that breaks the tempting shortcuts: the two
  // hosts differ on purpose, so neither can be built from the other.
  // The never-append rule is about PROJECT URLs and stays in the instructions. The
  // never-derive-a-base-URL rule moved to the message raised when a base URL cannot
  // be derived, which is the only place a reader can act on it.
  it('covers the customer sub-domain shape and forbids building one URL from the other', () => {
    expect(SERVER_INSTRUCTIONS).toContain('https://myproject.mysite.com');
    expect(SERVER_INSTRUCTIONS).toContain('https://forms.mysite.com');
    expect(SERVER_INSTRUCTIONS).toMatch(/never build a Project URL by appending/i);
    expect(BASE_URL_UNRESOLVED_GUIDANCE).toMatch(/cannot be derived/i);
    expect(BASE_URL_UNRESOLVED_GUIDANCE).toMatch(/sibling sub-?domain/i);
  });

  it('offers no path-style hosted project URL as an example anywhere in its guidance', () => {
    const examples = SERVER_INSTRUCTIONS.match(/https:\/\/api\.form\.io\/[a-z][\w-]*/g) ?? [];

    expect(examples).toEqual([]);
  });
});
