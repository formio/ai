import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ResolvedFormioConfig } from '../config.js';
import { formioFetch } from '../formio-client.js';
import { requestRevisionsConsent, RevisionsConsentChoice } from './browser-prompts.js';
import { stripRevisions } from './helpers.js';

// Session-scoped set of formIds the user already approved "without history" for.
// Module-level so per-form approval persists across calls
const approvedWithoutHistory = new Set<string>();

// Per-form revisions-tracking mode gate. Distinct from the deployment-level
// license gate in license.ts: this prompt asks "for THIS specific form, how
// should revisions be tracked" (original / current / off), not "is the
// deployment licensed at all."
//
// The prompt fires ONLY when ALL of the following hold:
//   1. Deployment IS licensed for revisions (`licensed` is true).
//   2. The targeted form has revisions disabled (`stored.revisions` is falsy).
//   3. The caller did not opt in by passing `revisions: 'original' | 'current'`
//      on the body.
//   4. The user has not already approved "proceed without history" for this
//      form in the current session.
//
// If any of those fail, the gate is a no-op and returns the body unchanged.

async function promptRevisionsMode(
  server: McpServer,
  stored: Record<string, unknown>,
  formId: string
): Promise<RevisionsConsentChoice> {
  const supportsElicitation = Boolean(server.server.getClientCapabilities()?.elicitation);
  if (supportsElicitation) {
    const result = await server.server.elicitInput({
      message: `Form "${stored.name ?? formId}" has revisions disabled. It is recommended to enable revisions. They track every update so you can audit changes, roll back, or pin submissions to a prior form version. How would you like to proceed?`,
      requestedSchema: {
        type: 'object',
        properties: {
          choice: {
            type: 'string',
            title: 'Revision mode for this update',
            enum: ['enable-original', 'enable-current', 'proceed-without-history'],
            enumNames: [
              'Enable revisions (original) and update',
              'Enable revisions (current) and update',
              'Proceed without history (not tracked)',
            ],
            description:
              'original = submissions render against the form version active when they were submitted; current = submissions always render against the latest form version; proceed-without-history = no audit trail.',
          },
        },
        required: ['choice'],
      },
    });
    if (result.action !== 'accept' || !result.content?.choice) return 'cancel';
    const c = result.content.choice;
    if (c === 'enable-original' || c === 'enable-current' || c === 'proceed-without-history') {
      return c;
    }
    return 'cancel';
  }
  // TEMPORARY: browser-consent fallback for MCP clients that do not yet support elicitation.
  // Remove once elicitation is universally supported by the clients we care about.
  const formName = typeof stored.name === 'string' ? stored.name : formId;
  return requestRevisionsConsent(formName, formId);
}

export interface RevisionsTrackingGateOptions {
  formId: string;
  form: Record<string, unknown>;
  /** Whether the deployment is licensed for revisions. When false, skip the per-form prompt. */
  licensed: boolean;
  cfg: ResolvedFormioConfig;
}

// Returns the stored form when a per-form revisions prompt is required;
// returns null when the gate should be bypassed.
//
// Bypass rule: only treat the caller as having supplied `revisions` when they
// opted IN to tracking (`original` / `current`). Passing `revisions: ''`
// mirrors the disabled stored state and must NOT bypass the prompt — that
// loophole lets an LLM silently skip the audit-trail decision on every form
// by always echoing the disabled value.
async function shouldPromptForRevisions(
  opts: RevisionsTrackingGateOptions
): Promise<Record<string, unknown> | null> {
  const { formId, form, licensed, cfg } = opts;
  const callerOptedIn = form.revisions === 'original' || form.revisions === 'current';
  // Skip when the deployment doesn't have revisions enabled on the license — the user's "continue without
  // revision tracking" choice is captured at the license-gate layer, so
  // re-prompting per-form is redundant.
  if (callerOptedIn || !licensed) return null;
  const stored = (await formioFetch(`form/${formId}`, {}, cfg)) as Record<string, unknown>;
  if (stored.revisions || approvedWithoutHistory.has(formId)) return null;
  return stored;
}

// Returns the PUT body for the standard form_update path with the user's
// per-form revisions-mode choice applied. Throws on cancel so the calling
// tool's outer try/catch surfaces it via toMcpError.
export async function gateRevisionsTracking(
  server: McpServer,
  opts: RevisionsTrackingGateOptions
): Promise<Record<string, unknown>> {
  const { formId, form } = opts;
  let putBody: Record<string, unknown> = { ...form };

  const stored = await shouldPromptForRevisions(opts);
  if (!stored) return putBody;

  const choice = await promptRevisionsMode(server, stored, formId);
  if (choice === 'cancel') {
    throw new Error(`User declined to update form "${formId}". No changes were made.`);
  }
  if (choice === 'enable-original' || choice === 'enable-current') {
    putBody = {
      ...putBody,
      revisions: choice === 'enable-original' ? 'original' : 'current',
    };
    return putBody;
  }

  // proceed-without-history: drop any caller-supplied `revisions: ''` so the
  // PUT body matches "no revisions change". Remember for the rest of the
  // session so the user is asked only once per form.
  approvedWithoutHistory.add(formId);
  return stripRevisions(putBody);
}
