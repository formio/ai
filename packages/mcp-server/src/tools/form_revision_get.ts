import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { FormioConfig } from '../config.js';
import { formioFetch, isMongoId } from '../formio-client.js';
import { toMcpTextResult, toMcpError } from '../mcp-responses.js';
import { cwdSchema, resolveProjectConfig } from '../project-resolver.js';

export function registerFormRevisionGetTool(server: McpServer, config: FormioConfig) {
  server.tool(
    'form_revision_get',
    'Fetch a single immutable form revision from the Form.io project mapped to the current working directory. `version` accepts either the revision `_vid` (e.g. "3") or the revision document `_id` (24-character hex). To revert the live form to this revision, pass its `form` body to `form_update` with a `note` like `Revert to v<vid>`.',
    {
      cwd: cwdSchema,
      formIdOrPath: z.string().describe('Form ID (_id) or path alias (e.g. "user/login")'),
      version: z.string().describe('Revision _vid (e.g. "3") or revision document _id'),
    },
    async ({ cwd, formIdOrPath, version }) => {
      try {
        const cfg = resolveProjectConfig(cwd, config);
        const base = isMongoId(formIdOrPath) ? `form/${formIdOrPath}` : formIdOrPath;
        const revision = await formioFetch(`${base}/v/${version}`, {}, cfg);
        return toMcpTextResult(revision);
      } catch (error) {
        return toMcpError(error);
      }
    }
  );
}
