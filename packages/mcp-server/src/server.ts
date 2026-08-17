import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { readFileSync } from 'fs';
import { createRequire } from 'module';
import { DEFAULT_BASE_URL, FormioConfig, getConfig } from './config.js';
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

// Surfaced at initialize, so this is the only configuration guidance an agent
// receives when the server is used stand-alone with no skills installed. It
// names no client, skill, or plugin: one server, one behaviour, every host.
export const SERVER_INSTRUCTIONS = [
  'Every Form.io tool here operates on one active project, and the server starts with none.',
  'Before the first project-scoped call, ask the user for two things in a single round: the Project URL (the full URL of their Form.io project) and the Base URL (the deployment hosting it).',
  `There are exactly three valid shapes for that pair. On Form.io's hosted cloud the Base URL is ALWAYS ${DEFAULT_BASE_URL} and the Project URL is the project name as a sub-domain of form.io — a project named examples is https://examples.form.io. On a deployment the customer hosts, the Base URL is that deployment's host, often a sub-domain of their own domain (https://forms.mysite.com), and the Project URL is EITHER a sibling sub-domain of the same parent domain (https://myproject.mysite.com) OR a sub-directory of the deployment (https://forms.mysite.com/myproject), depending on how that deployment routes projects.`,
  'Three rules follow. A *.form.io host is never a Base URL. https://api.form.io/<project> is not a hosted Project URL. And a Project URL whose host differs from the Base URL host is normal in the sub-domain shape, so never build a Project URL by appending a name to the Base URL, and never derive a Base URL from a Project URL that has no path — ask for it.',
  `The Base URL defaults to ${DEFAULT_BASE_URL}, which is correct for the hosted cloud and wrong for a self-hosted or on-premise deployment — it builds the login URL and keys the cached token, so ask for it rather than assuming.`,
  "Persist both with project_set, passing the cwd argument set to the user's current working directory. Every tool resolves its project from that mapping on each call, so it takes effect immediately with no restart.",
  'If FORMIO_DEFAULT_PROJECT_URL is set, it is a suggestion rather than a setting: offer it as the recommended answer, confirm it with the user, and persist it with project_set. It changes nothing on its own. FORMIO_PROJECT_URL is the opposite — it pins the server, and project_set cannot redirect it.',
  'Authentication is implicit: the first authenticated call opens a browser portal login when no valid token is cached.',
].join(' ');

export function createServer(config?: FormioConfig): McpServer {
  const resolvedConfig = config ?? getConfig();
  const server = new McpServer(
    { name: 'formio-mcp', version: SERVER_VERSION },
    { instructions: SERVER_INSTRUCTIONS }
  );
  registerAllTools(server, resolvedConfig);
  return server;
}
