import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { FormioConfig } from '../config.js';
import { formioFetch, isMongoId } from '../formio-client.js';
import { toMcpTextResult, toMcpError } from '../mcp-responses.js';
import { cwdSchema, resolveProjectConfig } from '../project-resolver.js';

const REVISION_MODE_DESCRIPTION =
  'Required. `revisions` field value: "current" or "original" enables (display mode for historical submissions); "" disables. Ask the user — no default.';

const TOOL_DESCRIPTION = [
  'Set the Form.io form `revisions` field via PUT /form/:id. Use to enable, switch display mode, or disable revisions.',
  '`mode` is REQUIRED ("current" | "original" | ""). Ask the user — no default.',
  '"" disables (server preserves `_vid` and existing revision rows). No-op when form already has the requested mode.',
  'See `project-form-revisions` skill reference for mode semantics.',
].join(' ');

interface FormDoc {
  _id: string;
  revisions?: string;
  [key: string]: unknown;
}

export function registerFormRevisionsSetTool(server: McpServer, config: FormioConfig) {
  server.tool(
    'form_revisions_set',
    TOOL_DESCRIPTION,
    {
      cwd: cwdSchema,
      formIdOrPath: z
        .string()
        .describe('Form _id (24-char Mongo ObjectId) or path (e.g. "user/login")'),
      mode: z.enum(['current', 'original', '']).describe(REVISION_MODE_DESCRIPTION),
    },
    async ({ cwd, formIdOrPath, mode }) => {
      try {
        const cfg = resolveProjectConfig(cwd, config);
        const fetchPath = isMongoId(formIdOrPath) ? `form/${formIdOrPath}` : formIdOrPath;
        const form = (await formioFetch(fetchPath, {}, cfg)) as FormDoc;

        const current = form.revisions ?? '';
        if (current === mode) {
          return toMcpTextResult(form);
        }

        const merged = { ...form, revisions: mode };
        const updated = await formioFetch(`form/${form._id}`, {}, cfg, {
          method: 'PUT',
          body: merged,
        });
        return toMcpTextResult(updated);
      } catch (error) {
        return toMcpError(error);
      }
    }
  );
}
