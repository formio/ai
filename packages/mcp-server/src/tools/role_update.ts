import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { FormioConfig } from '../config.js';
import { formioFetch } from '../formio-client.js';
import { toMcpStructuredResult, toMcpError } from '../mcp-responses.js';
import { roleDocument } from '../output-schemas.js';
import { overwrites } from '../tool-annotations.js';
import { roleSchema } from './role-schema.js';
import { cwdSchema } from '../project-resolver.js';
import { resolveToolConfig } from './project-resolution.js';
import { requireObjectId } from './object-id.js';

export function registerRoleUpdateTool(server: McpServer, config: FormioConfig) {
  server.registerTool(
    'role_update',
    {
      description:
        'Update an existing role in the project `cwd` resolves to. Fields sent overwrite the stored ones (an array or object is stored as given, not merged); top-level fields left out keep their stored value.',
      inputSchema: {
        cwd: cwdSchema,
        roleId: z.string().describe('The _id of the role to update, a 24-character ObjectId'),
        role: roleSchema.describe('Role document with updated fields'),
      },
      outputSchema: roleDocument,
      annotations: overwrites('Update a role'),
    },
    async ({ cwd, roleId, role }) => {
      try {
        requireObjectId({
          argument: 'roleId',
          value: roleId,
          remedy: "roleId takes a role's 24-character ObjectId _id. Read it with role_list.",
        });
        const cfg = await resolveToolConfig({ server, cwd, config });
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
