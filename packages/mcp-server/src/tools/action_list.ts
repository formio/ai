import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { FormioConfig } from '../config.js';
import { formioFetch } from '../formio-client.js';
import { toMcpStructuredResult, toMcpError } from '../mcp-responses.js';
import { actionsListShape } from '../output-schemas.js';
import { reads } from '../tool-annotations.js';
import { cwdSchema, resolveProjectConfig } from '../project-resolver.js';

export function registerActionListTool(server: McpServer, config: FormioConfig) {
  server.registerTool(
    'action_list',
    {
      description:
        'List the actions configured on a form — the server-side handlers that run when a submission is saved, such as save-to-resource, email, login, and role assignment.',
      inputSchema: {
        cwd: cwdSchema,
        formId: z.string().describe('The form ID to list actions for'),
      },
      outputSchema: actionsListShape,
      annotations: reads('List form actions'),
    },
    async ({ cwd, formId }) => {
      try {
        const cfg = resolveProjectConfig(cwd, config);
        const actions = (await formioFetch(`form/${formId}/action`, {}, cfg)) as Record<
          string,
          unknown
        >[];
        return toMcpStructuredResult({ actions, count: actions.length });
      } catch (error) {
        return toMcpError(error);
      }
    }
  );
}
