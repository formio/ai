import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { FormioConfig } from '../config.js';
import { formioFetch } from '../formio-client.js';
import { toMcpTextResult, toMcpError } from '../mcp-responses.js';
import { cwdSchema, resolveProjectConfig } from '../project-resolver.js';

export function registerFormCreateTool(server: McpServer, config: FormioConfig) {
  server.tool(
    'form_create',
    "Create a new form in the Form.io project mapped to the user's current working directory. IMPORTANT: Before calling this tool, use the formio-schema skill to construct a properly structured Form.io form JSON definition based on the user's requirements. The skill documents all component types, validation options, layout patterns, and conditional logic available in Form.io.",
    {
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
        })
        .catchall(z.unknown())
        .describe('Form.io form JSON definition'),
    },
    async ({ cwd, form }) => {
      try {
        const cfg = resolveProjectConfig(cwd, config);
        const created = await formioFetch('form', {}, cfg, {
          method: 'POST',
          body: form,
        });
        return toMcpTextResult(created);
      } catch (error) {
        return toMcpError(error);
      }
    }
  );
}
