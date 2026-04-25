import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { readProjectEntry, writeProjectEntry } from '../project-map.js';

function normalizeProjectUrl(input: string): string {
  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    throw new Error(`projectUrl must be a valid URL, got: ${input}`);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`projectUrl must use http or https, got: ${parsed.protocol}`);
  }
  return input.replace(/\/+$/, '');
}

export interface ProjectSetOptions {
  cwd?: () => string;
}

export function registerProjectSetTool(server: McpServer, options: ProjectSetOptions = {}) {
  const getServerCwd = options.cwd ?? (() => process.cwd());
  server.tool(
    'project_set',
    [
      'Set the active Form.io project for the given working directory by writing the URL to project.json file in formio configuration folder',
      'You MUST call this tool whenever the user asks to set, change, or switch the active Form.io project — do not merely acknowledge the request in text. Persisting the choice requires the tool call.',
      "The chosen URL is persisted to project.json file in the formio configuration folder keyed by the cwd argument when provided (or the MCP server process cwd otherwise). Pass the `cwd` argument whenever you know the user's current working directory — the server process cwd is fixed at spawn and may not match where the user actually is.",
      'Every Form.io tool resolves its project URL from this map on each call, so the new mapping takes effect immediately for subsequent tool calls from the same cwd.',
    ].join(' '),
    {
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
    },
    async ({ projectUrl, cwd }) => {
      const normalized = normalizeProjectUrl(projectUrl);
      const entryCwd = cwd ?? getServerCwd();
      const existing = readProjectEntry(entryCwd);
      const previousMapped = existing?.env.FORMIO_PROJECT_URL;

      if (previousMapped === normalized) {
        return {
          content: [
            {
              type: 'text',
              text: `Active project is already ${normalized} and persisted for ${entryCwd}; no change`,
            },
          ],
        };
      }

      writeProjectEntry(entryCwd, { FORMIO_PROJECT_URL: normalized });
      const message = previousMapped
        ? `Active project set to ${normalized} (was ${previousMapped}; persisted for ${entryCwd})`
        : `Active project set to ${normalized}; mapping persisted for ${entryCwd}`;
      return {
        content: [{ type: 'text', text: message }],
      };
    }
  );
}
