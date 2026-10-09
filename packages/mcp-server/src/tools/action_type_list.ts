import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { FormioConfig } from '../config.js';
import { formioFetch } from '../formio-client.js';
import { toMcpStructuredResult, toMcpError } from '../mcp-responses.js';
import { actionTypesListOutput } from '../output-schemas.js';
import { reads } from '../tool-annotations.js';
import { cwdSchema, resolveProjectConfig } from '../project-resolver.js';
import { formIdArgument, requireFormId } from './form-id.js';
import { listResult, pageOf } from './list-contract.js';

export function registerActionTypeListTool(server: McpServer, config: FormioConfig) {
  server.registerTool(
    'action_type_list',
    {
      description:
        'List the action types available for a form. Returns the whole catalog the server supports in one result.',
      inputSchema: {
        cwd: cwdSchema,
        formId: formIdArgument(),
      },
      outputSchema: actionTypesListOutput,
      annotations: reads('List action types'),
    },
    async ({ cwd, formId }) => {
      try {
        requireFormId(formId);
        const cfg = resolveProjectConfig(cwd, config);
        // Form.io does not page this route: the body is the whole catalog.
        const catalog = await formioFetch(`form/${formId}/actions`, {}, cfg);
        const items = Array.isArray(catalog) ? (catalog as Record<string, unknown>[]) : [];
        const page = pageOf({ items, total: items.length, skip: 0, limit: items.length });
        return toMcpStructuredResult(listResult('actionTypes', page));
      } catch (error) {
        return toMcpError(error);
      }
    }
  );
}
