import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { FormioConfig } from '../config.js';
import { formioFetch } from '../formio-client.js';
import { toMcpStructuredResult, toMcpError } from '../mcp-responses.js';
import { actionsListOutput } from '../output-schemas.js';
import { reads } from '../tool-annotations.js';
import { cwdSchema, resolveProjectConfig } from '../project-resolver.js';
import { resourceSegmentArgument } from './path-arguments.js';

export function registerActionListTool(server: McpServer, config: FormioConfig) {
  server.registerTool(
    'action_list',
    {
      description:
        'List the actions configured on a form — the server-side handlers that run when a submission is saved, such as save-to-resource, email, login, and role assignment.',
      inputSchema: {
        cwd: cwdSchema,
        formId: resourceSegmentArgument('formId').describe('The form ID to list actions for'),
      },
      outputSchema: actionsListOutput,
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
