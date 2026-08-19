import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { DEFAULT_BASE_URL, FormioConfig, PROJECT_URL_GUIDANCE, getConfig } from './config.js';
import { COMMITTED_CONFIG_FILE } from './committed-config.js';
import { registerAllTools } from './tools/index.js';
import { SERVER_VERSION } from './cli-launch.js';

// Re-exported from cli-launch.ts, which owns it alongside the runnable spelling
// of the CLI those messages print — one module that knows which published build
// this process is.
export { SERVER_VERSION };

// Surfaced at initialize, so this is the only configuration guidance an agent
// receives when the server is used stand-alone with no skills installed. It
// names no client, skill, or plugin: one server, one behaviour, every host.
export const SERVER_INSTRUCTIONS = [
  'Every Form.io tool here operates on one active project, and the server starts with none.',
  'There is ONE value to ask the user for before the first project-scoped call: the Project URL, the full URL of their Form.io project. Do not ask for a Base URL as well — that value is derived from the Project URL wherever it can be, so asking for it up front asks for something usually never needed.',
  PROJECT_URL_GUIDANCE,
  `The Base URL is the deployment hosting the project. It is DERIVED rather than defaulted: ${DEFAULT_BASE_URL} for a project on a form.io host, and for a sub-directory Project URL the value left by dropping its final path segment. For a path-less Project URL on any other host it cannot be derived at all — that shape names no deployment — so it stays unresolved and the first call that needs it fails asking for it alone. Wait for that failure rather than pre-empting it: the Base URL builds the portal-login URL and keys the cached token, so a guessed one sends the login to a deployment the user does not use.`,
  "Persist the Project URL with project_set, passing the cwd argument set to the user's current working directory. Every tool resolves its project on each call, so it takes effect immediately with no restart.",
  `There are three places a project can come from, and they resolve narrowest-scope-first: a committed ${COMMITTED_CONFIG_FILE} holding {"projectUrl": "...", "baseUrl": "..."} found by walking up from the working directory, then the per-directory mapping project_set writes, then FORMIO_PROJECT_URL and FORMIO_BASE_URL in the environment, which are the weakest.`,
  `Prefer the committed ${COMMITTED_CONFIG_FILE} when the target belongs to the application being built: it is tracked in version control, so it survives a clone and is visible in review. Write it with project_set's scope argument set to "repo", which records it in the application's own folder. The per-directory mapping is the right choice when the target belongs to this machine rather than to the code.`,
  'FORMIO_PROJECT_URL no longer pins the server: a committed file or a per-directory mapping overrides it, so project_set can redirect a directory whose environment names a different project. There is no variable that merely offers a project — the environment is already the weakest source, so a project set there suggests without pinning.',
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
