import { z } from 'zod';
import { formioFetch } from '../formio-client.js';
import { toMcpStructuredResult, toMcpError } from '../mcp-responses.js';
import { actionDocument } from '../output-schemas.js';
import { overwrites } from '../tool-annotations.js';
import { actionDefinitionSchema } from './action-schema.js';
import { cwdSchema } from '../project-resolver.js';
import { resolveToolConfig } from './project-resolution.js';
import { formIdArgument, requireFormId } from './form-id.js';
import { resourceSegmentArgument } from './path-arguments.js';
export function registerActionUpdateTool(server, config) {
    server.registerTool('action_update', {
        description: 'Update an existing action on a form; call action_get first if you do not already have it. Sent fields overwrite, arrays and objects whole; top-level fields left out keep their value.',
        inputSchema: z.strictObject({
            cwd: cwdSchema,
            formId: formIdArgument(),
            actionId: resourceSegmentArgument('actionId').describe('The action ID to update'),
            action: actionDefinitionSchema,
        }),
        outputSchema: actionDocument,
        annotations: overwrites('Update a form action'),
    }, async ({ cwd, formId, actionId, action }) => {
        try {
            requireFormId(formId);
            const cfg = await resolveToolConfig({ server, cwd, config });
            const updated = (await formioFetch(`form/${formId}/action/${actionId}`, {}, cfg, {
                method: 'PUT',
                body: action,
            }));
            return toMcpStructuredResult(updated);
        }
        catch (error) {
            return toMcpError(error);
        }
    });
}
