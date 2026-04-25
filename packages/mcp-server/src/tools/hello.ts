import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

export function registerHelloTool(server: McpServer) {
  server.tool(
    'hello',
    'Say hello — used to verify the server is working',
    { name: z.string().optional().describe('Name to greet') },
    async ({ name }) => ({
      content: [{ type: 'text', text: `Hello from formio-mcp, ${name ?? 'world'}!` }],
    })
  );
}
