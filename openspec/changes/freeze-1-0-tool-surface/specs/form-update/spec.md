## ADDED Requirements

### Requirement: form_update saves a form or its draft from the body it is given

`form_update` SHALL take `cwd`, `formId` (a 24-character ObjectId), `form`, a required `note`, an optional `draft: boolean`, and an optional `acceptNoHistory: boolean`. Without `draft` it SHALL PUT the form. With `draft: true` it SHALL save the draft from the allowlisted draft fields of `form` (`components`, `settings`, `tags`, `properties`, `controller`, `esign`, `display`) and SHALL ignore every other field — including the server-owned fields `form_get` returns — rather than refusing them. It SHALL NOT accept `publish`, `revert` or `version`; publishing and reverting are `form_publish` and `form_revert`.

#### Scenario: Saving a draft from form_get's output

- **WHEN** `form_update` is called with `draft: true` and a `form` returned by `form_get` (carrying `_id`, `title`, `path`, `created`)
- **THEN** the draft is saved with that form's allowlisted fields
- **AND** no error is returned for the other fields

#### Scenario: Publish and revert are separate tools

- **WHEN** `form_update` is listed
- **THEN** its input schema has no `publish`, `revert` or `version` argument

## REMOVED Requirements

### Requirement: form_update exposes draft, publish, revert flags

**Reason**: Publish and revert take no form body and their own arguments, so folding them behind flags forced a required `form` they ignore.
**Migration**: Keep `draft: true` on `form_update`; call `form_publish` (`formId`, `note`) to publish and `form_revert` (`formId`, `version`, `note`) to revert.

### Requirement: form_update applies the per-form tracking gate on standard PUTs

**Reason**: The gate prompted the user out of band (elicitation or a local browser page) in the middle of a tool call.
**Migration**: Pass `acceptNoHistory: true`, or set `form.revisions` to enable history, as the `revisions-history-acceptance` capability describes.
