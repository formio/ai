import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { FormioConfig } from '../config.js';
import { toMcpStructuredResult, toMcpError } from '../mcp-responses.js';
import { formDocument } from '../output-schemas.js';
import { overwrites } from '../tool-annotations.js';
import { cwdSchema } from '../project-resolver.js';
import { resolveToolConfig } from './project-resolution.js';
import { formIdArgument, requireFormId } from './form-id.js';
import { publishDraft, requireRevisionsLicense } from '../revisions/index.js';

export function registerFormPublishTool(server: McpServer, config: FormioConfig) {
  server.registerTool(
    'form_publish',
    {
      description:
        "Publish a form's draft as its live version in the project `cwd` resolves to. Save the draft first with form_update and `draft: true`; a form with no draft fails with NO_DRAFT. Needs the revisions licence (Security Module).",
      inputSchema: {
        cwd: cwdSchema,
        formId: formIdArgument(),
        note: z
          .string()
          .describe(
            'Revision note describing what the draft changes against the live form (e.g. "Add phone field")'
          ),
      },
      outputSchema: formDocument,
      annotations: overwrites('Publish a form draft'),
    },
    async ({ cwd, formId, note }) => {
      try {
        requireFormId(formId);
        const cfg = await resolveToolConfig({ server, cwd, config });
        await requireRevisionsLicense(cfg, "publish this form's draft");
        return toMcpStructuredResult(
          (await publishDraft({ formId, _vnote: note, cfg })) as Record<string, unknown>
        );
      } catch (error) {
        return toMcpError(error);
      }
    }
  );
}
