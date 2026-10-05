import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { FormioConfig } from '../config.js';
import { formioFetch, FormioApiError } from '../formio-client.js';
import { toMcpStructuredResult, toMcpError } from '../mcp-responses.js';
import { creates } from '../tool-annotations.js';
import { cwdSchema, resolveProjectConfig } from '../project-resolver.js';
import { signTag, verifyRecord, type SubmissionPurpose } from '../agent-scope.js';
import {
  SCOPE_SENTENCE,
  RULES_SENTENCE,
  agentRecordShape,
  purposeSchema,
  metadataRefusalSchema,
  metadataRefusedResult,
  scopeContext,
  resolveFormId,
  actionTitlesFor,
  differingKeys,
  dryRunRejectedResult,
  unverifiableAfterWriteResult,
} from './submission-scope.js';

interface DryRun {
  data?: unknown;
  owner?: unknown;
}

export function registerSubmissionCreateTool(server: McpServer, config: FormioConfig) {
  server.registerTool(
    'submission_create',
    {
      description: `Create one submission on a form, for seeding a Resource a select reads (purpose "reference-data") or for testing a form (purpose "test"). The server signs it so the other submission_* tools can reach it later. ${SCOPE_SENTENCE} Creating a submission runs the form's create actions (email, webhook, login, role assignment); the result names the ones that ran. ${RULES_SENTENCE}`,
      inputSchema: {
        cwd: cwdSchema,
        formIdOrPath: z.string().describe('Form ID (_id) or path'),
        data: z
          .record(z.string(), z.unknown())
          .describe('The submission data, keyed by component key; invented values only'),
        purpose: purposeSchema.describe(
          '"reference-data" for rows a select reads, "test" for rows written to check a form'
        ),
        metadata: metadataRefusalSchema,
      },
      outputSchema: { ...agentRecordShape, triggeredActions: z.array(z.string()) },
      annotations: creates('Create an agent submission'),
    },
    async ({ cwd, formIdOrPath, data, purpose, metadata }) => {
      if (metadata !== undefined) {
        return metadataRefusedResult();
      }
      try {
        const cfg = resolveProjectConfig(cwd, config);
        const formId = await resolveFormId(formIdOrPath, cfg);
        const ctx = scopeContext(cfg, formId);
        const triggeredActions = await actionTitlesFor(formId, 'create', cfg);
        const path = `form/${formId}/submission`;

        // The dry run validates and normalizes without running actions or saving, so the
        // signature can cover the data exactly as the server will store it.
        const dryRun = (await formioFetch(path, { dryrun: '1' }, cfg, {
          method: 'POST',
          body: { data },
        })) as DryRun;
        const owner = typeof dryRun.owner === 'string' ? dryRun.owner : null;
        const tag = signTag({
          key: ctx.key,
          projectUrl: ctx.projectUrl,
          formId,
          owner,
          purpose: purpose as SubmissionPurpose,
          data: dryRun.data,
        });

        const stored = (await formioFetch(path, {}, cfg, {
          method: 'POST',
          body: { data: dryRun.data, metadata: { agent: tag } },
        })) as Record<string, unknown>;
        const verified = verifyRecord(stored, ctx);
        if (!verified) {
          return unverifiableAfterWriteResult(
            String(stored._id),
            differingKeys(dryRun.data, stored.data)
          );
        }
        return toMcpStructuredResult({ ...verified, triggeredActions });
      } catch (error) {
        if (error instanceof FormioApiError && error.status === 400) {
          return dryRunRejectedResult(error);
        }
        return toMcpError(error);
      }
    }
  );
}
