import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { FormioConfig } from '../config.js';
import { formioFetch, isMongoId } from '../formio-client.js';
import { toMcpTextResult, toMcpError } from '../mcp-responses.js';
import { cwdSchema, resolveProjectConfig } from '../project-resolver.js';

export function registerFormDraftGetTool(server: McpServer, config: FormioConfig) {
  server.tool(
    'form_draft_get',
    'Fetch the current active draft of a Form.io form (the mutable `_vid: "draft"` row in `formrevisions`). Use this when reading the in-progress draft body before editing or publishing it. For an immutable, numbered published revision, use `form_revision_get` instead. Returns 404 if the form has no saved draft or revisions are not enabled.',
    {
      cwd: cwdSchema,
      formIdOrPath: z
        .string()
        .describe('Form _id (24-char Mongo ObjectId) or path (e.g. "user/login")'),
    },
    async ({ cwd, formIdOrPath }) => {
      try {
        const cfg = resolveProjectConfig(cwd, config);
        const formId = isMongoId(formIdOrPath)
          ? formIdOrPath
          : ((await formioFetch(formIdOrPath, {}, cfg)) as { _id: string })._id;
        const draft = await formioFetch(`form/${formId}/draft`, {}, cfg);
        return toMcpTextResult(draft);
      } catch (error) {
        return toMcpError(error);
      }
    }
  );
}
