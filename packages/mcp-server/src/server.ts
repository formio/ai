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
  "Persist the Project URL with project_set, passing the cwd argument set to the user's current working directory. Every tool resolves its project on each call, so it needs no restart — but it governs only where the mapping is the record that wins: under a committed formio.json the mapping is the fallback, and project_set reports the pair that actually resolves plus an `ok` saying whether the directory can now serve a call.",
  'Before asking for anything, ask the server: call project_get with cwd set to the user\'s current working directory and branch on the `status` it returns. "ok" means both URLs resolved and you may proceed. "not-configured" means nothing is recorded for that directory — ask for the single value the message names and record it with project_set. "base-url-unresolved" means the project IS recorded and only its deployment is missing — ask the user for the Base URL alone, then do what the report names, which is NOT always a call: where a committed formio.json holds the project the remedy is an edit adding a "baseUrl" key to that file, this server never writes one, and a project_set carrying a baseUrl alone is refused there. A project and its deployment are recorded together in ONE record, so which call that is depends on which record holds the project, and the report names it rather than leaving you to compose one; it already carries the Project URL, so do not re-ask the user for it. A call that fails outright rather than returning a status could not answer at all — an unreadable map, a formio.json that will not parse — so relay it rather than interviewing, because project_set would fail for the same unreported reason.',
  `A project and its deployment are recorded TOGETHER, in one record: precedence picks the record and both values come from it, and a write leaves that record holding both — a Project URL that names no deployment (a path-less URL on a customer domain) has to be recorded with its Base URL in the same call. A Base URL identical to the Project URL is refused: that names an Open Source server, and these tools address a project under a deployment. There are three places a project can come from, and they resolve narrowest-scope-first: a committed ${COMMITTED_CONFIG_FILE} holding {"projectUrl": "...", "baseUrl": "..."} found by walking up from the working directory, then the per-directory mapping project_set writes, then FORMIO_PROJECT_URL and FORMIO_BASE_URL in the environment, which are the weakest.`,
  `Prefer the committed ${COMMITTED_CONFIG_FILE} when the target belongs to the application being built: it is tracked in version control, so it survives a clone and is visible in review. Write that file yourself, in the application's own folder — a JSON object holding {"projectUrl": "..."}, plus "baseUrl" only when it cannot be derived; this server reads it and never writes it. The per-directory mapping, written with project_set, is the right choice when the target belongs to this machine rather than to the code.`,
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
