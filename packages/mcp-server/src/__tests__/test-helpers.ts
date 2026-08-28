import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { FormioConfig, ResolvedFormioConfig } from '../config.js';
import { writeProjectEntry } from '../project-map.js';

// A project whose deployment is NOT its own origin.
//
// The deployment of a sub-directory project is its PARENT path, so this pair has
// `baseUrl !== new URL(projectUrl).origin` — and that inequality is the whole point.
// The previous fixture (`https://formio.invalid/example` on `https://formio.invalid`)
// was the one shape where the origin, the derived parent and the recorded deployment
// all coincide, so every assertion on the auth path co-varied: building the portal
// login URL, `${baseUrl}/current`, or the license probe from the PROJECT's host
// instead of the deployment passed the entire suite. Those are exactly the
// "a deployment you do not use" failures this design exists to prevent.
export const TEST_PROJECT_URL = 'https://formio.invalid/sub/example';

// Shape that tool handlers see AFTER resolveProjectConfig merges the mapped
// projectUrl into the baseConfig — asserted against by tests that inspect
// formioFetch call args.
export const TEST_BASE_URL = 'https://formio.invalid/sub';

export const TEST_CWD = '/workspace/test-cwd';

// Carries the cwd resolution resolved it for, like every resolved config does:
// the errors raised downstream name a `--cwd` repair command, and only resolution
// knows which directory the answer belongs to.
export const TEST_CONFIG: ResolvedFormioConfig = {
  baseUrl: TEST_BASE_URL,
  projectUrl: TEST_PROJECT_URL,
  apiKey: 'abc123',
  cwd: TEST_CWD,
  // These clients seed a mapping, so that is the record resolution reports — carried
  // for the same reason cwd is, because the errors raised downstream name the write
  // that reaches the record holding the project.
  projectUrlSource: 'mapping',
};

export interface ToolRegister {
  (server: McpServer, config: FormioConfig): void;
}

export interface CreateTestClientOptions {
  cwd?: string;
  projectUrl?: string;
  seed?: boolean;
}

/**
 * A connected client over whatever tools a test wants registered.
 *
 * `createTestClient` below serves the project-SCOPED tools: it seeds a mapping and
 * hands the registrar a resolved config. The project surface itself needs neither —
 * its tests supply their own cwd, their own environment, and often no mapping at
 * all — so they had each hand-rolled the same six lines of transport wiring, which
 * is six chances for one of them to differ from the others in a way nobody notices.
 */
export async function connectTools(register: (server: McpServer) => void): Promise<Client> {
  const server = new McpServer({ name: 'test', version: '0.0.0' });
  register(server);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: 'test-client', version: '0.0.0' });
  await client.connect(clientTransport);
  return client;
}

export async function createTestClient(
  registerTool: ToolRegister,
  options: CreateTestClientOptions = {}
) {
  const cwd = options.cwd ?? TEST_CWD;
  if (options.seed !== false) {
    writeProjectEntry({
      cwd: cwd,
      env: {
        FORMIO_PROJECT_URL: options.projectUrl ?? TEST_PROJECT_URL,
      },
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
