// stripSchemaDialect reaches into the SDK's private handler table, and the SDK is a
// caret dependency, so a newer 1.x may move or rename that table. Trimming the
// tool list must never stop the server: when the table is not where it expects,
// the wrapper does nothing and tools/list is answered as the SDK emits it. (The
// budget test fails if stripping stops working under the installed SDK.)

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { stripSchemaDialect } from '../tool-list-schemas.js';
import { connectTools } from './test-helpers.js';

const registerProbe = (server: McpServer) =>
  server.registerTool('probe', { description: 'probe', inputSchema: { a: z.string() } }, () => ({
    content: [],
  }));

describe('stripSchemaDialect', () => {
  it('does nothing when the SDK has no handler table where it looks', () => {
    const server = { server: {} } as unknown as McpServer;
    expect(() => stripSchemaDialect(server)).not.toThrow();
  });

  it('does nothing when the handler table holds no tools/list handler', async () => {
    const client = await connectTools((server) => {
      stripSchemaDialect(server);
      registerProbe(server);
    });
    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name)).toEqual(['probe']);
  });

  it('strips $schema once the tools/list handler exists', async () => {
    const client = await connectTools((server) => {
      registerProbe(server);
      stripSchemaDialect(server);
    });
    const { tools } = await client.listTools();
    expect(tools[0].inputSchema).not.toHaveProperty('$schema');
  });
});
