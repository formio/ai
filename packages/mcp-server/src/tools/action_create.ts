import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { FormioConfig } from '../config.js';
import { formioFetch } from '../formio-client.js';
import { toMcpTextResult, toMcpError } from '../mcp-responses.js';
import { actionDefinitionSchema } from './action-schema.js';
import { cwdSchema, resolveProjectConfig } from '../project-resolver.js';
import { z } from 'zod';

export function registerActionCreateTool(server: McpServer, config: FormioConfig) {
  server.tool(
    'action_create',
    'Create a new action on a form. Call action_type_get first to discover the required settings schema for the action type.',
    {
      cwd: cwdSchema,
      formId: z.string().describe('The form ID to attach the action to'),
      action: actionDefinitionSchema,
    },
    async ({ cwd, formId, action }) => {
      try {
        const cfg = resolveProjectConfig(cwd, config);
        const catalog = (await formioFetch(`form/${formId}/actions`, {}, cfg)) as Array<{
          name: string;
        }>;
        const availableNames = catalog.map((t) => t.name);
        if (!availableNames.includes(action.name)) {
          return {
            content: [
              {
                type: 'text' as const,
                text: `Action type '${action.name}' is not available on this server. Available types: ${availableNames.join(', ')}`,
              },
            ],
            isError: true,
          };
        }

        const created = await formioFetch(`form/${formId}/action`, {}, cfg, {
          method: 'POST',
          body: action,
        });
        return toMcpTextResult(created);
      } catch (error) {
        return toMcpError(error);
      }
    }
  );
}
