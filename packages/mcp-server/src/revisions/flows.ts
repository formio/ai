import { isDeepStrictEqual } from 'node:util';
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
// the other fields it carries are dropped here — a changed caller-editable one is
// refused once the stored form is read (refuseNonDraftChanges). A body with none of the draft fields would stage nothing
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

/**
 * The fields a caller sets on a form that a draft does not save — they change only
 * through a live update. Every other non-draft field form_get returns is the
 * server's own (_id, _vid, _rid, revisionId, created, modified, owner, project,
 * machineName, deleted, _vnote, _vuser, externalOwner, …) and is ignored in a draft body.
 */
export const EDITABLE_NON_DRAFT_FIELDS = [
  'title',
  'name',
  'path',
  'type',
  'action',
  'access',
  'submissionAccess',
  'fieldMatchAccess',
  'revisions',
  'submissionRevisions',
  'pdfComponents',
  'translationsUrl',
] as const;

function changedFrom(
  form: Record<string, unknown>,
  stored: Record<string, unknown>,
  fields: readonly string[]
): string[] {
  return fields.filter((field) => field in form && !isDeepStrictEqual(form[field], stored[field]));
}

interface NonDraftChangeCheck {
  formId: string;
  form: Record<string, unknown>;
  /** What GET /draft answered: the draft, or the live form when there is none. */
  base: Record<string, unknown>;
  cfg: ResolvedFormioConfig;
}

// A draft saves only DRAFT_FIELDS, so a caller-editable field the body changes would
// be dropped without a word. Unchanged values — what form_get returned — pass. The
// draft keeps the values it was saved with, so a field it disagrees on is compared
// with the live form too, which is what form_get returns after a rename.
async function refuseNonDraftChanges({ formId, form, base, cfg }: NonDraftChangeCheck) {
  const againstBase = changedFrom(form, base, EDITABLE_NON_DRAFT_FIELDS);
  if (againstBase.length === 0) {
    return;
  }
  const changed =
    base._vid === 'draft'
      ? changedFrom(
          form,
          (await formioFetch(`form/${formId}`, {}, cfg)) as Record<string, unknown>,
          againstBase
        )
      : againstBase;
  if (changed.length === 0) {
    return;
  }
  throw new ToolError({
    code: 'INVALID_ARGUMENT',
    message:
      `The draft body changes ${changed.join(', ')}, which a draft does not save, so nothing was saved. ` +
      `Save ${changed.length === 1 ? 'that field' : 'those fields'} with form_update without draft, which updates the live form, ` +
      `or send the stored ${changed.length === 1 ? 'value' : 'values'} in the draft body.`,
  });
}

export async function saveDraft({ formId, form, _vnote, cfg }: DraftFlowOptions) {
  const fields = draftFields(form);
  // if no draft exists, the endpoint returns the live form
  const base = (await formioFetch(`form/${formId}/draft`, {}, cfg)) as Record<string, unknown>;
  await refuseNonDraftChanges({ formId, form, base, cfg });
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

// Form.io resolves "latest" by sorting on -_vid, where the draft's "draft" sorts above
// every number, and resolves a 24-character version as a revision id, the draft's
// included. Restoring what came back would publish the draft by another name.
function refuseDraftRevision(revision: Record<string, unknown>, version: string): void {
  if (revision._vid === 'draft') {
    throw new ToolError({
      code: 'INVALID_ARGUMENT',
      message: `version ${JSON.stringify(version)} resolved to the form's draft, not a published revision, so nothing was changed. To make the draft live, call form_publish; to restore a published revision, pass its numeric _vid from form_revision_list.`,
    });
  }
}

export async function revertToRevision({ formId, version, _vnote, cfg }: RevertOptions) {
  const revision = (await formioFetch(`form/${formId}/v/${version}`, {}, cfg)) as Record<
    string,
    unknown
  >;
  refuseDraftRevision(revision, version);
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
