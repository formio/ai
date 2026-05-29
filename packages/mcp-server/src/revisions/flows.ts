import { ResolvedFormioConfig } from '../config.js';
import { formioFetch } from '../formio-client.js';
import { prefixVnote } from './helpers.js';

export const DRAFT_FIELDS = [
  'components',
  'settings',
  'tags',
  'properties',
  'controller',
  'esign',
  'display',
] as const;

export const REVERT_FIELDS = ['components', 'tags', 'properties', 'display'] as const;

export interface DraftFlowOptions {
  formId: string;
  form: Record<string, unknown>;
  _vnote: string;
  cfg: ResolvedFormioConfig;
}

export interface RevertOptions {
  formId: string;
  version: string;
  _vnote: string;
  cfg: ResolvedFormioConfig;
}

function pickFields(
  source: Record<string, unknown>,
  fields: readonly string[]
): Record<string, unknown> {
  return Object.fromEntries(Object.entries(source).filter(([k]) => fields.includes(k)));
}

// Draft body must be a subset of DRAFT_FIELDS — anything outside that set is
// Reject up front so the LLM picks the right tool
// path (standard form_update for identity/policy edits) instead of staging
// changes that will vanish.
function rejectNonDraftFields(form: Record<string, unknown>): void {
  const allowed = new Set<string>(DRAFT_FIELDS);
  const offending = Object.keys(form).filter((k) => !allowed.has(k));
  if (offending.length === 0) return;
  throw new Error(
    `Draft body contains fields that cannot be staged: ${offending.join(', ')}. ` +
      `Drafts only stage these fields: ${DRAFT_FIELDS.join(', ')}. ` +
      `For identity (title, name, path), policy (access, submissionAccess, revisions), ` +
      `or other fields, call form_update WITHOUT draft: true to apply them immediately. ` +
      `Do NOT retry this call with draft: true.`
  );
}

export async function saveDraft({ formId, form, _vnote, cfg }: DraftFlowOptions) {
  rejectNonDraftFields(form);
  // if no draft exists, the endpoint returns the live form
  const base = (await formioFetch(`form/${formId}/draft`, {}, cfg)) as Record<string, unknown>;
  await formioFetch(`form/${formId}/draft`, {}, cfg, {
    method: 'PUT',
    body: { ...base, ...form, _vnote: prefixVnote(_vnote) },
  });
  // fresh GET since PUT returns stale body
  return await formioFetch(`form/${formId}/draft`, {}, cfg);
}

export async function publishDraft({ formId, _vnote, cfg }: Omit<DraftFlowOptions, 'form'>) {
  // GET /draft falls back to the live form when no draft exists, so distinguish
  // by _vid: only the draft revision has _vid === 'draft'.
  const draft = (await formioFetch(`form/${formId}/draft`, {}, cfg)) as Record<string, unknown>;
  if (draft._vid !== 'draft') {
    throw new Error(
      `No draft exists for form "${formId}". Create one via form_update with draft: true.`
    );
  }
  const live = (await formioFetch(`form/${formId}`, {}, cfg)) as Record<string, unknown>;
  await formioFetch(`form/${formId}`, {}, cfg, {
    method: 'PUT',
    body: { ...live, ...pickFields(draft, DRAFT_FIELDS), _vnote: prefixVnote(_vnote) },
  });
  return await formioFetch(`form/${formId}`, {}, cfg);
}

export async function revertToRevision({ formId, version, _vnote, cfg }: RevertOptions) {
  const revision = (await formioFetch(`form/${formId}/v/${version}`, {}, cfg)) as Record<
    string,
    unknown
  >;
  const live = (await formioFetch(`form/${formId}`, {}, cfg)) as Record<string, unknown>;
  await formioFetch(`form/${formId}`, {}, cfg, {
    method: 'PUT',
    body: {
      ...live,
      ...pickFields(revision, REVERT_FIELDS),
      _vnote: prefixVnote(_vnote),
    },
  });
  return await formioFetch(`form/${formId}`, {}, cfg);
}
