import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { describe, expect, it } from 'vitest';
import { registerProjectSetTool } from '../tools/project_set.js';

// What the `baseUrl` argument's own description promises has to be what the writer
// does. It described an unconditional chain — "the base URL already mapped for this
// directory, and only then the global FORMIO_BASE_URL" — while both links are
// GATED: the mapped value is dropped when this call re-points the directory to a
// project that names its own deployment, and the global is offered only where it
// can be talking about this project at all. An agent reading the unconditional
// version expects a deployment to be carried onto a new project, and reports one
// that was not written.
describe('the baseUrl argument description', () => {
  const description = async (): Promise<string> => {
    const server = new McpServer({ name: 'test', version: '0.0.0' });
    registerProjectSetTool(server, { cwd: () => '/w/described' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    const client = new Client({ name: 'test-client', version: '0.0.0' });
    await client.connect(clientTransport);
    const { tools } = await client.listTools();
    const tool = tools.find((candidate) => candidate.name === 'project_set');
    const properties = tool?.inputSchema.properties as
      | Record<string, { description?: string }>
      | undefined;
    return properties?.baseUrl?.description ?? '';
  };

  it('says the mapped fallback is dropped when the project changes', async () => {
    const text = await description();

    expect(text).toMatch(/re-?point/i);
  });

  // The writer reads no global FORMIO_BASE_URL: a record supplies its own pair, so an
  // environment deployment belongs to the environment record and is never written into
  // a mapping beside another record's project. The description must not resurrect it.
  it('describes derivation and no environment fallback', async () => {
    const text = await description();

    expect(text).toMatch(/derive/i);
    expect(text).not.toContain('FORMIO_BASE_URL');
  });

  // No sentence may state either fallback as unconditional, or the gates above are
  // contradicted two clauses later.
  it('does not promise the chain unconditionally', async () => {
    const text = await description();

    expect(text).not.toContain('and only then to the global FORMIO_BASE_URL');
  });
});
