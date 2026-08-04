import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { FormioConfig } from '../config.js';
import { formioFetch } from '../formio-client.js';
import { toMcpStructuredResult, toMcpError } from '../mcp-responses.js';
import { actionShape } from '../output-schemas.js';
import { overwrites } from '../tool-annotations.js';
import { actionDefinitionSchema } from './action-schema.js';
import { cwdSchema, resolveProjectConfig } from '../project-resolver.js';

export function registerActionUpdateTool(server: McpServer, config: FormioConfig) {
  server.registerTool(
    'action_update',
    {
      description:
        'Update an existing action on a form. This is a full replacement of the action document — include every field you want to keep, and call action_get first if you do not already have it.',
      inputSchema: {
        cwd: cwdSchema,
        formId: z.string().describe('The form ID the action belongs to'),
        actionId: z.string().describe('The action ID to update'),
        action: actionDefinitionSchema,
      },
      outputSchema: actionShape,
      annotations: overwrites('Update a form action'),
    },
    async ({ cwd, formId, actionId, action }) => {
      try {
        const cfg = resolveProjectConfig(cwd, config);
        const updated = (await formioFetch(`form/${formId}/action/${actionId}`, {}, cfg, {
          method: 'PUT',
          body: action,
        })) as Record<string, unknown>;
        return toMcpStructuredResult(updated);
      } catch (error) {
        return toMcpError(error);
      }
    }
  );
}
