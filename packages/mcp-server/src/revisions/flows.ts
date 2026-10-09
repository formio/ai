import { ResolvedFormioConfig } from '../config.js';
import { formioFetch } from '../formio-client.js';
import { ToolError } from '../tool-errors.js';
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

/** The form has no draft: GET /draft answered with the live form. */
export function noDraft(form: string): ToolError {
  return new ToolError({
    code: 'NO_DRAFT',
    message: `No draft exists for form "${form}". Save one with form_update and draft: true.`,
  });
}

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

// A draft holds only DRAFT_FIELDS. The body is usually what form_get returned, so
// the server-owned fields it carries (_id, title, path, created, …) are dropped
// rather than refused. A body with none of the draft fields would stage nothing
// but the note, so that is refused before any request.
function draftFields(form: Record<string, unknown>): Record<string, unknown> {
  const picked = pickFields(form, DRAFT_FIELDS);
  if (Object.keys(picked).length === 0) {
    throw new ToolError({
      code: 'INVALID_ARGUMENT',
      message:
        `The draft body carries none of the fields a draft saves (${DRAFT_FIELDS.join(', ')}), so nothing was saved. ` +
        `To change other fields (title, name, path, access, revisions, …), call form_update without draft: true.`,
    });
  }
  return picked;
}

export async function saveDraft({ formId, form, _vnote, cfg }: DraftFlowOptions) {
  const fields = draftFields(form);
  // if no draft exists, the endpoint returns the live form
  const base = (await formioFetch(`form/${formId}/draft`, {}, cfg)) as Record<string, unknown>;
  await formioFetch(`form/${formId}/draft`, {}, cfg, {
    method: 'PUT',
    body: { ...base, ...fields, _vnote: prefixVnote(_vnote) },
  });
  // fresh GET since PUT returns stale body
  return await formioFetch(`form/${formId}/draft`, {}, cfg);
}

export async function publishDraft({ formId, _vnote, cfg }: Omit<DraftFlowOptions, 'form'>) {
  // GET /draft falls back to the live form when no draft exists, so distinguish
  // by _vid: only the draft revision has _vid === 'draft'.
  const draft = (await formioFetch(`form/${formId}/draft`, {}, cfg)) as Record<string, unknown>;
  if (draft._vid !== 'draft') {
    throw noDraft(formId);
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
