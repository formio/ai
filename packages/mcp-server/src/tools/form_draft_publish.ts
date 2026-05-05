import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { FormioConfig } from '../config.js';
import { formioFetch, isMongoId } from '../formio-client.js';
import { toMcpTextResult, toMcpError } from '../mcp-responses.js';
import { cwdSchema, resolveProjectConfig } from '../project-resolver.js';
import { mergeDraftOntoCurrent } from './form-draft-merge.js';

const TOOL_DESCRIPTION = [
  'Publish a Form.io form draft as the next revision via PUT /form/:id.',
  'Canonical path to add a new revision on a revision-enabled form: pair with `form_draft_create` (save proposed change as draft) then call this to publish.',
  'Default: fetches saved draft + current published form, overlays draft fields onto current, then publishes. Pass `definition` to publish a caller-supplied body directly.',
  "Optional `note` becomes the new revision's `_vnote`. The draft's own `_vnote` is dropped — do NOT auto-forward it; draft and publish notes are independent.",
  'Server auto-clears the saved draft on success. No-op when the body matches the current published form.',
  'If this call fails (e.g., revisions disabled, license missing, auth error), DO NOT fall back to `form_update` — surface the error to the user. The user asked to publish a revision; silently overwriting the live form is not an acceptable substitute.',
  'See `project-form-revisions` skill reference for full overlay-field list and edge cases.',
].join(' ');

export function registerFormDraftPublishTool(server: McpServer, config: FormioConfig) {
  server.tool(
    'form_draft_publish',
    TOOL_DESCRIPTION,
    {
      cwd: cwdSchema,
      formIdOrPath: z
        .string()
        .describe('Form _id (24-char Mongo ObjectId) or path (e.g. "user/login")'),
      definition: z
        .record(z.string(), z.unknown())
        .optional()
        .describe('Full form JSON to publish. Omit to publish the saved draft (the default).'),
      note: z
        .string()
        .optional()
        .describe(
          "Free-text note attached to the published revision as `_vnote`. Provide ONLY if the user has explicitly stated what the published revision's note should be. Do NOT auto-populate from the draft's `_vnote` — draft notes and publish notes are independent. When in doubt, omit this argument."
        ),
    },
    async ({ cwd, formIdOrPath, definition, note }) => {
      try {
        const cfg = resolveProjectConfig(cwd, config);
        const formId = isMongoId(formIdOrPath)
          ? formIdOrPath
          : ((await formioFetch(formIdOrPath, {}, cfg)) as { _id: string })._id;

        let baseBody: Record<string, unknown>;
        if (definition) {
          baseBody = definition;
        } else {
          const [draft, current] = await Promise.all([
            formioFetch(`form/${formId}/draft`, {}, cfg) as Promise<Record<string, unknown>>,
            formioFetch(`form/${formId}`, {}, cfg) as Promise<Record<string, unknown>>,
          ]);
          baseBody = mergeDraftOntoCurrent(current, draft);
        }
        // Match portal behavior: a draft's `_vnote` does NOT carry over to the
        // published revision. The published revision's `_vnote` is only the
        // value the caller explicitly passes via `note` here, mirroring how
        // the portal collects "Revision notes" at publish time independently
        // from any in-progress draft note.
        const { _vnote: _strippedVnote, ...bodyWithoutDraftVnote } = baseBody;
        void _strippedVnote;
        const body =
          note === undefined ? bodyWithoutDraftVnote : { ...bodyWithoutDraftVnote, _vnote: note };

        const published = await formioFetch(`form/${formId}`, {}, cfg, {
          method: 'PUT',
          body,
        });
        return toMcpTextResult(published);
      } catch (error) {
        return toMcpError(error);
      }
    }
  );
}
