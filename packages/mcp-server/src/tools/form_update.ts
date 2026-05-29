import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { FormioConfig } from '../config.js';
import { formioFetch, MONGO_ID_PATTERN } from '../formio-client.js';
import { toMcpTextResult, toMcpError } from '../mcp-responses.js';
import { cwdSchema, resolveProjectConfig } from '../project-resolver.js';
import {
  gateRevisionsLicense,
  gateRevisionsTracking,
  prefixVnote,
  publishDraft,
  revertToRevision,
  saveDraft,
} from '../revisions/index.js';

export function registerFormUpdateTool(server: McpServer, config: FormioConfig) {
  server.tool(
    'form_update',
    [
      "Update an existing form in the Form.io project mapped to the user's current working directory. IMPORTANT: Before calling this tool, first use form_get to fetch the current form definition, then use the formio-form skill to apply the requested modifications (add, remove, or modify fields and settings), and finally call this tool with the complete updated form JSON.",
      '`draft`, `publish`, and `revert` are mutually exclusive — pass at most one.',
      'If `revisions` in the response differs from the stored value, the per-form revisions-mode gate prompted the USER and they chose.',
    ].join(' '),
    {
      cwd: cwdSchema,
      formId: z
        .string()
        .regex(MONGO_ID_PATTERN, 'Must be a 24-character MongoDB ObjectId')
        .describe('The _id of the form to update'),
      form: z
        .looseObject({
          title: z.string().optional().describe('Human-readable form title'),
          name: z.string().optional().describe('Machine name for API references'),
          path: z.string().optional().describe('URL path segment for the form'),
          components: z
            .array(z.record(z.string(), z.unknown()))
            .describe('Array of form components'),
          type: z.enum(['form', 'resource']).optional().describe('Form type'),
          display: z.enum(['form', 'wizard', 'pdf']).optional().describe('Display mode'),
          tags: z.array(z.string()).optional().describe('Tags for categorization'),
          revisions: z
            .enum(['current', 'original', ''])
            .optional()
            .describe(
              'Revision mode. Pass "" to disable; omit to leave the stored value unchanged.'
            ),
        })
        .catchall(z.unknown())
        .describe('Complete updated Form.io form JSON definition'),
      note: z
        .string()
        .describe(
          'Required note describing the diff (live form vs updated body) — no action preambles ("Published draft:", "Saved draft:", "Reverted:"). For `revert: true`, default to "Reverted to version {version}" unless the user explicitly provides a different note.'
        ),
      draft: z
        .boolean()
        .optional()
        .describe(
          'When true, create or update a draft (PUT /form/{formId}/draft) instead of publishing. Caller `form` fields merge on top of existing draft fields, preserving prior unpublished draft edits.'
        ),
      publish: z
        .boolean()
        .optional()
        .describe(
          'When true, publish the current draft. Caller `form` body is ignored; only allowlisted revision fields flow from existing draft to live (PUT /form/{formId}).'
        ),
      revert: z
        .boolean()
        .optional()
        .describe(
          'When true, revert the live form to a prior revision. Requires `version`. Caller `form` body is ignored; only allowlisted revision fields flow from the revision to live.'
        ),
      version: z
        .string()
        .optional()
        .describe(
          'Revision identifier for `revert: true` — either the revision `_vid` (e.g. "3") or the revision document `_id` (24-char hex).'
        ),
    },
    async ({ cwd, formId, form: rawForm, note, draft, publish, revert, version }) => {
      try {
        const exclusiveFlags = [draft, publish, revert].filter(Boolean);
        if (exclusiveFlags.length > 1) {
          throw new Error(
            '`draft`, `publish`, and `revert` flags are mutually exclusive — pass only one.'
          );
        }
        if (revert && !version) {
          throw new Error('`revert: true` requires `version` (revision `_vid` or document `_id`).');
        }
        const cfg = resolveProjectConfig(cwd, config);

        const actionLabel = `${revert ? 'revert' : publish ? 'publish' : draft ? 'save a draft of' : 'update'} this form`;
        const { licensed, form } = await gateRevisionsLicense(server, cfg, {
          actionLabel,
          requiresRevisions: Boolean(draft || publish || revert),
          form: rawForm,
        });

        if (revert || publish || draft) {
          const args = { formId, _vnote: note, cfg };
          return toMcpTextResult(
            await (revert && version
              ? revertToRevision({ ...args, version })
              : publish
                ? publishDraft(args)
                : saveDraft({ ...args, form }))
          );
        }

        // Standard PUT path. Apply per-form revisions consent (prompts when
        // the stored form has revisions disabled and the caller did not opt
        // in via `revisions: 'original'|'current'`).
        const putBody = await gateRevisionsTracking(server, {
          formId,
          form,
          licensed,
          cfg,
        });

        return toMcpTextResult(
          await formioFetch(`form/${formId}`, {}, cfg, {
            method: 'PUT',
            body: { ...putBody, _vnote: prefixVnote(note) },
          })
        );
      } catch (error) {
        return toMcpError(error);
      }
    }
  );
}
