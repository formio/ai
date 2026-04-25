import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { FormioConfig, getConfig } from './config.js';
import { registerAllTools } from './tools/index.js';

export function createServer(config?: FormioConfig): McpServer {
  const resolvedConfig = config ?? getConfig();
  const server = new McpServer({ name: 'formio-mcp', version: '0.1.0' });
  registerAllTools(server, resolvedConfig);
  return server;
}
