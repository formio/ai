import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { FormioConfig } from '../config.js';
import { formioFetch } from '../formio-client.js';
import { toMcpError } from '../mcp-responses.js';
import { cwdSchema, resolveProjectConfig } from '../project-resolver.js';

export function registerActionDeleteTool(server: McpServer, config: FormioConfig) {
  server.tool(
    'action_delete',
    'Delete an action from a form.',
    {
      cwd: cwdSchema,
      formId: z.string().describe('The form ID the action belongs to'),
      actionId: z.string().describe('The action ID to delete'),
    },
    async ({ cwd, formId, actionId }) => {
      try {
        const cfg = resolveProjectConfig(cwd, config);
        await formioFetch(`form/${formId}/action/${actionId}`, {}, cfg, {
          method: 'DELETE',
        });
        return { content: [{ type: 'text' as const, text: 'OK' }] };
      } catch (error) {
        return toMcpError(error);
      }
    }
  );
}
