import { z } from 'zod';
import { formioFetch } from '../formio-client.js';
import { toMcpStructuredResult, toMcpError } from '../mcp-responses.js';
import { roleDocument } from '../output-schemas.js';
import { creates } from '../tool-annotations.js';
import { newRoleSchema } from './role-schema.js';
import { cwdSchema } from '../project-resolver.js';
import { resolveToolConfig } from './project-resolution.js';
export function registerRoleCreateTool(server, config) {
    server.registerTool('role_create', {
        description: 'Create a new role in the project `cwd` resolves to.',
        inputSchema: z.strictObject({
            cwd: cwdSchema,
            role: newRoleSchema.describe('The role to create'),
        }),
        outputSchema: roleDocument,
        annotations: creates('Create a role'),
    }, async ({ cwd, role }) => {
        try {
            const cfg = await resolveToolConfig({ server, cwd, config });
            const created = (await formioFetch('role', {}, cfg, {
                method: 'POST',
                body: role,
            }));
            return toMcpStructuredResult(created);
        }
        catch (error) {
            return toMcpError(error);
        }
    });
}
