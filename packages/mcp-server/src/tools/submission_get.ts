import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { FormioConfig } from '../config.js';
import { isMongoId } from '../formio-client.js';
import { toMcpStructuredResult, toMcpError } from '../mcp-responses.js';
import { reads } from '../tool-annotations.js';
import { cwdSchema, resolveProjectConfig } from '../project-resolver.js';
import {
  SCOPE_SENTENCE,
  GUIDELINE_PATH,
  agentRecordShape,
  submissionIdSchema,
  scopeContext,
  resolveFormId,
  fetchVerified,
  notFoundResult,
  invalidSubmissionIdResult,
} from './submission-scope.js';

export function registerSubmissionGetTool(server: McpServer, config: FormioConfig) {
  server.registerTool(
    'submission_get',
    {
      description: `Fetch one submission the agent created, by form and submission id. ${SCOPE_SENTENCE} Rules: ${GUIDELINE_PATH}.`,
      inputSchema: {
        cwd: cwdSchema,
        formIdOrPath: z
          .string()
          .describe('Form ID (_id) or path of the form the submission belongs to'),
        submissionId: submissionIdSchema,
      },
      outputSchema: agentRecordShape,
      annotations: reads('Get an agent-created submission'),
    },
    async ({ cwd, formIdOrPath, submissionId }) => {
      if (!isMongoId(submissionId)) {
        return invalidSubmissionIdResult(submissionId);
      }
      try {
        const cfg = resolveProjectConfig(cwd, config);
        const formId = await resolveFormId(formIdOrPath, cfg);
        const ctx = scopeContext(cfg, formId);
        const found = await fetchVerified(submissionId, ctx, cfg);
        return found ? toMcpStructuredResult({ ...found.record }) : notFoundResult(submissionId);
      } catch (error) {
        return toMcpError(error);
      }
    }
  );
}
