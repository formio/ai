import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { FormioConfig } from '../config.js';
import { formioFetch, MONGO_ID_PATTERN } from '../formio-client.js';
import { toMcpStructuredResult, toMcpError } from '../mcp-responses.js';
import { formDocument } from '../output-schemas.js';
import { overwrites } from '../tool-annotations.js';
import { cwdSchema, resolveProjectConfig } from '../project-resolver.js';
import {
  gateFormHistory,
  gateRevisionsLicense,
  prefixVnote,
  requireRevisionsLicense,
  saveDraft,
} from '../revisions/index.js';

export function registerFormUpdateTool(server: McpServer, config: FormioConfig) {
  server.registerTool(
    'form_update',
    {
      description: [
        "Update an existing form in the Form.io project mapped to the user's current working directory. IMPORTANT: Before calling this tool, first use form_get to fetch the current form definition, then use the formio-schema skill to understand the schema so that you can apply the requested modifications (add, remove, or modify fields and settings), and finally call this tool with the complete updated form JSON.",
        'Pass `draft: true` to save the change as a draft instead of the live form; publish it with form_publish, and restore a prior revision with form_revert.',
      ].join(' '),
      inputSchema: {
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
                'Revision mode. Omit to leave the stored value unchanged; "" turns history off and needs acceptNoHistory: true.'
              ),
          })
          .catchall(z.unknown())
          .describe('Complete updated Form.io form JSON definition'),
        note: z
          .string()
          .describe(
            'Required note describing the diff (live form vs updated body) — no action preambles ("Saved draft:", "Updated:").'
          ),
        draft: z
          .boolean()
          .optional()
          .describe(
            "When true, save a draft (PUT /form/{formId}/draft) instead of the live form. Only the draft fields of `form` are saved (components, settings, tags, properties, controller, esign, display), merged over any existing draft; every other field is ignored, so form_get's output can be passed as is."
          ),
        acceptNoHistory: z
          .boolean()
          .optional()
          .describe(
            'Set to true only after the user agrees to save without revision history. Without it, a save that would keep no history (a deployment without the revisions licence, or a form whose revisions are off) is refused with HISTORY_NOT_ACCEPTED and nothing is written.'
          ),
      },
      outputSchema: formDocument,
      annotations: overwrites('Update a form'),
    },
    async ({ cwd, formId, form: rawForm, note, draft, acceptNoHistory }) => {
      try {
        const cfg = resolveProjectConfig(cwd, config);

        if (draft) {
          await requireRevisionsLicense(cfg, 'save a draft of this form');
          return toMcpStructuredResult(
            (await saveDraft({ formId, form: rawForm, _vnote: note, cfg })) as Record<
              string,
              unknown
            >
          );
        }

        const { licensed, form } = await gateRevisionsLicense({
          cfg,
          actionLabel: 'update this form',
          form: rawForm,
          acceptNoHistory,
        });
        if (licensed) {
          await gateFormHistory({ cfg, formId, form, acceptNoHistory });
        }

        return toMcpStructuredResult(
          (await formioFetch(`form/${formId}`, {}, cfg, {
            method: 'PUT',
            body: { ...form, _vnote: prefixVnote(note) },
          })) as Record<string, unknown>
        );
      } catch (error) {
        return toMcpError(error);
      }
    }
  );
}
