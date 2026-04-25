import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { FormioConfig } from '../config.js';
import { formioFetch } from '../formio-client.js';
import { toMcpTextResult, toMcpError } from '../mcp-responses.js';
import { cwdSchema, resolveProjectConfig } from '../project-resolver.js';

export function registerActionTypesListTool(server: McpServer, config: FormioConfig) {
  server.tool(
    'action_types_list',
    'List available action types for a form. Returns the catalog of action types the server supports.',
    {
      cwd: cwdSchema,
      formId: z.string().describe('The form ID to list available action types for'),
    },
    async ({ cwd, formId }) => {
      try {
        const cfg = resolveProjectConfig(cwd, config);
        const catalog = await formioFetch(`form/${formId}/actions`, {}, cfg);
        return toMcpTextResult(catalog);
      } catch (error) {
        return toMcpError(error);
      }
    }
  );
}
