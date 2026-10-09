import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { FormioConfig } from '../config.js';
import { formioFetch } from '../formio-client.js';
import { toMcpStructuredResult, toMcpError } from '../mcp-responses.js';
import { actionDocument } from '../output-schemas.js';
import { overwrites } from '../tool-annotations.js';
import { actionDefinitionSchema } from './action-schema.js';
import { cwdSchema, resolveProjectConfig } from '../project-resolver.js';
import { formIdArgument, requireFormId } from './form-id.js';
import { resourceSegmentArgument } from './path-arguments.js';

export function registerActionUpdateTool(server: McpServer, config: FormioConfig) {
  server.registerTool(
    'action_update',
    {
      description:
        'Update an existing action on a form; call action_get first if you do not already have it. Fields sent overwrite the stored ones (an array or object is stored as given, not merged); top-level fields left out keep their stored value.',
      inputSchema: {
        cwd: cwdSchema,
        formId: formIdArgument(),
        actionId: resourceSegmentArgument('actionId').describe('The action ID to update'),
        action: actionDefinitionSchema,
      },
      outputSchema: actionDocument,
      annotations: overwrites('Update a form action'),
    },
    async ({ cwd, formId, actionId, action }) => {
      try {
        requireFormId(formId);
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
