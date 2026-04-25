import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { FormioConfig } from '../config.js';
import { formioFetch, isMongoId } from '../formio-client.js';
import { toMcpTextResult, toMcpError } from '../mcp-responses.js';
import { cwdSchema, resolveProjectConfig } from '../project-resolver.js';

export function registerFormGetTool(server: McpServer, config: FormioConfig) {
  server.tool(
    'form_get',
    "Fetch a single form definition from the Form.io project mapped to the user's current working directory, by form ID or path.",
    {
      cwd: cwdSchema,
      formIdOrPath: z.string().describe('Form ID (_id) or path (e.g. "user/login")'),
      select: z
        .string()
        .optional()
        .describe('Comma-separated fields to return (omit for full form JSON)'),
    },
    async ({ cwd, formIdOrPath, select }) => {
      try {
        const cfg = resolveProjectConfig(cwd, config);
        const params: Record<string, string | undefined> = { select };
        const path = isMongoId(formIdOrPath) ? `form/${formIdOrPath}` : formIdOrPath;
        const form = await formioFetch(path, params, cfg);
        return toMcpTextResult(form);
      } catch (error) {
        return toMcpError(error);
      }
    }
  );
}
