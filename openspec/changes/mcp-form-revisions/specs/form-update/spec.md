## ADDED Requirements

### Requirement: form_update requires a note

`form_update` SHALL require a `note` string parameter describing the diff between the live form and the updated body. The tool SHALL persist it as `_vnote` on the PUT body, prefixed with `@formio/mcp:`, on every write path (standard update, draft, publish, revert). When the stored form has `revisions` enabled, the server creates a new revision on standard updates as well as on publishes — the note is what surfaces in the revision history for either path. For `revert: true`, when `note` is omitted the tool SHALL default it to `Reverted to version {version}`.

#### Scenario: Note prefixed on standard update

- **WHEN** `form_update` is called with `note: "rename email field"`
- **THEN** the PUT body's `_vnote` equals `@formio/mcp: rename email field`

### Requirement: form_update exposes draft, publish, revert flags

`form_update` SHALL accept `draft`, `publish`, `revert` (booleans) and `version` (string for `revert`). The flags SHALL be mutually exclusive. Behavior of each flag is governed by the `form-revisions` capability.

#### Scenario: Mutually exclusive

- **WHEN** `form_update` is called with `draft: true` and `revert: true`
- **THEN** the tool throws

### Requirement: form_update applies the per-form tracking gate on standard PUTs

A standard `form_update` (none of `draft`/`publish`/`revert`) SHALL run the per-form revisions tracking gate before issuing the PUT. Gate behavior is specified in the `form-revisions` capability.

#### Scenario: Tracking gate runs

- **WHEN** `form_update` is called against a licensed deployment for a form with revisions disabled, no caller opt-in
- **THEN** the tracking gate is invoked before any PUT
