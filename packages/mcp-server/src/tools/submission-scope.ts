import { z } from 'zod';
import { ResolvedFormioConfig } from '../config.js';
import { formioFetch, isMongoId, FormioApiError } from '../formio-client.js';
import { getOrCreateKey, sessionLabel } from '../submission-keys.js';
import {
  SUBMISSION_PURPOSES,
  canonicalize,
  verifyRecord,
  type AgentRecord,
  type AgentTag,
  type VerifyContext,
} from '../agent-scope.js';

/**
 * What every `submission_*` tool shares: the scope sentence its description carries, the
 * per-directory signing context, form-id resolution, and the one not-found result a
 * missing record and a record the agent does not own both produce.
 */

export const GUIDELINE_PATH = 'plugin/skills/formio-mcp-setup/references/agent-submissions.md';

export const SCOPE_SENTENCE =
  "Reaches only submissions this server created and signed for the user's current working directory; any other submission is reported as not found, with none of its content.";

export const RULES_SENTENCE = `Follow ${GUIDELINE_PATH}: invented values only, and call action_list and get the user's approval before any write.`;

export const purposeSchema = z.enum(SUBMISSION_PURPOSES as [string, ...string[]]);

export const submissionIdSchema = z.string().describe('The submission _id');

export const agentRecordShape = {
  _id: z.string(),
  form: z.string(),
  created: z.unknown(),
  modified: z.unknown(),
  data: z.unknown(),
  purpose: purposeSchema,
};

export interface ScopeContext extends VerifyContext {
  session: string;
}

/** The directory's key and label, plus the form the call targets. */
export function scopeContext(cfg: ResolvedFormioConfig, formId: string): ScopeContext {
  const key = getOrCreateKey({ cwd: cfg.cwd ?? process.cwd() });
  return { key, session: sessionLabel(key), projectUrl: cfg.projectUrl, formId };
}

/** A form id as given, or the id a form path resolves to. */
export async function resolveFormId(
  formIdOrPath: string,
  cfg: ResolvedFormioConfig
): Promise<string> {
  if (isMongoId(formIdOrPath)) {
    return formIdOrPath;
  }
  const form = (await formioFetch(formIdOrPath, { select: '_id' }, cfg)) as { _id?: unknown };
  if (typeof form._id !== 'string') {
    throw new Error(`Form "${formIdOrPath}" did not resolve to a form id.`);
  }
  return form._id;
}

export function notFoundResult(submissionId: string) {
  return {
    content: [
      {
        type: 'text' as const,
        text: `No submission ${submissionId} created by this server for this working directory was found on this form.`,
      },
    ],
    isError: true,
  };
}

export function isNotFound(error: unknown): boolean {
  return error instanceof FormioApiError && error.status === 404;
}

export function invalidSubmissionIdResult(submissionId: string) {
  return {
    content: [{ type: 'text' as const, text: `"${submissionId}" is not a submission id.` }],
    isError: true,
  };
}

// ── Writes ───────────────────────────────────────────────────────────────────────────

export const metadataRefusalSchema = z
  .unknown()
  .optional()
  .describe(
    'Not accepted: the server writes the submission metadata itself, and a call that passes it is refused'
  );

export function metadataRefusedResult() {
  return {
    content: [
      {
        type: 'text' as const,
        text: 'metadata is written by the server and cannot be supplied; pass only data.',
      },
    ],
    isError: true,
  };
}

/** Titles of the form's actions that run for `method`: the effects a write triggers. */
export async function actionTitlesFor(
  formId: string,
  method: 'create' | 'update' | 'delete',
  cfg: ResolvedFormioConfig
): Promise<string[]> {
  const actions = await formioFetch(`form/${formId}/action`, {}, cfg);
  return (Array.isArray(actions) ? actions : [])
    .filter(
      (action): action is { title?: unknown; name?: unknown; method?: unknown } =>
        typeof action === 'object' && action !== null
    )
    .filter((action) => Array.isArray(action.method) && action.method.includes(method))
    .map((action) => String(action.title ?? action.name));
}

/** Top-level data keys whose values differ. Names only — the values are never reported. */
export function differingKeys(expected: unknown, actual: unknown): string[] {
  const a = (typeof expected === 'object' && expected !== null ? expected : {}) as Record<
    string,
    unknown
  >;
  const b = (typeof actual === 'object' && actual !== null ? actual : {}) as Record<
    string,
    unknown
  >;
  return [...new Set([...Object.keys(a), ...Object.keys(b)])]
    .filter((key) => canonicalize(a[key]) !== canonicalize(b[key]))
    .sort();
}

const MAX_DETAIL = 2000;

/** A dry-run rejection, with Form.io's validation messages when it sent them. */
export function dryRunRejectedResult(error: FormioApiError) {
  const details = (() => {
    try {
      const parsed = JSON.parse(error.body ?? '') as { details?: { message?: unknown }[] };
      const messages = (parsed.details ?? [])
        .map((d) => d.message)
        .filter((m) => typeof m === 'string');
      return messages.length > 0 ? messages.join('\n') : undefined;
    } catch {
      return undefined;
    }
  })();
  const text = details ?? error.body?.slice(0, MAX_DETAIL) ?? error.message;
  return {
    content: [
      {
        type: 'text' as const,
        text: `Form.io rejected the submission; nothing was written.\n${text}`,
      },
    ],
    isError: true,
  };
}

export function unverifiableAfterWriteResult(submissionId: string, fields: string[]) {
  return {
    content: [
      {
        type: 'text' as const,
        text:
          `Submission ${submissionId} was written, but the stored data differs from what the server signed ` +
          `(fields: ${fields.join(', ') || 'unknown'}) — a value the form computes differently on each save. ` +
          'The submission tools cannot reach it; remove it in the Form.io portal.',
      },
    ],
    isError: true,
  };
}

export interface VerifiedFetch {
  raw: Record<string, unknown>;
  tag: AgentTag;
  record: AgentRecord;
}

/**
 * The record at `submissionId` when this directory signed it, and `null` for anything
 * else — a 404 and a record the agent did not create are the same answer.
 */
export async function fetchVerified(
  submissionId: string,
  ctx: ScopeContext,
  cfg: ResolvedFormioConfig
): Promise<VerifiedFetch | null> {
  let raw: unknown;
  try {
    raw = await formioFetch(`form/${ctx.formId}/submission/${submissionId}`, {}, cfg);
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
  const record = verifyRecord(raw, ctx);
  if (!record) return null;
  const metadata = (raw as { metadata: { agent: AgentTag } }).metadata;
  return { raw: raw as Record<string, unknown>, tag: metadata.agent, record };
}
