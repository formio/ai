import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { FormioConfig } from '../config.js';
import { formioFetch } from '../formio-client.js';
import { toMcpTextResult, toMcpError } from '../mcp-responses.js';
import { actionDefinitionSchema } from './action-schema.js';
import { cwdSchema, resolveProjectConfig } from '../project-resolver.js';

export function registerActionUpdateTool(server: McpServer, config: FormioConfig) {
  server.tool(
    'action_update',
    'Update an existing action on a form.',
    {
      cwd: cwdSchema,
      formId: z.string().describe('The form ID the action belongs to'),
      actionId: z.string().describe('The action ID to update'),
      action: actionDefinitionSchema,
    },
    async ({ cwd, formId, actionId, action }) => {
      try {
        const cfg = resolveProjectConfig(cwd, config);
        const updated = await formioFetch(`form/${formId}/action/${actionId}`, {}, cfg, {
          method: 'PUT',
          body: action,
        });
        return toMcpTextResult(updated);
      } catch (error) {
        return toMcpError(error);
      }
    }
  );
}
