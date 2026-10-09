import { ResolvedFormioConfig } from '../config.js';
import { formioFetch } from '../formio-client.js';
import { ToolError } from '../tool-errors.js';

/**
 * A save that would keep no revision history goes ahead only when the caller passes
 * `acceptNoHistory: true`. Nothing here asks the user: the refusal is written for the
 * agent to relay, and the agent retries with the user's answer. No answer outlives
 * the call it was given to.
 */
export function historyNotAccepted({
  reason,
  remedy,
}: {
  reason: string;
  remedy: string;
}): ToolError {
  return new ToolError({
    code: 'HISTORY_NOT_ACCEPTED',
    message: `Nothing was saved: this save would keep no revision history, because ${reason}. Ask the user how to proceed, then ${remedy}`,
  });
}

/**
 * A body that sets `revisions` to an empty value turns history off. On a licensed
 * deployment that is the caller choosing to save without history, so it needs the
 * same acceptance as any other save without it, whatever the stored form says.
 */
export function gateDisabledHistory({
  form,
  acceptNoHistory,
}: {
  form: Record<string, unknown>;
  acceptNoHistory?: boolean;
}): void {
  if (!('revisions' in form) || form.revisions || acceptNoHistory) {
    return;
  }
  throw historyNotAccepted({
    reason: `the body sets revisions to ${JSON.stringify(form.revisions)}, which turns revision history off`,
    remedy:
      'if they agree to save without history, retry with acceptNoHistory: true; otherwise omit revisions, or set it to "original" (each submission keeps the form version it was made against) or "current" (submissions always use the latest version).',
  });
}

export interface FormHistoryGateOptions {
  cfg: ResolvedFormioConfig;
  formId: string;
  form: Record<string, unknown>;
  acceptNoHistory?: boolean;
}

/**
 * On a licensed deployment, an update to a form whose stored `revisions` is off
 * keeps no history unless the caller turns it on (`"original"` or `"current"`).
 * Echoing the stored `""` back is not a decision, so it does not pass. Reads the
 * stored form only when the answer depends on it.
 */
export async function gateFormHistory({
  cfg,
  formId,
  form,
  acceptNoHistory,
}: FormHistoryGateOptions): Promise<void> {
  const enablesHistory = form.revisions === 'original' || form.revisions === 'current';
  if (enablesHistory || acceptNoHistory) {
    return;
  }
  // Only the fields read below: the whole definition is not needed to answer this.
  const stored = (await formioFetch(`form/${formId}`, { select: 'revisions,name' }, cfg)) as Record<
    string,
    unknown
  >;
  if (stored.revisions) {
    return;
  }
  const name = typeof stored.name === 'string' ? stored.name : formId;
  throw historyNotAccepted({
    reason: `form "${name}" has revisions turned off`,
    remedy:
      'retry with form.revisions set to "original" (each submission keeps the form version it was made against) or "current" (submissions always use the latest version) to turn history on, or with acceptNoHistory: true to save without it.',
  });
}
