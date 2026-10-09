import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { FormioConfig } from '../config.js';
import { formioFetch } from '../formio-client.js';
import { toMcpStructuredResult, toMcpError } from '../mcp-responses.js';
import { actionTypesListOutput } from '../output-schemas.js';
import { reads } from '../tool-annotations.js';
import { cwdSchema, resolveProjectConfig } from '../project-resolver.js';
import { listResult, pageOf } from './list-contract.js';
import { resourceSegmentArgument } from './path-arguments.js';

export function registerActionTypeListTool(server: McpServer, config: FormioConfig) {
  server.registerTool(
    'action_type_list',
    {
      description:
        'List the action types available for a form. Returns the whole catalog the server supports in one result.',
      inputSchema: {
        cwd: cwdSchema,
        formId: resourceSegmentArgument('formId').describe(
          'The form ID to list available action types for'
        ),
      },
      outputSchema: actionTypesListOutput,
      annotations: reads('List action types'),
    },
    async ({ cwd, formId }) => {
      try {
        const cfg = resolveProjectConfig(cwd, config);
        // Form.io does not page this route: the body is the whole catalog.
        const catalog = await formioFetch(`form/${formId}/actions`, {}, cfg);
        const items = Array.isArray(catalog) ? (catalog as Record<string, unknown>[]) : [];
        const page = pageOf({ items, total: items.length, skip: 0 });
        return toMcpStructuredResult(listResult('actionTypes', page));
      } catch (error) {
        return toMcpError(error);
      }
    }
  );
}
