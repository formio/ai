import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { FormioConfig } from '../config.js';
import { MONGO_ID_PATTERN } from '../formio-client.js';
import { toMcpStructuredResult, toMcpError } from '../mcp-responses.js';
import { formDocument } from '../output-schemas.js';
import { overwrites } from '../tool-annotations.js';
import { cwdSchema, resolveProjectConfig } from '../project-resolver.js';
import { requireRevisionsLicense, revertToRevision } from '../revisions/index.js';
import { resourceSegmentArgument } from './path-arguments.js';

export function registerFormRevertTool(server: McpServer, config: FormioConfig) {
  server.registerTool(
    'form_revert',
    {
      description:
        "Revert a form in the Form.io project mapped to the user's current working directory to a prior revision. The revision's components, tags, properties and display replace the live form's, and `note` is recorded as the revision note. Find the revision with form_revision_list. Needs the revisions licence (Security Module) on the deployment.",
      inputSchema: {
        cwd: cwdSchema,
        formId: z
          .string()
          .regex(MONGO_ID_PATTERN, 'Must be a 24-character MongoDB ObjectId')
          .describe('The _id of the form to revert'),
        version: resourceSegmentArgument('version').describe(
          'The revision to restore: its _vid (e.g. "3") or its revision document _id'
        ),
        note: z
          .string()
          .describe(
            'Revision note; use "Reverted to version {version}" unless the user gives another'
          ),
      },
      outputSchema: formDocument,
      annotations: overwrites('Revert a form'),
    },
    async ({ cwd, formId, version, note }) => {
      try {
        const cfg = resolveProjectConfig(cwd, config);
        await requireRevisionsLicense(cfg, 'revert this form');
        return toMcpStructuredResult(
          (await revertToRevision({ formId, version, _vnote: note, cfg })) as Record<
            string,
            unknown
          >
        );
      } catch (error) {
        return toMcpError(error);
      }
    }
  );
}
