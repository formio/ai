import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { FormioConfig } from '../config.js';
import { formioFetch } from '../formio-client.js';
import { toMcpTextResult, toMcpError } from '../mcp-responses.js';
import { cwdSchema, resolveProjectConfig } from '../project-resolver.js';

export function registerActionGetTool(server: McpServer, config: FormioConfig) {
  server.tool(
    'action_get',
    'Get a single action by ID from a form.',
    {
      cwd: cwdSchema,
      formId: z.string().describe('The form ID the action belongs to'),
      actionId: z.string().describe('The action ID to retrieve'),
    },
    async ({ cwd, formId, actionId }) => {
      try {
        const cfg = resolveProjectConfig(cwd, config);
        const action = await formioFetch(`form/${formId}/action/${actionId}`, {}, cfg);
        return toMcpTextResult(action);
      } catch (error) {
        return toMcpError(error);
      }
    }
  );
}
