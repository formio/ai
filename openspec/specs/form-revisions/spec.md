## Purpose

Defines form revision behavior: the `form_revisions_list` and `form_revision_get` tools, the license gates on draft, publish, and revert, the per-form tracking gate, when a standard update creates a revision, and the field allowlists each write path uses.
## Requirements
### Requirement: form_revision_get returns a single revision

The `form_revision_get` tool SHALL call `GET /form/{id}/v/{version}` where `version` is either a sequential `_vid` or a 24-char revision document `_id`, and return the response as MCP text content.

#### Scenario: Get revision by vid

- **WHEN** `form_revision_get` is called with `formIdOrPath: "67890abcdef012345678abcd"` and `version: "3"`
- **THEN** it requests `/form/67890abcdef012345678abcd/v/3`
- **AND** returns the revision body as MCP text content

### Requirement: License gate blocks draft/publish/revert on unlicensed deployments

When the deployment's `/config.js` does not advertise `sac = true`, `form_update` with any of `draft`, `publish`, `revert` SHALL throw without prompting and without calling the API. License status SHALL be cached per `baseUrl`.

#### Scenario: Unlicensed deployment rejects draft

- **WHEN** `form_update` is called with `draft: true` against a deployment whose `/config.js` reports `sac = false`
- **THEN** the tool throws an error instructing the caller to drop the flag and call `form_update` as a standard update
- **AND** no PUT request is sent

### Requirement: Standard updates create a new revision when revisions are enabled

When a stored form has `revisions` set to `'original'` or `'current'`, every standard `form_update` (no `draft`/`publish`/`revert`) SHALL create a new revision server-side via the `PUT /form/:id` call — the draft/publish flow is not required for history tracking. The PUT body SHALL include `_vnote` prefixed with `@formio/mcp:` so the new revision carries the caller's note.

#### Scenario: Standard update on a revisioned form records history

- **WHEN** `form_update` is called for a form whose stored `revisions` is `'original'`, with `form: { components: [...] }` and `note: "rename email field"`
- **THEN** a single `PUT /form/{id}` is sent with `_vnote: "@formio/mcp: rename email field"`
- **AND** the server-side revision list (`GET /form/{id}/v`) gains a new entry referencing that note

#### Scenario: Standard update on a revisions-disabled form does not record history

- **WHEN** `form_update` is called for a form whose stored `revisions` is falsy AND the per-form tracking gate's outcome is "proceed without history"
- **THEN** the PUT is sent without `revisions` on the body
- **AND** no new revision is created (the deployment treats the form as untracked)

### Requirement: Draft, publish, and revert use field allowlists

`form_update` with `draft: true` SHALL PUT `/form/{id}/draft` with caller `form` fields restricted to the draft allowlist (`components`, `settings`, `tags`, `properties`, `controller`, `esign`, `display`) and SHALL throw when the body contains any other field.

`form_update` with `publish: true` SHALL fetch the draft (verifying `_vid === 'draft'`), fetch the live form, and PUT `/form/{id}` with the live form overlaid by the draft's allowlisted fields only. The caller's `form` argument SHALL be ignored.

`form_update` with `revert: true` SHALL require `version`, fetch the target revision, fetch the live form, and PUT `/form/{id}` with the live form overlaid by the revision's revert allowlist (`components`, `tags`, `properties`, `display`). The caller's `form` argument SHALL be ignored.

Every draft/publish/revert PUT body SHALL include `_vnote` prefixed with `@formio/mcp:`.

`draft`, `publish`, `revert` SHALL be mutually exclusive; passing more than one SHALL throw.

#### Scenario: Draft body with non-allowlisted field is rejected

- **WHEN** `form_update` is called with `draft: true` and `form: { components: [], title: "X" }`
- **THEN** the tool throws naming the offending field(s)
- **AND** no PUT is sent

#### Scenario: Publish with no draft errors

- **WHEN** `form_update` is called with `publish: true` against a form whose `/draft` endpoint returns a non-draft `_vid`
- **THEN** the tool throws "No draft exists"

#### Scenario: Revert without version errors

- **WHEN** `form_update` is called with `revert: true` and no `version`
- **THEN** the tool throws requiring `version`

#### Scenario: Mutually exclusive flags

- **WHEN** `form_update` is called with both `draft: true` and `publish: true`
- **THEN** the tool throws naming the conflict

### Requirement: form_revision_list returns a form's revisions newest first

The server SHALL register `form_revision_list` (replacing `form_revisions_list`), taking `cwd`, `formIdOrPath`, and the shared list arguments. It SHALL request revisions sorted by `-_vid` by default and select compact metadata (`_id`, `_vid`, `_vnote`, `_vuser`, `created`, `modified`) unless `select` is given, and SHALL return the shared list result.

#### Scenario: Newest first

- **WHEN** a form has 15 revisions and `form_revision_list` is called
- **THEN** the first item is the highest `_vid`, all 15 are returned, and `total` is 15

