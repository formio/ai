import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { FormioConfig } from '../config.js';
import { formioFetch } from '../formio-client.js';
import { toMcpTextResult, toMcpError } from '../mcp-responses.js';
import { cwdSchema, resolveProjectConfig } from '../project-resolver.js';

export function registerRoleListTool(server: McpServer, config: FormioConfig) {
  server.tool(
    'role_list',
    "List all roles defined in the Form.io project mapped to the user's current working directory.",
    {
      cwd: cwdSchema,
      select: z.string().optional().describe('Comma-separated fields to return'),
    },
    async ({ cwd, select }) => {
      try {
        const cfg = resolveProjectConfig(cwd, config);
        const params: Record<string, string | undefined> = { select };
        const roles = await formioFetch('role', params, cfg);
        return toMcpTextResult(roles);
      } catch (error) {
        return toMcpError(error);
      }
    }
  );
}
