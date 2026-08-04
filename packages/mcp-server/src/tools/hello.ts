import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { toMcpStructuredResult } from '../mcp-responses.js';
import { local } from '../tool-annotations.js';

export function registerHelloTool(server: McpServer) {
  server.registerTool(
    'hello',
    {
      description:
        'Say hello — a connectivity check that confirms the server is running and reachable. Needs no Form.io project or credentials, so it is the first thing to try when other tools fail.',
      inputSchema: { name: z.string().optional().describe('Name to greet') },
      outputSchema: { greeting: z.string().describe('The greeting this server produced') },
      annotations: local('Check the server is reachable', true),
    },
    async ({ name }) => {
      const greeting = `Hello from formio-mcp, ${name ?? 'world'}!`;
      // The greeting itself is the point of the text view; the payload exists so
      // a caller can read it without parsing prose.
      return toMcpStructuredResult({ greeting }, greeting);
    }
  );
}
