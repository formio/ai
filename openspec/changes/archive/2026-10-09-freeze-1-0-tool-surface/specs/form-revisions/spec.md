## ADDED Requirements

### Requirement: form_revision_list returns a form's revisions newest first

The server SHALL register `form_revision_list` (replacing `form_revisions_list`), taking `cwd`, `formIdOrPath`, and the shared list arguments. It SHALL request revisions sorted by `-_vid` by default and select compact metadata (`_id`, `_vid`, `_vnote`, `_vuser`, `created`, `modified`) unless `select` is given, and SHALL return the shared list result.

#### Scenario: Newest first

- **WHEN** a form has 15 revisions and `form_revision_list` is called
- **THEN** the first item is the highest `_vid`, all 15 are returned, and `total` is 15

## REMOVED Requirements

### Requirement: form_revisions_list returns revision summaries

**Reason**: Renamed to `form_revision_list` for singular tool names, and it now pages and sorts.
**Migration**: Call `form_revision_list` with the same `formIdOrPath`.

### Requirement: License gate prompts once for standard writes on unlicensed deployments

**Reason**: The prompt ran out of band and its answer was persisted per deployment.
**Migration**: Pass `acceptNoHistory: true` after asking the user, as the `revisions-history-acceptance` capability describes.

### Requirement: Per-form tracking gate prompts when revisions are off

**Reason**: The prompt ran out of band (elicitation or a local browser page) in the middle of a write.
**Migration**: Pass `acceptNoHistory: true`, or set `form.revisions` to enable history.
