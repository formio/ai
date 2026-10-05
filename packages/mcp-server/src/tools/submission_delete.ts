import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { FormioConfig } from '../config.js';
import { formioFetch, isMongoId } from '../formio-client.js';
import { toMcpStructuredResult, toMcpError } from '../mcp-responses.js';
import { removes } from '../tool-annotations.js';
import { cwdSchema, resolveProjectConfig } from '../project-resolver.js';
import {
  SCOPE_SENTENCE,
  RULES_SENTENCE,
  submissionIdSchema,
  scopeContext,
  resolveFormId,
  fetchVerified,
  notFoundResult,
  invalidSubmissionIdResult,
  actionTitlesFor,
} from './submission-scope.js';

export function registerSubmissionDeleteTool(server: McpServer, config: FormioConfig) {
  server.registerTool(
    'submission_delete',
    {
      description: `Delete one submission the agent created — typically a test row once testing is done. ${SCOPE_SENTENCE} Deleting runs the form's delete actions; the result names the ones that ran. ${RULES_SENTENCE}`,
      inputSchema: {
        cwd: cwdSchema,
        formIdOrPath: z.string().describe('Form ID (_id) or path'),
        submissionId: submissionIdSchema,
      },
      outputSchema: { deleted: z.string(), triggeredActions: z.array(z.string()) },
      annotations: removes('Delete an agent submission'),
    },
    async ({ cwd, formIdOrPath, submissionId }) => {
      if (!isMongoId(submissionId)) return invalidSubmissionIdResult(submissionId);
      try {
        const cfg = resolveProjectConfig(cwd, config);
        const formId = await resolveFormId(formIdOrPath, cfg);
        const ctx = scopeContext(cfg, formId);
        if (!(await fetchVerified(submissionId, ctx, cfg))) return notFoundResult(submissionId);

        const triggeredActions = await actionTitlesFor(formId, 'delete', cfg);
        await formioFetch(`form/${formId}/submission/${submissionId}`, {}, cfg, {
          method: 'DELETE',
          responseType: 'text',
        });
        return toMcpStructuredResult({ deleted: submissionId, triggeredActions });
      } catch (error) {
        return toMcpError(error);
      }
    }
  );
}
