import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { FormioConfig } from '../config.js';
import { formioFetch, MONGO_ID_PATTERN } from '../formio-client.js';
import { toMcpStructuredResult, toMcpError } from '../mcp-responses.js';
import { roleShape } from '../output-schemas.js';
import { overwrites } from '../tool-annotations.js';
import { roleFields } from './role-schema.js';
import { cwdSchema, resolveProjectConfig } from '../project-resolver.js';

export function registerRoleUpdateTool(server: McpServer, config: FormioConfig) {
  server.registerTool(
    'role_update',
    {
      description:
        "Update an existing role in the Form.io project mapped to the user's current working directory. This is a full replacement — include all fields you want to preserve.",
      inputSchema: {
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
      outputSchema: roleShape,
      annotations: overwrites('Update a role'),
    },
    async ({ cwd, roleId, role }) => {
      try {
        const cfg = resolveProjectConfig(cwd, config);
        const updated = (await formioFetch(`role/${roleId}`, {}, cfg, {
          method: 'PUT',
          body: role,
        })) as Record<string, unknown>;
        return toMcpStructuredResult(updated);
      } catch (error) {
        return toMcpError(error);
      }
    }
  );
}
