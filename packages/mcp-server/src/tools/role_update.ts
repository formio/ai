import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { FormioConfig } from '../config.js';
import { formioFetch, MONGO_ID_PATTERN } from '../formio-client.js';
import { toMcpTextResult, toMcpError } from '../mcp-responses.js';
import { roleFields } from './role-schema.js';
import { cwdSchema, resolveProjectConfig } from '../project-resolver.js';

export function registerRoleUpdateTool(server: McpServer, config: FormioConfig) {
  server.tool(
    'role_update',
    "Update an existing role in the Form.io project mapped to the user's current working directory. This is a full replacement — include all fields you want to preserve.",
    {
      cwd: cwdSchema,
      roleId: z
        .string()
        .regex(MONGO_ID_PATTERN, 'Must be a 24-character MongoDB ObjectId')
        .describe('The _id of the role to update'),
      role: z
        .object(roleFields)
        .catchall(z.unknown())
        .describe('Role document with updated fields'),
    },
    async ({ cwd, roleId, role }) => {
      try {
        const cfg = resolveProjectConfig(cwd, config);
        const updated = await formioFetch(`role/${roleId}`, {}, cfg, {
          method: 'PUT',
          body: role,
        });
        return toMcpTextResult(updated);
      } catch (error) {
        return toMcpError(error);
      }
    }
  );
}
