import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { FormioConfig } from '../config.js';
import { MONGO_ID_PATTERN } from '../formio-client.js';
import { toMcpStructuredResult, toMcpError } from '../mcp-responses.js';
import { formDocument } from '../output-schemas.js';
import { overwrites } from '../tool-annotations.js';
import { cwdSchema, resolveProjectConfig } from '../project-resolver.js';
import { publishDraft, requireRevisionsLicense } from '../revisions/index.js';

export function registerFormPublishTool(server: McpServer, config: FormioConfig) {
  server.registerTool(
    'form_publish',
    {
      description:
        "Publish a form's draft as its live version in the Form.io project mapped to the user's current working directory. The draft's components, settings, tags, properties, controller, esign and display replace the live form's, and `note` is recorded as the revision note. Save a draft first with form_update and draft: true; a form with no draft fails with NO_DRAFT. Needs the revisions licence (Security Module) on the deployment.",
      inputSchema: {
        cwd: cwdSchema,
        formId: z
          .string()
          .regex(MONGO_ID_PATTERN, 'Must be a 24-character MongoDB ObjectId')
          .describe('The _id of the form whose draft to publish'),
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
        const cfg = resolveProjectConfig(cwd, config);
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
