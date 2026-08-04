import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { FormioConfig } from '../config.js';
import { formioFetch, isMongoId } from '../formio-client.js';
import { toMcpStructuredResult, toMcpError } from '../mcp-responses.js';
import { revisionsListShape } from '../output-schemas.js';
import { reads } from '../tool-annotations.js';
import { cwdSchema, resolveProjectConfig } from '../project-resolver.js';

export function registerFormRevisionsListTool(server: McpServer, config: FormioConfig) {
  server.registerTool(
    'form_revisions_list',
    {
      description:
        'List immutable published revision summaries for a single form in the Form.io project mapped to the current working directory. Returns compact revision metadata (_vid, _id, modified, user, _vnote) for the form identified by `formIdOrPath`. To inspect a specific revision body, call `form_revision_get` with the desired `_vid`. To revert the live form to a prior revision, pass that revision body to `form_update` with a `note` like `Revert to v<vid>`.',
      inputSchema: {
        cwd: cwdSchema,
        formIdOrPath: z.string().describe('Form ID (_id) or path alias (e.g. "user/login")'),
      },
      outputSchema: revisionsListShape,
      annotations: reads('List form revisions'),
    },
    async ({ cwd, formIdOrPath }) => {
      try {
        const cfg = resolveProjectConfig(cwd, config);
        const base = isMongoId(formIdOrPath) ? `form/${formIdOrPath}` : formIdOrPath;
        const revisions = (await formioFetch(`${base}/v`, {}, cfg)) as Record<string, unknown>[];
        return toMcpStructuredResult({ revisions, count: revisions.length });
      } catch (error) {
        return toMcpError(error);
      }
    }
  );
}
