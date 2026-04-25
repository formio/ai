import { describe, it, expect } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { registerHelloTool } from '../tools/hello.js';

async function createTestClient() {
  const server = new McpServer({ name: 'test', version: '0.0.0' });
  registerHelloTool(server);

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);

  const client = new Client({ name: 'test-client', version: '0.0.0' });
  await client.connect(clientTransport);

  return { client, server };
}

describe('hello tool', () => {
  it('greets the world by default', async () => {
    const { client } = await createTestClient();
    const result = await client.callTool({ name: 'hello', arguments: {} });
    expect(result.content).toEqual([{ type: 'text', text: 'Hello from formio-mcp, world!' }]);
  });

  it('greets a specific name', async () => {
    const { client } = await createTestClient();
    const result = await client.callTool({ name: 'hello', arguments: { name: 'Form.io' } });
    expect(result.content).toEqual([{ type: 'text', text: 'Hello from formio-mcp, Form.io!' }]);
  });

  it('is listed in available tools', async () => {
    const { client } = await createTestClient();
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name)).toContain('hello');
  });
});
