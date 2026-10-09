import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { FormioConfig } from '../config.js';
import { isMongoId } from '../formio-client.js';
import { toMcpStructuredResult, toMcpError } from '../mcp-responses.js';
import { revisionsListOutput } from '../output-schemas.js';
import { reads } from '../tool-annotations.js';
import { cwdSchema, resolveProjectConfig } from '../project-resolver.js';
import { fetchListPage, listArguments, listResult } from './list-contract.js';
import { projectPathArgument } from './path-arguments.js';

// Form.io's revision index has no default sort, and a full revision carries the
// whole form definition; newest first and compact metadata is what a caller wants.
const DEFAULTS = { sort: '-_vid', select: '_id,_vid,_vnote,_vuser,created,modified' };

export function registerFormRevisionListTool(server: McpServer, config: FormioConfig) {
  server.registerTool(
    'form_revision_list',
    {
      description:
        "List a form's published revision summaries in the project `cwd` resolves to, newest first, one page at a time. Read one with form_revision_get, or restore one with form_revert, passing its `_vid`.",
      inputSchema: {
        cwd: cwdSchema,
        formIdOrPath: projectPathArgument('formIdOrPath').describe(
          'Form ID (_id) or path alias (e.g. "user/login")'
        ),
        ...listArguments(DEFAULTS),
      },
      outputSchema: revisionsListOutput,
      annotations: reads('List form revisions'),
    },
    async ({ cwd, formIdOrPath, ...query }) => {
      try {
        const cfg = resolveProjectConfig(cwd, config);
        const base = isMongoId(formIdOrPath) ? `form/${formIdOrPath}` : formIdOrPath;
        const page = await fetchListPage({
          path: `${base}/v`,
          query,
          config: cfg,
          defaults: DEFAULTS,
        });
        return toMcpStructuredResult(listResult('revisions', page));
      } catch (error) {
        return toMcpError(error);
      }
    }
  );
}
