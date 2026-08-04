import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { toMcpStructuredResult } from '../mcp-responses.js';
import { projectMappingShape } from '../output-schemas.js';
import { local } from '../tool-annotations.js';
import { readProjectEntry, writeProjectEntry } from '../project-map.js';

function normalizeHttpUrl(input: string, label: string): string {
  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    throw new Error(`${label} must be a valid URL, got: ${input}`);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`${label} must use http or https, got: ${parsed.protocol}`);
  }
  return input.replace(/\/+$/, '');
}

export interface ProjectSetOptions {
  cwd?: () => string;
  baseUrl?: () => string | undefined;
}

export function registerProjectSetTool(server: McpServer, options: ProjectSetOptions = {}) {
  const getServerCwd = options.cwd ?? (() => process.cwd());
  // Fallback base URL when the caller does not pass one explicitly: the plugin
  // user-config sets FORMIO_BASE_URL in the server env (one global value). An
  // explicit baseUrl argument lets each cwd map to its own deployment.
  const getEnvBaseUrl = options.baseUrl ?? (() => process.env.FORMIO_BASE_URL);
  server.registerTool(
    'project_set',
    {
      description: [
        'Set the active Form.io project for the given working directory by writing the URL to project.json file in formio configuration folder',
        'You MUST call this tool whenever the user asks to set, change, or switch the active Form.io project — do not merely acknowledge the request in text. Persisting the choice requires the tool call.',
        "The chosen URL is persisted to project.json file in the formio configuration folder keyed by the cwd argument when provided (or the MCP server process cwd otherwise). Pass the `cwd` argument whenever you know the user's current working directory — the server process cwd is fixed at spawn and may not match where the user actually is.",
        'Every Form.io tool resolves its project URL from this map on each call, so the new mapping takes effect immediately for subsequent tool calls from the same cwd.',
      ].join(' '),
      inputSchema: {
        projectUrl: z
          .url({ protocol: /^https?$/ })
          .describe(
            'Full URL of the Form.io project to activate, e.g. https://api.form.io/my-project'
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
            'Deployment URL for the Form.io Enterprise Server that hosts this project, e.g. https://api.form.io. Persisted per-cwd alongside the project URL so each directory can target a different deployment. Falls back to the global FORMIO_BASE_URL when omitted.'
          ),
      },
      outputSchema: projectMappingShape,
      // Writes only to the local project map — no Form.io request involved.
      annotations: local('Set the active project', false),
    },
    async ({ projectUrl, cwd, baseUrl: baseUrlArg }) => {
      const normalized = normalizeHttpUrl(projectUrl, 'projectUrl');
      const resolvedBase = baseUrlArg ?? getEnvBaseUrl();
      const baseUrl = resolvedBase ? normalizeHttpUrl(resolvedBase, 'baseUrl') : undefined;
      const entryCwd = cwd ?? getServerCwd();
      const existing = readProjectEntry(entryCwd);
      const previousMapped = existing?.env.FORMIO_PROJECT_URL;
      const previousBase = existing?.env.FORMIO_BASE_URL;

      if (previousMapped === normalized && previousBase === baseUrl) {
        const message = `Active project is already ${normalized} and persisted for ${entryCwd}; no change`;
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
      const message = previousMapped
        ? `Active project set to ${normalized} (was ${previousMapped}; persisted for ${entryCwd})`
        : `Active project set to ${normalized}; mapping persisted for ${entryCwd}`;
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
