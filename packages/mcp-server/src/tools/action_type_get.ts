import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { FormioConfig } from '../config.js';
import { formioFetch } from '../formio-client.js';
import { toMcpStructuredResult, toMcpError } from '../mcp-responses.js';
import { actionTypeInfoDocument } from '../output-schemas.js';
import { reads } from '../tool-annotations.js';
import { unknownActionType } from './action-schema.js';
import { cwdSchema } from '../project-resolver.js';
import { resolveToolConfig } from './project-resolution.js';
import { formIdArgument, requireFormId } from './form-id.js';
import { resourceSegmentArgument } from './path-arguments.js';

export function registerActionTypeGetTool(server: McpServer, config: FormioConfig) {
  server.registerTool(
    'action_type_get',
    {
      description:
        'Get action type info and settings form schema. Call this before action_create to discover the required settings for the action type.',
      inputSchema: {
        cwd: cwdSchema,
        formId: formIdArgument(),
        actionName: resourceSegmentArgument('actionName').describe(
          'The action type name (e.g. "email", "save", "login")'
        ),
      },
      outputSchema: actionTypeInfoDocument,
      annotations: reads('Get an action type'),
    },
    async ({ cwd, formId, actionName }) => {
      try {
        requireFormId(formId);
        const cfg = await resolveToolConfig({ server, cwd, config });
        try {
          const typeInfo = (await formioFetch(
            `form/${formId}/actions/${actionName}`,
            {},
            cfg
          )) as Record<string, unknown>;
          return toMcpStructuredResult(typeInfo);
        } catch (error) {
          const catalog = (await formioFetch(`form/${formId}/actions`, {}, cfg).catch(() => {
            throw error;
          })) as Array<{ name: string }>;
          const available = catalog.map((t) => t.name);
          // A type the catalog offers failed for another reason: report that failure.
          if (available.includes(actionName)) {
            throw error;
          }
          throw unknownActionType({ name: actionName, available });
        }
      } catch (error) {
        return toMcpError(error);
      }
    }
  );
}
