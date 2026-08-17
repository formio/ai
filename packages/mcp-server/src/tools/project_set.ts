import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { normalizeHttpUrl, readHttpUrlEnv } from '../config.js';
import { toMcpStructuredResult } from '../mcp-responses.js';
import { projectMappingShape } from '../output-schemas.js';
import { local } from '../tool-annotations.js';
import { readProjectEntry, writeProjectEntry } from '../project-map.js';

export interface ProjectSetOptions {
  cwd?: () => string;
  baseUrl?: () => string | undefined;
}

export function registerProjectSetTool(server: McpServer, options: ProjectSetOptions = {}) {
  const getServerCwd = options.cwd ?? (() => process.cwd());
  // Last-resort base URL: FORMIO_BASE_URL in the server environment is one
  // global value, so it only applies to a directory with no mapped base URL of
  // its own. An explicit baseUrl argument lets each cwd map to its own
  // deployment.
  //
  // Read through readHttpUrlEnv, never raw. Every shipped manifest sets this
  // from a host variable, and a client that does not expand it passes the
  // literal "${FORMIO_BASE_URL}" — truthy, so taken raw it reached
  // normalizeHttpUrl and threw out of the handler. The first project_set in a
  // fresh directory then failed, leaving no way to map any project at all.
  const getEnvBaseUrl =
    options.baseUrl ??
    (() => readHttpUrlEnv({ raw: process.env.FORMIO_BASE_URL, name: 'FORMIO_BASE_URL' }));
  server.registerTool(
    'project_set',
    {
      description: [
        'Set the active Form.io project for the given working directory by writing the URL to project.json file in formio configuration folder',
        'You MUST call this tool whenever the user asks to set, change, or switch the active Form.io project — do not merely acknowledge the request in text. Persisting the choice requires the tool call.',
        "The chosen URL is persisted to project.json file in the formio configuration folder keyed by the cwd argument when provided (or the MCP server process cwd otherwise). Pass the `cwd` argument whenever you know the user's current working directory — the server process cwd is fixed at spawn and may not match where the user actually is.",
        'Every Form.io tool resolves its project URL from this map on each call, so the new mapping takes effect immediately for subsequent tool calls from the same cwd.',
        'Pass baseUrl unless the project is on the Form.io hosted cloud. It builds the portal-login URL and keys the cached token, and it falls back to https://api.form.io — so omitting it on a self-hosted or on-premise deployment sends the login to the wrong host. Ask the user for it in the same round as the project URL rather than assuming the default.',
        'One exception: a FORMIO_PROJECT_URL set in the MCP server environment takes precedence over every mapping. When the server was launched pinned to a project that way, writing a mapping here will not redirect it — change the launch configuration instead.',
      ].join(' '),
      inputSchema: {
        projectUrl: z
          .url({ protocol: /^https?$/ })
          .describe(
            'Full URL of the Form.io project to activate. On the Form.io hosted cloud it is the project name as a sub-domain of form.io, e.g. https://examples.form.io. On a customer-hosted deployment it is either a sibling sub-domain of that customer’s domain, e.g. https://myproject.mysite.com, or a sub-directory of the deployment, e.g. https://forms.mysite.com/myproject — whichever that deployment uses.'
          ),
        cwd: z
          .string()
          .optional()
          .describe(
            "User's current working directory to key the persisted mapping against. Pass whenever known (e.g. from UserPromptSubmit hook context). Falls back to the MCP server's process.cwd() when omitted."
          ),
        baseUrl: z
          .url({ protocol: /^https?$/ })
          .optional()
          .describe(
            'Deployment URL for the Form.io Enterprise Server that hosts this project — https://api.form.io for the hosted cloud, or the customer’s own platform host such as https://forms.mysite.com. Never a project’s own sub-domain, and never carrying a path. Persisted per-cwd alongside the project URL so each directory can target a different deployment. When omitted it falls back to the base URL already mapped for this directory, and only then to the global FORMIO_BASE_URL — so changing a directory’s deployment requires passing it explicitly.'
          ),
      },
      outputSchema: projectMappingShape,
      // Writes only to the local project map — no Form.io request involved.
      annotations: local('Set the active project', false),
    },
    async ({ projectUrl, cwd, baseUrl: baseUrlArg }) => {
      const normalized = normalizeHttpUrl(projectUrl, 'projectUrl');
      const entryCwd = cwd ?? getServerCwd();
      const existing = readProjectEntry(entryCwd);
      const previousMapped = existing?.env.FORMIO_PROJECT_URL;
      const previousBase = existing?.env.FORMIO_BASE_URL;
      // Precedence: the explicit argument, then the base URL already mapped for
      // this directory, then the environment global. The mapping outranks the
      // global deliberately — it is the more specific answer for THIS directory
      // and the one resolveProjectConfig honours at resolve time. Environment
      // first would make the fallback unreachable in every plugin install, where
      // the manifests always set FORMIO_BASE_URL (defaulted to api.form.io): a
      // re-point at a sibling project would silently move a self-hosted
      // directory to the hosted cloud, which is what this order prevents. To
      // change a directory's deployment, pass baseUrl.
      // Falsy, not nullish: FORMIO_BASE_URL arrives from a host prompt the user
      // may have cleared, and an empty string is not a deployment. Stopping the
      // chain there would drop the mapped base URL exactly as omitting it did.
      const resolvedBase = baseUrlArg || previousBase || getEnvBaseUrl();
      const baseUrl = resolvedBase ? normalizeHttpUrl(resolvedBase, 'baseUrl') : undefined;
      // The server's process cwd is fixed at spawn; for a plugin-launched server
      // it is not the user's directory. Keying there still beats refusing — some
      // clients have no cwd to pass — but the caller has to be told, or the next
      // call that does pass a cwd misses the mapping and loops.
      const serverCwdWarning = cwd
        ? ''
        : ` Warning: no cwd argument was passed, so this mapping is keyed to the MCP server's own working directory. If that is not the user's directory, call project_set again with cwd set to it.`;

      if (previousMapped === normalized && previousBase === baseUrl) {
        const message = `Active project is already ${normalized} and persisted for ${entryCwd}; no change${serverCwdWarning}`;
        return toMcpStructuredResult(
          {
            ok: true,
            message,
            cwd: entryCwd,
            projectUrl: normalized,
            ...(baseUrl && { baseUrl }),
            changed: false,
          },
          message
        );
      }

      const env: Record<string, string> = { FORMIO_PROJECT_URL: normalized };
      if (baseUrl) {
        env.FORMIO_BASE_URL = baseUrl;
      }
      writeProjectEntry(entryCwd, env);
      const message =
        (previousMapped
          ? `Active project set to ${normalized} (was ${previousMapped}; persisted for ${entryCwd})`
          : `Active project set to ${normalized}; mapping persisted for ${entryCwd}`) +
        serverCwdWarning;
      return toMcpStructuredResult(
        {
          ok: true,
          message,
          cwd: entryCwd,
          projectUrl: normalized,
          ...(baseUrl && { baseUrl }),
          changed: true,
        },
        message
      );
    }
  );
}
