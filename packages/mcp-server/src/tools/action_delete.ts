import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { FormioConfig } from '../config.js';
import { formioFetch } from '../formio-client.js';
import { toMcpError, toMcpStructuredResult } from '../mcp-responses.js';
import { acknowledgementShape } from '../output-schemas.js';
import { removes } from '../tool-annotations.js';
import { cwdSchema, resolveProjectConfig } from '../project-resolver.js';

export function registerActionDeleteTool(server: McpServer, config: FormioConfig) {
  server.registerTool(
    'action_delete',
    {
      description:
        'Delete an action from a form. The action stops running on submissions immediately and is not recoverable — call action_get first if the settings may be needed again.',
      inputSchema: {
        cwd: cwdSchema,
        formId: z.string().describe('The form ID the action belongs to'),
        actionId: z.string().describe('The action ID to delete'),
      },
      outputSchema: acknowledgementShape,
      annotations: removes('Delete a form action'),
    },
    async ({ cwd, formId, actionId }) => {
      try {
        const cfg = resolveProjectConfig(cwd, config);
        // The API answers this DELETE with the plain text body `OK`, so the
        // response is read as text. Left to default to `res.json()` it threw
        // "Unexpected token 'O'" and the delete reported failure after succeeding.
        await formioFetch(`form/${formId}/action/${actionId}`, {}, cfg, {
          method: 'DELETE',
          responseType: 'text',
        });
        // Text stays 'OK' — the payload carries the detail, and a bare
        // acknowledgement is what a model reading this wants.
        return toMcpStructuredResult(
          { ok: true, message: `Deleted action ${actionId} from form ${formId}` },
          'OK'
        );
      } catch (error) {
        return toMcpError(error);
      }
    }
  );
}
