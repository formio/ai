import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { FormioConfig } from '../config.js';
import { formioFetch, isMongoId } from '../formio-client.js';
import { toMcpTextResult, toMcpError } from '../mcp-responses.js';
import { cwdSchema, resolveProjectConfig } from '../project-resolver.js';

export function registerFormRevisionGetTool(server: McpServer, config: FormioConfig) {
  server.tool(
    'form_revision_get',
    'Fetch a Form.io form definition at a specific revision. The `version` argument accepts either a sequential `_vid` number (e.g. 2) or a revision document `_id` (24-char Mongo ObjectId).',
    {
      cwd: cwdSchema,
      formIdOrPath: z
        .string()
        .describe('Form _id (24-char Mongo ObjectId) or path (e.g. "user/login")'),
      version: z
        .union([z.string(), z.number().int().nonnegative()])
        .describe('Sequential version number (`_vid`) or revision document `_id`'),
    },
    async ({ cwd, formIdOrPath, version }) => {
      try {
        const cfg = resolveProjectConfig(cwd, config);
        const formId = isMongoId(formIdOrPath)
          ? formIdOrPath
          : ((await formioFetch(formIdOrPath, {}, cfg)) as { _id: string })._id;
        const revision = await formioFetch(`form/${formId}/v/${version}`, {}, cfg);
        return toMcpTextResult(revision);
      } catch (error) {
        return toMcpError(error);
      }
    }
  );
}
