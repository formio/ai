import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { FormioConfig } from '../config.js';
import { formioFetch, isMongoId, FormioApiError } from '../formio-client.js';
import { toMcpStructuredResult, toMcpError } from '../mcp-responses.js';
import { overwrites } from '../tool-annotations.js';
import { cwdSchema, resolveProjectConfig } from '../project-resolver.js';
import { signTag, verifyRecord } from '../agent-scope.js';
import {
  SCOPE_SENTENCE,
  RULES_SENTENCE,
  agentRecordShape,
  submissionIdSchema,
  metadataRefusalSchema,
  metadataRefusedResult,
  scopeContext,
  resolveFormId,
  fetchVerified,
  notFoundResult,
  invalidSubmissionIdResult,
  actionTitlesFor,
  differingKeys,
  dryRunRejectedResult,
  unverifiableAfterWriteResult,
} from './submission-scope.js';

interface DryRun {
  data?: unknown;
  owner?: unknown;
}

export function registerSubmissionUpdateTool(server: McpServer, config: FormioConfig) {
  server.registerTool(
    'submission_update',
    {
      description: `Replace the data of one submission the agent created; its purpose is kept. ${SCOPE_SENTENCE} Updating runs the form's update actions; the result names the ones that ran. ${RULES_SENTENCE}`,
      inputSchema: {
        cwd: cwdSchema,
        formIdOrPath: z.string().describe('Form ID (_id) or path'),
        submissionId: submissionIdSchema,
        data: z
          .record(z.string(), z.unknown())
          .describe('The complete new submission data; invented values only'),
        metadata: metadataRefusalSchema,
      },
      outputSchema: { ...agentRecordShape, triggeredActions: z.array(z.string()) },
      annotations: overwrites('Update an agent submission'),
    },
    async ({ cwd, formIdOrPath, submissionId, data, metadata }) => {
      if (metadata !== undefined) return metadataRefusedResult();
      if (!isMongoId(submissionId)) return invalidSubmissionIdResult(submissionId);
      try {
        const cfg = resolveProjectConfig(cwd, config);
        const formId = await resolveFormId(formIdOrPath, cfg);
        const ctx = scopeContext(cfg, formId);
        const existing = await fetchVerified(submissionId, ctx, cfg);
        if (!existing) return notFoundResult(submissionId);

        const triggeredActions = await actionTitlesFor(formId, 'update', cfg);
        const path = `form/${formId}/submission/${submissionId}`;
        const dryRun = (await formioFetch(path, { dryrun: '1' }, cfg, {
          method: 'PUT',
          body: { data },
        })) as DryRun;
        const tag = signTag({
          key: ctx.key,
          projectUrl: ctx.projectUrl,
          formId,
          owner: typeof dryRun.owner === 'string' ? dryRun.owner : null,
          purpose: existing.tag.purpose,
          nonce: existing.tag.nonce,
          data: dryRun.data,
        });
        // A PUT replaces `metadata` wholesale, so the keys the server wrote beside the tag
        // are carried over with it.
        const existingMetadata = existing.raw.metadata as Record<string, unknown>;
        const stored = (await formioFetch(path, {}, cfg, {
          method: 'PUT',
          body: { data: dryRun.data, metadata: { ...existingMetadata, agent: tag } },
        })) as Record<string, unknown>;
        const verified = verifyRecord(stored, ctx);
        if (!verified) {
          return unverifiableAfterWriteResult(
            submissionId,
            differingKeys(dryRun.data, stored.data)
          );
        }
        return toMcpStructuredResult({ ...verified, triggeredActions });
      } catch (error) {
        if (error instanceof FormioApiError && error.status === 400)
          return dryRunRejectedResult(error);
        return toMcpError(error);
      }
    }
  );
}
