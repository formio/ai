import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { FormioConfig } from '../config.js';
import { formioFetch } from '../formio-client.js';
import { toMcpStructuredResult, toMcpError } from '../mcp-responses.js';
import { actionTypeInfoShape } from '../output-schemas.js';
import { reads } from '../tool-annotations.js';
import { cwdSchema, resolveProjectConfig } from '../project-resolver.js';

export function registerActionTypeGetTool(server: McpServer, config: FormioConfig) {
  server.registerTool(
    'action_type_get',
    {
      description:
        'Get action type info and settings form schema. Call this before action_create to discover the required settings for the action type.',
      inputSchema: {
        cwd: cwdSchema,
        formId: z.string().describe('The form ID to get the action type for'),
        actionName: z.string().describe('The action type name (e.g. "email", "save", "login")'),
      },
      outputSchema: actionTypeInfoShape,
      annotations: reads('Get an action type'),
    },
    async ({ cwd, formId, actionName }) => {
      try {
        const cfg = resolveProjectConfig(cwd, config);
        try {
          const typeInfo = (await formioFetch(
            `form/${formId}/actions/${actionName}`,
            {},
            cfg
          )) as Record<string, unknown>;
          return toMcpStructuredResult(typeInfo);
        } catch (error) {
          const catalog = (await formioFetch(`form/${formId}/actions`, {}, cfg).catch(() => {
            throw error;
          })) as Array<{ name: string }>;
          const availableTypes = catalog.map((t) => t.name).join(', ');
          throw new Error(
            `Action type '${actionName}' is not available on this server. Available types: ${availableTypes}`
          );
        }
      } catch (error) {
        return toMcpError(error);
      }
    }
  );
}
