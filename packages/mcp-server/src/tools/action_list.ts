import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { FormioConfig } from '../config.js';
import { formioFetch } from '../formio-client.js';
import { toMcpTextResult, toMcpError } from '../mcp-responses.js';
import { cwdSchema, resolveProjectConfig } from '../project-resolver.js';

export function registerActionListTool(server: McpServer, config: FormioConfig) {
  server.tool(
    'action_list',
    'List actions configured on a form.',
    {
      cwd: cwdSchema,
      formId: z.string().describe('The form ID to list actions for'),
    },
    async ({ cwd, formId }) => {
      try {
        const cfg = resolveProjectConfig(cwd, config);
        const actions = await formioFetch(`form/${formId}/action`, {}, cfg);
        return toMcpTextResult(actions);
      } catch (error) {
        return toMcpError(error);
      }
    }
  );
}
