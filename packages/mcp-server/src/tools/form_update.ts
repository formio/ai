import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { FormioConfig } from '../config.js';
import { formioFetch } from '../formio-client.js';
import { toMcpStructuredResult, toMcpError } from '../mcp-responses.js';
import { formDocument } from '../output-schemas.js';
import { overwrites } from '../tool-annotations.js';
import { cwdSchema, resolveProjectConfig } from '../project-resolver.js';
import { formIdArgument, requireFormId } from './form-id.js';
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
        'Replace a form in the project `cwd` resolves to with the complete updated JSON: read it with form_get, apply the change using the formio-schema skill, and send the whole form.',
        'Pass `draft: true` to save a draft instead of the live form; publish it with form_publish, and restore a prior revision with form_revert.',
      ].join(' '),
      inputSchema: {
        cwd: cwdSchema,
        formId: formIdArgument(),
        form: z
          .looseObject({
            title: z.string().optional(),
            name: z.string().optional(),
            path: z.string().optional().describe('URL path, relative to the project'),
            components: z.array(z.record(z.string(), z.unknown())),
            type: z.enum(['form', 'resource']).optional(),
            display: z.enum(['form', 'wizard', 'pdf']).optional(),
            tags: z.array(z.string()).optional(),
            revisions: z
              .enum(['current', 'original', ''])
              .optional()
              .describe(
                'Revision mode. Omit to leave the stored value unchanged; "" turns history off and needs acceptNoHistory: true.'
              ),
          })
          .catchall(z.unknown())
          .describe('The complete updated form JSON'),
        note: z
          .string()
          .describe(
            'What changed against the live form, with no preamble ("Saved draft:", "Updated:")'
          ),
        draft: z
          .boolean()
          .optional()
          .describe(
            "When true, save a draft instead of the live form. Only the draft fields of `form` are saved (components, settings, tags, properties, controller, esign, display), over any existing draft; form_get's output can be passed as is."
          ),
        acceptNoHistory: z
          .boolean()
          .optional()
          .describe(
            'Set true only after the user agrees to save without revision history. Without it, such a save (no revisions licence, or the form has revisions off) is refused with HISTORY_NOT_ACCEPTED and nothing is written.'
          ),
      },
      outputSchema: formDocument,
      annotations: overwrites('Update a form'),
    },
    async ({ cwd, formId, form: rawForm, note, draft, acceptNoHistory }) => {
      try {
        requireFormId(formId);
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
