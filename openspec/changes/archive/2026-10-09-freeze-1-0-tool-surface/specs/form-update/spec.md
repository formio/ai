## ADDED Requirements

### Requirement: form_update saves a form or its draft from the body it is given

`form_update` SHALL take `cwd`, `formId` (a 24-character ObjectId), `form`, a required `note`, an optional `draft: boolean`, and an optional `acceptNoHistory: boolean`. Without `draft` it SHALL PUT the form. With `draft: true` it SHALL save the draft from the allowlisted draft fields of `form` (`components`, `settings`, `tags`, `properties`, `controller`, `esign`, `display`). It SHALL ignore the server-owned fields `form_get` returns (`_id`, `_vid`, `_rid`, `revisionId`, `created`, `modified`, `owner`, `project`, `machineName`, and the like), and SHALL ignore a caller-editable non-draft field (`title`, `name`, `path`, `type`, `action`, `access`, `submissionAccess`, `fieldMatchAccess`, `revisions`, `submissionRevisions`, `pdfComponents`, `translationsUrl`) whose value equals the stored one — the stored draft's, or the live form's where a draft exists. A caller-editable non-draft field whose value differs from both SHALL be refused with code `INVALID_ARGUMENT`, naming the field and saying to save it with `form_update` without `draft`, and nothing SHALL be written. It SHALL NOT accept `publish`, `revert` or `version`; publishing and reverting are `form_publish` and `form_revert`.

#### Scenario: Saving a draft from form_get's output

- **WHEN** `form_update` is called with `draft: true` and a `form` returned by `form_get` (carrying `_id`, `title`, `path`, `created`)
- **THEN** the draft is saved with that form's allowlisted fields
- **AND** no error is returned for the other fields

#### Scenario: A changed non-draft field in a draft body is refused

- **WHEN** `form_update` is called with `draft: true` and a `form` whose `title` or `path` differs from the stored form's
- **THEN** the tool returns `isError: true` with `_meta["io.form/error"].code` `INVALID_ARGUMENT`, naming the field and `form_update` without `draft`
- **AND** nothing is written

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
