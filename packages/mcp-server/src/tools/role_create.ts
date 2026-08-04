import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { FormioConfig } from '../config.js';
import { formioFetch } from '../formio-client.js';
import { toMcpStructuredResult, toMcpError } from '../mcp-responses.js';
import { roleShape } from '../output-schemas.js';
import { creates } from '../tool-annotations.js';
import { roleFields } from './role-schema.js';
import { cwdSchema, resolveProjectConfig } from '../project-resolver.js';

export function registerRoleCreateTool(server: McpServer, config: FormioConfig) {
  server.registerTool(
    'role_create',
    {
      description:
        "Create a new role in the Form.io project mapped to the user's current working directory.",
      inputSchema: {
        cwd: cwdSchema,
        ...roleFields,
        title: z.string().describe('Role title'),
      },
      outputSchema: roleShape,
      annotations: creates('Create a role'),
    },
    async ({ cwd, ...role }) => {
      try {
        const cfg = resolveProjectConfig(cwd, config);
        const created = (await formioFetch('role', {}, cfg, {
          method: 'POST',
          body: role,
        })) as Record<string, unknown>;
        return toMcpStructuredResult(created);
      } catch (error) {
        return toMcpError(error);
      }
    }
  );
}
