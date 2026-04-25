import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { FormioConfig } from '../config.js';
import { formioFetch } from '../formio-client.js';
import { toMcpTextResult, toMcpError } from '../mcp-responses.js';
import { roleFields } from './role-schema.js';
import { cwdSchema, resolveProjectConfig } from '../project-resolver.js';

export function registerRoleCreateTool(server: McpServer, config: FormioConfig) {
  server.tool(
    'role_create',
    "Create a new role in the Form.io project mapped to the user's current working directory.",
    {
      cwd: cwdSchema,
      ...roleFields,
      title: z.string().describe('Role title'),
    },
    async ({ cwd, ...role }) => {
      try {
        const cfg = resolveProjectConfig(cwd, config);
        const created = await formioFetch('role', {}, cfg, {
          method: 'POST',
          body: role,
        });
        return toMcpTextResult(created);
      } catch (error) {
        return toMcpError(error);
      }
    }
  );
}
