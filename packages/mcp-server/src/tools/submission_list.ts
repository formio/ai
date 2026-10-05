import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { FormioConfig } from '../config.js';
import { formioFetch } from '../formio-client.js';
import { toMcpStructuredResult, toMcpError } from '../mcp-responses.js';
import { reads } from '../tool-annotations.js';
import { cwdSchema, resolveProjectConfig } from '../project-resolver.js';
import {
  buildListQuery,
  verifyRecord,
  type AgentRecord,
  type SubmissionPurpose,
} from '../agent-scope.js';
import {
  SCOPE_SENTENCE,
  GUIDELINE_PATH,
  agentRecordShape,
  purposeSchema,
  scopeContext,
  resolveFormId,
} from './submission-scope.js';

export function registerSubmissionListTool(server: McpServer, config: FormioConfig) {
  server.registerTool(
    'submission_list',
    {
      description: `List the submissions the agent created on one form, optionally by purpose and data-field filters. ${SCOPE_SENTENCE} Records that fail verification are dropped and counted, never described. Rules: ${GUIDELINE_PATH}.`,
      inputSchema: {
        cwd: cwdSchema,
        formIdOrPath: z.string().describe('Form ID (_id) or path'),
        purpose: purposeSchema.optional().describe('Only rows created for this purpose'),
        filters: z
          .record(z.string(), z.string())
          .optional()
          .describe(
            'Filters on data fields: keys are data.<key>, optionally suffixed with __eq, __ne, __gt, __gte, __lt, __lte, __in, __nin, __exists, or __regex'
          ),
        limit: z.number().optional().describe('1–100, default 25'),
        skip: z
          .number()
          .optional()
          .describe('Rows to skip before the first one returned, for paging'),
        sort: z
          .string()
          .optional()
          .describe('A data field, created, or modified; prefix "-" for descending'),
      },
      outputSchema: {
        submissions: z.array(z.object(agentRecordShape)),
        returned: z.number(),
        dropped: z.number(),
      },
      annotations: reads('List agent-created submissions'),
    },
    async ({ cwd, formIdOrPath, purpose, filters, limit, skip, sort }) => {
      try {
        const cfg = resolveProjectConfig(cwd, config);
        const formId = await resolveFormId(formIdOrPath, cfg);
        const ctx = scopeContext(cfg, formId);
        const query = buildListQuery({
          session: ctx.session,
          purpose: purpose as SubmissionPurpose | undefined,
          filters,
          limit,
          skip,
          sort,
        });
        if (!query.ok) {
          return toMcpError(new Error(query.reason));
        }
        const rows = await formioFetch(`form/${formId}/submission`, query.params, cfg);
        const candidates: unknown[] = Array.isArray(rows) ? rows : [];
        const submissions = candidates
          .map((row) => verifyRecord(row, ctx))
          .filter((row): row is AgentRecord => row !== null);
        return toMcpStructuredResult({
          submissions,
          returned: submissions.length,
          dropped: candidates.length - submissions.length,
        });
      } catch (error) {
        return toMcpError(error);
      }
    }
  );
}
