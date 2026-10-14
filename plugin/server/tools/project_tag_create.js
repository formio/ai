import { z } from 'zod';
import { formioFetch, templateTransferTimeoutMs } from '../formio-client.js';
import { toMcpStructuredResult, toMcpError } from '../mcp-responses.js';
import { tagSummaryOutput } from '../output-schemas.js';
import { creates } from '../tool-annotations.js';
import { cwdSchema } from '../project-resolver.js';
import { FormioApiError, isRecord, ToolError } from '../tool-errors.js';
import { resolveToolConfig } from './project-resolution.js';
// MAJOR.MINOR.PATCH with an optional pre-release; Form.io caps a tag at 32 characters.
const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(-[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?$/;
// Checked here rather than in the schema: a schema failure reaches the client as bare
// text, without the INVALID_ARGUMENT code the error contract promises.
function requireVersionArguments({ tag, description }) {
    if (tag.length > 32 || !SEMVER.test(tag)) {
        throw new ToolError({
            code: 'INVALID_ARGUMENT',
            message: `\`tag\` must be a semver version of at most 32 characters, such as 1.3.0 or 2.0.0-rc.1; got "${tag}".`,
        });
    }
    if (description.trim() === '' || description.length > 256) {
        throw new ToolError({
            code: 'INVALID_ARGUMENT',
            message: '`description` must say what changed, in at most 256 characters.',
        });
    }
}
export function registerProjectTagCreateTool(server, config) {
    server.registerTool('project_tag_create', {
        description: 'Version the project `cwd` resolves to: Form.io snapshots its current state under a semver `tag` with a `description`, and the project is then at that version. Ask the user before calling. Export the version with project_export `tag`.',
        inputSchema: z.strictObject({
            cwd: cwdSchema,
            tag: z.string().describe('The next semver version, e.g. 1.3.0 (at most 32 characters)'),
            description: z.string().describe('What changed in this version (at most 256 characters)'),
        }),
        outputSchema: tagSummaryOutput,
        annotations: creates('Create a project version'),
    }, async ({ cwd, tag, description }) => {
        try {
            requireVersionArguments({ tag, description });
            const cfg = await resolveToolConfig({ server, cwd, config });
            const created = await formioFetch('tag', {}, cfg, {
                method: 'POST',
                body: { tag, description },
                timeoutMs: templateTransferTimeoutMs(cfg),
            }).catch((error) => {
                if (error instanceof FormioApiError && /must be unique/i.test(error.body ?? '')) {
                    throw new ToolError({
                        code: 'VALIDATION_FAILED',
                        message: `Version tag "${tag}" already exists for this project; choose the next version.`,
                        cause: error,
                    });
                }
                throw error;
            });
            const document = isRecord(created) ? created : {};
            return toMcpStructuredResult({
                tag: typeof document.tag === 'string' ? document.tag : tag,
                ...(typeof document.description === 'string'
                    ? { description: document.description }
                    : { description }),
                ...(typeof document.created === 'string' ? { created: document.created } : {}),
            });
        }
        catch (error) {
            return toMcpError(error);
        }
    });
}
