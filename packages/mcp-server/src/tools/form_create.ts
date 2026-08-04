import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { FormioConfig } from '../config.js';
import { formioFetch } from '../formio-client.js';
import { toMcpStructuredResult, toMcpError } from '../mcp-responses.js';
import { formShape } from '../output-schemas.js';
import { creates } from '../tool-annotations.js';
import { cwdSchema, resolveProjectConfig } from '../project-resolver.js';
import { gateRevisionsLicense, prefixVnote } from '../revisions/index.js';

export function registerFormCreateTool(server: McpServer, config: FormioConfig) {
  server.registerTool(
    'form_create',
    {
      description:
        'Create a new form in the Form.io project mapped to the user\'s current working directory. IMPORTANT: Before calling this tool, use the formio-schema skill to construct a properly structured Form.io form JSON definition based on the user\'s requirements. The skill documents all component types, validation options, layout patterns, and conditional logic available in Form.io. New forms default to `revisions: \'original\'` so form change history is preserved. NOT for: creating a draft revision of an existing form. When the user says "create/save a draft", "draft <change>", call form_update with `formId` and `draft: true` instead.',
      inputSchema: {
        cwd: cwdSchema,
        form: z
          .looseObject({
            title: z.string().describe('Human-readable form title'),
            name: z.string().describe('Machine name for API references'),
            path: z.string().describe('URL path segment for the form'),
            components: z
              .array(z.record(z.string(), z.unknown()))
              .describe('Array of form components'),
            type: z.enum(['form', 'resource']).optional().describe('Form type (default: "form")'),
            display: z
              .enum(['form', 'wizard', 'pdf'])
              .optional()
              .describe('Display mode (default: "form")'),
            tags: z.array(z.string()).optional().describe('Tags for categorization'),
            revisions: z
              .enum(['current', 'original', ''])
              .optional()
              .describe('Revision mode (default: "original"). Pass "" to disable'),
          })
          .catchall(z.unknown())
          .describe('Form.io form JSON definition'),
        note: z.string().optional().describe('Note describing the initial revision'),
      },
      outputSchema: formShape,
      annotations: creates('Create a form'),
    },
    async ({ cwd, form: rawForm, note }) => {
      try {
        const cfg = resolveProjectConfig(cwd, config);
        const { licensed, form } = await gateRevisionsLicense(server, cfg, {
          actionLabel: 'create this form',
          requiresRevisions: false,
          form: rawForm,
        });
        const created = (await formioFetch('form', {}, cfg, {
          method: 'POST',
          body: {
            // gate already stripped `revisions` on unlicensed deployments; on
            // licensed ones default to 'original' unless the caller overrode.
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
