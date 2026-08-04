import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { FormioConfig } from '../config.js';
import { formioFetch, isMongoId } from '../formio-client.js';
import { toMcpStructuredResult, toMcpError } from '../mcp-responses.js';
import { formShape } from '../output-schemas.js';
import { reads } from '../tool-annotations.js';
import { cwdSchema, resolveProjectConfig } from '../project-resolver.js';

export function registerFormRevisionGetTool(server: McpServer, config: FormioConfig) {
  server.registerTool(
    'form_revision_get',
    {
      description:
        'Fetch a single immutable form revision from the Form.io project mapped to the current working directory. `version` accepts either the revision `_vid` (e.g. "3") or the revision document `_id` (24-character hex). To revert the live form to this revision, pass its `form` body to `form_update` with a `note` like `Revert to v<vid>`.',
      inputSchema: {
        cwd: cwdSchema,
        formIdOrPath: z.string().describe('Form ID (_id) or path alias (e.g. "user/login")'),
        version: z.string().describe('Revision _vid (e.g. "3") or revision document _id'),
      },
      // A revision body is a form definition, plus the revision fields the schema
      // passes through.
      outputSchema: formShape,
      annotations: reads('Get a form revision'),
    },
    async ({ cwd, formIdOrPath, version }) => {
      try {
        const cfg = resolveProjectConfig(cwd, config);
        const base = isMongoId(formIdOrPath) ? `form/${formIdOrPath}` : formIdOrPath;
        const revision = (await formioFetch(`${base}/v/${version}`, {}, cfg)) as Record<
          string,
          unknown
        >;
        return toMcpStructuredResult(revision);
      } catch (error) {
        return toMcpError(error);
      }
    }
  );
}
