import { z } from 'zod';
import { toMcpStructuredResult, toMcpError } from '../mcp-responses.js';
import { templateDocument } from '../output-schemas.js';
import { reads } from '../tool-annotations.js';
import { cwdSchema } from '../project-resolver.js';
import { exportProject, taggedTemplate, withProjectAccess } from '../project-versions/tags.js';
import { resolveToolConfig } from './project-resolution.js';
export function registerProjectExportTool(server, config) {
    server.registerTool('project_export', {
        description: "Export the project `cwd` resolves to as a template (roles, resources, forms, actions). With `tag`, export the template that version tag stored instead — how a workspace's template.json is refreshed; Form.io does not store project-level access with a tag, so that comes from the project's current access.",
        inputSchema: z.strictObject({
            cwd: cwdSchema,
            tag: z.string().optional().describe('A version tag from project_tag_list'),
        }),
        outputSchema: templateDocument,
        annotations: reads('Export the project template'),
    }, async ({ cwd, tag }) => {
        try {
            const cfg = await resolveToolConfig({ server, cwd, config });
            if (tag === undefined) {
                return toMcpStructuredResult(await exportProject(cfg));
            }
            const [template, exported] = await Promise.all([
                taggedTemplate(cfg, tag),
                exportProject(cfg),
            ]);
            return toMcpStructuredResult(withProjectAccess(template, exported));
        }
        catch (error) {
            return toMcpError(error);
        }
    });
}
