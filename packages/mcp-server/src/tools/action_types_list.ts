import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { FormioConfig } from '../config.js';
import { formioFetch } from '../formio-client.js';
import { toMcpStructuredResult, toMcpError } from '../mcp-responses.js';
import { actionTypesListShape } from '../output-schemas.js';
import { reads } from '../tool-annotations.js';
import { cwdSchema, resolveProjectConfig } from '../project-resolver.js';

export function registerActionTypesListTool(server: McpServer, config: FormioConfig) {
  server.registerTool(
    'action_types_list',
    {
      description:
        'List available action types for a form. Returns the catalog of action types the server supports.',
      inputSchema: {
        cwd: cwdSchema,
        formId: z.string().describe('The form ID to list available action types for'),
      },
      outputSchema: actionTypesListShape,
      annotations: reads('List action types'),
    },
    async ({ cwd, formId }) => {
      try {
        const cfg = resolveProjectConfig(cwd, config);
        const actionTypes = (await formioFetch(`form/${formId}/actions`, {}, cfg)) as Record<
          string,
          unknown
        >[];
        return toMcpStructuredResult({ actionTypes, count: actionTypes.length });
      } catch (error) {
        return toMcpError(error);
      }
    }
  );
}
