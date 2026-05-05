import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { FormioConfig } from '../config.js';
import { formioFetch, isMongoId } from '../formio-client.js';
import { toMcpTextResult, toMcpError } from '../mcp-responses.js';
import { cwdSchema, resolveProjectConfig } from '../project-resolver.js';
import { mergeDraftOntoCurrent } from './form-draft-merge.js';

const TOOL_DESCRIPTION = [
  'Save (or overwrite) the active draft revision of a Form.io form via PUT /form/:id/draft.',
  'A form has at most one active draft — this tool overwrites any existing draft.',
  'Default copies the current published form; pass `definition` to overlay draft-specific fields onto current.',
  'Optional `note` rides as `_vnote` on the saved draft row.',
  'Requires revisions enabled (see `form_revisions_set`).',
  'If this call fails (e.g., revisions disabled, license missing, auth error), DO NOT fall back to `form_update` — surface the error to the user. The user asked for a draft; silently overwriting the live form is not an acceptable substitute.',
  'See `project-form-revisions` skill reference for overlay-field list and edge cases.',
].join(' ');

export function registerFormDraftCreateTool(server: McpServer, config: FormioConfig) {
  server.tool(
    'form_draft_create',
    TOOL_DESCRIPTION,
    {
      cwd: cwdSchema,
      formIdOrPath: z
        .string()
        .describe('Form _id (24-char Mongo ObjectId) or path (e.g. "user/login")'),
      definition: z
        .record(z.string(), z.unknown())
        .optional()
        .describe(
          'Partial form JSON whose draft-specific fields (`components`, `settings`, `tags`, `properties`, `display`) overlay the current published form. Omit to copy the current published form into the draft slot unchanged.'
        ),
      note: z.string().optional().describe('Free-text note attached to this draft as `_vnote`'),
    },
    async ({ cwd, formIdOrPath, definition, note }) => {
      try {
        const cfg = resolveProjectConfig(cwd, config);
        const fetchPath = isMongoId(formIdOrPath) ? `form/${formIdOrPath}` : formIdOrPath;
        const current = (await formioFetch(fetchPath, {}, cfg)) as Record<string, unknown>;
        const formId = (current._id as string) ?? formIdOrPath;
        const baseBody = definition ? mergeDraftOntoCurrent(current, definition) : current;
        const payload = note === undefined ? baseBody : { ...baseBody, _vnote: note };
        await formioFetch(`form/${formId}/draft`, {}, cfg, {
          method: 'PUT',
          body: payload,
        });
        // Upstream `PUT /form/:id/draft` returns the pre-update document on
        // overwrite (Mongoose `findOneAndUpdate` is missing `{ new: true }` in
        // FormResource.putDraft). Re-fetch to return ground truth — mirrors
        // what the portal does via a full page reload after each draft save.
        // Remove once the upstream bug is fixed.
        const saved = await formioFetch(`form/${formId}/draft`, {}, cfg);
        return toMcpTextResult(saved);
      } catch (error) {
        return toMcpError(error);
      }
    }
  );
}
