import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { FormioConfig } from '../config.js';
import { formioFetch } from '../formio-client.js';
import { toMcpStructuredResult, toMcpError } from '../mcp-responses.js';
import { actionShape } from '../output-schemas.js';
import { reads } from '../tool-annotations.js';
import { cwdSchema, resolveProjectConfig } from '../project-resolver.js';

export function registerActionGetTool(server: McpServer, config: FormioConfig) {
  server.registerTool(
    'action_get',
    {
      description:
        'Get a single action by ID from a form, including its handler, method, condition, and type-specific settings. Call action_list first to find the action ID.',
      inputSchema: {
        cwd: cwdSchema,
        formId: z.string().describe('The form ID the action belongs to'),
        actionId: z.string().describe('The action ID to retrieve'),
      },
      outputSchema: actionShape,
      annotations: reads('Get a form action'),
    },
    async ({ cwd, formId, actionId }) => {
      try {
        const cfg = resolveProjectConfig(cwd, config);
        const action = (await formioFetch(`form/${formId}/action/${actionId}`, {}, cfg)) as Record<
          string,
          unknown
        >;
        return toMcpStructuredResult(action);
      } catch (error) {
        return toMcpError(error);
      }
    }
  );
}
