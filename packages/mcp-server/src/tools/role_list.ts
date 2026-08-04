import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { FormioConfig } from '../config.js';
import { formioFetch } from '../formio-client.js';
import { toMcpStructuredResult, toMcpError } from '../mcp-responses.js';
import { rolesListShape } from '../output-schemas.js';
import { reads } from '../tool-annotations.js';
import { cwdSchema, resolveProjectConfig } from '../project-resolver.js';

export function registerRoleListTool(server: McpServer, config: FormioConfig) {
  server.registerTool(
    'role_list',
    {
      description:
        "List all roles defined in the Form.io project mapped to the user's current working directory.",
      inputSchema: {
        cwd: cwdSchema,
        select: z.string().optional().describe('Comma-separated fields to return'),
      },
      outputSchema: rolesListShape,
      annotations: reads('List roles'),
    },
    async ({ cwd, select }) => {
      try {
        const cfg = resolveProjectConfig(cwd, config);
        const params: Record<string, string | undefined> = { select };
        const roles = (await formioFetch('role', params, cfg)) as Record<string, unknown>[];
        return toMcpStructuredResult({ roles, count: roles.length });
      } catch (error) {
        return toMcpError(error);
      }
    }
  );
}
