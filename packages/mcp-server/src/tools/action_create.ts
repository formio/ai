import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { FormioConfig } from '../config.js';
import { formioFetch } from '../formio-client.js';
import { toMcpStructuredResult, toMcpError } from '../mcp-responses.js';
import { actionDocument } from '../output-schemas.js';
import { creates } from '../tool-annotations.js';
import { actionDefinitionSchema, unknownActionType } from './action-schema.js';
import { cwdSchema } from '../project-resolver.js';
import { resolveToolConfig } from './project-resolution.js';
import { formIdArgument, requireFormId } from './form-id.js';

export function registerActionCreateTool(server: McpServer, config: FormioConfig) {
  server.registerTool(
    'action_create',
    {
      description:
        'Create a new action on a form. Call action_type_get first to discover the required settings schema for the action type.',
      inputSchema: {
        cwd: cwdSchema,
        formId: formIdArgument(),
        action: actionDefinitionSchema,
      },
      outputSchema: actionDocument,
      annotations: creates('Create a form action'),
    },
    async ({ cwd, formId, action }) => {
      try {
        requireFormId(formId);
        const cfg = await resolveToolConfig({ server, cwd, config });
        const catalog = (await formioFetch(`form/${formId}/actions`, {}, cfg)) as Array<{
          name: string;
        }>;
        const availableNames = catalog.map((t) => t.name);
        if (!availableNames.includes(action.name)) {
          throw unknownActionType({ name: action.name, available: availableNames });
        }

        const created = (await formioFetch(`form/${formId}/action`, {}, cfg, {
          method: 'POST',
          body: action,
        })) as Record<string, unknown>;
        return toMcpStructuredResult(created);
      } catch (error) {
        return toMcpError(error);
      }
    }
  );
}
