import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { FormioConfig } from '../config.js';
import { formioFetch, isMongoId } from '../formio-client.js';
import { toMcpStructuredResult, toMcpError } from '../mcp-responses.js';
import { formDocument } from '../output-schemas.js';
import { reads } from '../tool-annotations.js';
import { cwdSchema, resolveProjectConfig } from '../project-resolver.js';
import { projectPathArgument, resourceSegmentArgument } from './path-arguments.js';

export function registerFormRevisionGetTool(server: McpServer, config: FormioConfig) {
  server.registerTool(
    'form_revision_get',
    {
      description:
        'Fetch one immutable form revision from the project `cwd` resolves to. Restore it with form_revert, passing its `_vid`.',
      inputSchema: {
        cwd: cwdSchema,
        formIdOrPath: projectPathArgument('formIdOrPath').describe(
          'Form ID (_id) or path alias (e.g. "user/login")'
        ),
        version: resourceSegmentArgument('version').describe(
          'Revision _vid (e.g. "3") or revision document _id'
        ),
      },
      // A revision body is a form definition, plus the revision fields the schema
      // passes through.
      outputSchema: formDocument,
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
