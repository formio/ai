import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { readFileSync } from 'fs';
import { createRequire } from 'module';
import { FormioConfig, getConfig } from './config.js';
import { registerAllTools } from './tools/index.js';

// Read from package.json rather than repeating the version here: clients show
// this in their server list, and a hand-maintained literal drifts silently —
// it had been reporting 0.1.0 since the first release.
function readPackageVersion(): string {
  try {
    const require = createRequire(import.meta.url);
    const pkg = JSON.parse(readFileSync(require.resolve('../package.json'), 'utf-8')) as {
      version?: string;
    };
    return pkg.version ?? '0.0.0';
  } catch {
    // Version reporting must never stop the server from starting.
    return '0.0.0';
  }
}

export const SERVER_VERSION = readPackageVersion();

export function createServer(config?: FormioConfig): McpServer {
  const resolvedConfig = config ?? getConfig();
  const server = new McpServer({ name: 'formio-mcp', version: SERVER_VERSION });
  registerAllTools(server, resolvedConfig);
  return server;
}
