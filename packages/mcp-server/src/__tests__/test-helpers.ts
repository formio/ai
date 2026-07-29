import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { FormioConfig, ResolvedFormioConfig } from '../config.js';
import { writeProjectEntry } from '../project-map.js';

export const TEST_PROJECT_URL = 'https://formio.invalid/example';

// Shape that tool handlers see AFTER resolveProjectConfig merges the mapped
// projectUrl into the baseConfig — asserted against by tests that inspect
// formioFetch call args.
export const TEST_BASE_URL = 'https://formio.invalid';

export const TEST_CONFIG: ResolvedFormioConfig = {
  baseUrl: TEST_BASE_URL,
  projectUrl: TEST_PROJECT_URL,
  apiKey: 'abc123',
};

export const TEST_CWD = '/workspace/test-cwd';

export interface ToolRegister {
  (server: McpServer, config: FormioConfig): void;
}

export interface CreateTestClientOptions {
  cwd?: string;
  projectUrl?: string;
  seed?: boolean;
}

export async function createTestClient(
  registerTool: ToolRegister,
  options: CreateTestClientOptions = {}
) {
  const cwd = options.cwd ?? TEST_CWD;
  if (options.seed !== false) {
    writeProjectEntry(cwd, {
      FORMIO_PROJECT_URL: options.projectUrl ?? TEST_PROJECT_URL,
    });
  }

  const server = new McpServer({ name: 'test', version: '0.0.0' });
  registerTool(server, TEST_CONFIG);

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);

  const client = new Client({ name: 'test-client', version: '0.0.0' });
  await client.connect(clientTransport);

  return { client, server, cwd };
}
