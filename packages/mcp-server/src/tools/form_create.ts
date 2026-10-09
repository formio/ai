import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { FormioConfig } from '../config.js';
import { formioFetch } from '../formio-client.js';
import { toMcpStructuredResult, toMcpError } from '../mcp-responses.js';
import { formDocument } from '../output-schemas.js';
import { creates } from '../tool-annotations.js';
import { cwdSchema, resolveProjectConfig } from '../project-resolver.js';
import { gateRevisionsLicense, prefixVnote } from '../revisions/index.js';

export function registerFormCreateTool(server: McpServer, config: FormioConfig) {
  server.registerTool(
    'form_create',
    {
      description:
        'Create a form in the project `cwd` resolves to. Build the form JSON with the formio-schema skill first. On a deployment licensed for revisions, `revisions` defaults to "original". Not for a draft of an existing form ("save a draft", "draft <change>"): use form_update with `draft: true`.',
      inputSchema: {
        cwd: cwdSchema,
        form: z
          .looseObject({
            title: z.string(),
            name: z.string(),
            path: z.string().describe('URL path, relative to the project'),
            components: z.array(z.record(z.string(), z.unknown())),
            type: z.enum(['form', 'resource']).optional().describe('Default "form"'),
            display: z.enum(['form', 'wizard', 'pdf']).optional().describe('Default "form"'),
            tags: z.array(z.string()).optional(),
            revisions: z
              .enum(['current', 'original', ''])
              .optional()
              .describe(
                'Revision mode (default: "original"). "" turns history off and needs acceptNoHistory: true'
              ),
          })
          .catchall(z.unknown())
          .describe('Form.io form JSON definition'),
        note: z.string().optional().describe('Note describing the initial revision'),
        acceptNoHistory: z
          .boolean()
          .optional()
          .describe(
            'Set true only after the user agrees to save without revision history. Without it, such a save (no revisions licence, or the form has revisions off) is refused with HISTORY_NOT_ACCEPTED and nothing is written.'
          ),
      },
      outputSchema: formDocument,
      annotations: creates('Create a form'),
    },
    async ({ cwd, form: rawForm, note, acceptNoHistory }) => {
      try {
        const cfg = resolveProjectConfig(cwd, config);
        const { licensed, form } = await gateRevisionsLicense({
          cfg,
          actionLabel: 'create this form',
          form: rawForm,
          acceptNoHistory,
        });
        const created = (await formioFetch('form', {}, cfg, {
          method: 'POST',
          body: {
            // The gate already stripped `revisions` on unlicensed deployments; on
            // licensed ones default to 'original' unless the caller overrode. Where the
            // licence is unknown the body goes as written: no default is claimed.
            ...(licensed ? { revisions: 'original', ...form } : form),
            ...(note && { _vnote: prefixVnote(note) }),
          },
        })) as Record<string, unknown>;
        return toMcpStructuredResult(created);
      } catch (error) {
        return toMcpError(error);
      }
    }
  );
}
