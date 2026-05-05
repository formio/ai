// Fields the Form.io portal overlays from a draft onto the current published
// form when saving a draft or publishing a revision. Mirrors the behavior in
// nirvana/apps/formio-app/src/scripts/controllers/form.js (draft-load + publish
// flows). Fields outside this set — `access`, `submissionAccess`, `revisions`,
// `owner`, `_id`, `project`, etc. — are preserved from the current published
// form and never overridden by the draft body.
export const DRAFT_OVERLAY_FIELDS = [
  'components',
  'settings',
  'tags',
  'properties',
  'display',
] as const;

export function mergeDraftOntoCurrent(
  current: Record<string, unknown>,
  draft: Record<string, unknown>
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...current };
  for (const field of DRAFT_OVERLAY_FIELDS) {
    if (field in draft) {
      merged[field] = draft[field];
    }
  }
  return merged;
}
