import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { FormioConfig } from '../config.js';
import { formioFetch, MONGO_ID_PATTERN } from '../formio-client.js';
import { toMcpTextResult, toMcpError } from '../mcp-responses.js';
import { cwdSchema, resolveProjectConfig } from '../project-resolver.js';

export function registerFormUpdateTool(server: McpServer, config: FormioConfig) {
  server.tool(
    'form_update',
    'Update an existing form in the Form.io project mapped to the user\'s current working directory. IMPORTANT: Before calling this tool, first use form_get to fetch the current form definition, then use the formio-form skill to apply the requested modifications (add, remove, or modify fields and settings), and finally call this tool with the complete updated form JSON. DO NOT use for adding a revision: if the form has `revisions: "current"` or `"original"`, use `form_draft_create` then `form_draft_publish` instead. NEVER use as a fallback when `form_draft_create` or `form_draft_publish` fails — surface those errors to the user.',
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
        })
        .catchall(z.unknown())
        .describe('Complete updated Form.io form JSON definition'),
    },
    async ({ cwd, formId, form }) => {
      try {
        const cfg = resolveProjectConfig(cwd, config);
        const updated = await formioFetch(`form/${formId}`, {}, cfg, {
          method: 'PUT',
          body: form,
        });
        return toMcpTextResult(updated);
      } catch (error) {
        return toMcpError(error);
      }
    }
  );
}
