import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { FormioConfig } from '../config.js';
import { formioFetch, isMongoId } from '../formio-client.js';
import { toMcpTextResult, toMcpError } from '../mcp-responses.js';
import { cwdSchema, resolveProjectConfig } from '../project-resolver.js';

export function registerFormGetTool(server: McpServer, config: FormioConfig) {
  server.tool(
    'form_get',
    "Fetch a single form definition from the Form.io project mapped to the user's current working directory, by form ID or path. Pass `draft: true` to fetch the form's current in-flight draft instead of the published form.",
    {
      cwd: cwdSchema,
      formIdOrPath: z.string().describe('Form ID (_id) or path (e.g. "user/login")'),
      select: z
        .string()
        .optional()
        .describe('Comma-separated fields to return (omit for full form JSON)'),
      draft: z
        .boolean()
        .optional()
        .describe("When true, fetch the form's current draft (GET /<form>/draft)"),
    },
    async ({ cwd, formIdOrPath, select, draft }) => {
      try {
        const cfg = resolveProjectConfig(cwd, config);
        const params: Record<string, string | undefined> = { select };
        const base = isMongoId(formIdOrPath) ? `form/${formIdOrPath}` : formIdOrPath;
        const path = draft ? `${base}/draft` : base;
        const form = (await formioFetch(path, params, cfg)) as Record<string, unknown>;
        // GET /draft falls back to the live form when no draft exists, so
        // distinguish by _vid: only the draft revision has _vid === 'draft'.
        if (draft && form._vid !== 'draft') {
          throw new Error(
            `No draft exists for form "${formIdOrPath}". Create one via form_update with draft: true.`
          );
        }
        return toMcpTextResult(form);
      } catch (error) {
        return toMcpError(error);
      }
    }
  );
}
