import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { FormioConfig } from '../config.js';
import { formioFetch } from '../formio-client.js';
import { toMcpStructuredResult, toMcpError } from '../mcp-responses.js';
import { actionDocument } from '../output-schemas.js';
import { reads } from '../tool-annotations.js';
import { cwdSchema, resolveProjectConfig } from '../project-resolver.js';
import { formIdArgument, requireFormId } from './form-id.js';
import { resourceSegmentArgument } from './path-arguments.js';

export function registerActionGetTool(server: McpServer, config: FormioConfig) {
  server.registerTool(
    'action_get',
    {
      description:
        'Get a single action by ID from a form, including its handler, method, condition, and type-specific settings. Call action_list first to find the action ID.',
      inputSchema: {
        cwd: cwdSchema,
        formId: formIdArgument(),
        actionId: resourceSegmentArgument('actionId').describe('The action ID to retrieve'),
      },
      outputSchema: actionDocument,
      annotations: reads('Get a form action'),
    },
    async ({ cwd, formId, actionId }) => {
      try {
        requireFormId(formId);
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
