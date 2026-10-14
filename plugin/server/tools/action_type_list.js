import { z } from 'zod';
import { formioFetch } from '../formio-client.js';
import { toMcpStructuredResult, toMcpError } from '../mcp-responses.js';
import { actionTypesListOutput } from '../output-schemas.js';
import { reads } from '../tool-annotations.js';
import { cwdSchema } from '../project-resolver.js';
import { resolveToolConfig } from './project-resolution.js';
import { formIdArgument, requireFormId } from './form-id.js';
export function registerActionTypeListTool(server, config) {
    server.registerTool('action_type_list', {
        description: 'List the action types available for a form. Returns the whole catalog the server supports in one result.',
        inputSchema: z.strictObject({
            cwd: cwdSchema,
            formId: formIdArgument(),
        }),
        outputSchema: actionTypesListOutput,
        annotations: reads('List action types'),
    }, async ({ cwd, formId }) => {
        try {
            requireFormId(formId);
            const cfg = await resolveToolConfig({ server, cwd, config });
            // Form.io does not page this route: the body is the whole catalog.
            const catalog = await formioFetch(`form/${formId}/actions`, {}, cfg);
            const items = Array.isArray(catalog) ? catalog : [];
            return toMcpStructuredResult({ actionTypes: items, total: items.length, hasMore: false });
        }
        catch (error) {
            return toMcpError(error);
        }
    });
}
