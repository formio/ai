import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { FormioConfig } from '../config.js';
import { toMcpStructuredResult, toMcpError } from '../mcp-responses.js';
import { formDocument } from '../output-schemas.js';
import { overwrites } from '../tool-annotations.js';
import { cwdSchema, resolveProjectConfig } from '../project-resolver.js';
import { formIdArgument, requireFormId } from './form-id.js';
import { requireRevisionsLicense, revertToRevision } from '../revisions/index.js';
import { resourceSegmentArgument } from './path-arguments.js';

export function registerFormRevertTool(server: McpServer, config: FormioConfig) {
  server.registerTool(
    'form_revert',
    {
      description:
        "Revert a form in the project `cwd` resolves to back to a prior revision: its components, tags, properties and display replace the live form's. Find it with form_revision_list. Needs the revisions licence (Security Module).",
      inputSchema: {
        cwd: cwdSchema,
        formId: formIdArgument(),
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
        requireFormId(formId);
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
