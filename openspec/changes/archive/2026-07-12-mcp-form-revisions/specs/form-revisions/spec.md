## ADDED Requirements

### Requirement: form_revisions_list returns revision summaries

The `form_revisions_list` tool SHALL call `GET /form/{id}/v` (or `GET /{alias}/v` for path aliases) and return the response as MCP text content.

#### Scenario: List by form id

- **WHEN** `form_revisions_list` is called with `formIdOrPath: "67890abcdef012345678abcd"`
- **THEN** it requests `/form/67890abcdef012345678abcd/v`
- **AND** returns the revision list as MCP text content

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

### Requirement: License gate prompts once for standard writes on unlicensed deployments

On an unlicensed deployment, `form_create` and standard `form_update` SHALL prompt the user once per `baseUrl` to continue without revision tracking. Positive consent SHALL persist to `~/.formio/revisions-license-consent.json` (mode 0600) and SHALL be cached in-memory thereafter. Cancel SHALL throw a user-cancelled error and SHALL NOT persist.

#### Scenario: User cancels the license gate

- **WHEN** the gate prompts and the user chooses "cancel"
- **THEN** the tool throws a USER CANCELLED error
- **AND** no API request is sent
- **AND** no consent is written to disk

#### Scenario: Cached consent skips the prompt

- **WHEN** `~/.formio/revisions-license-consent.json` already records `true` for the current `baseUrl`
- **THEN** the gate proceeds without prompting

### Requirement: Per-form tracking gate prompts when revisions are off

On a licensed deployment, a standard `form_update` (no `draft`/`publish`/`revert`) against a stored form whose `revisions` is falsy SHALL prompt the user with three choices — enable revisions (original), enable revisions (current), or proceed without history — UNLESS the caller opted in via `revisions: 'original'|'current'` on the body, OR the user already approved "proceed without history" for that `formId` in the current process. Passing `revisions: ''` SHALL NOT bypass the prompt. On cancel, the tool SHALL throw and no PUT SHALL be sent.

#### Scenario: Caller opted in via revisions: 'current'

- **WHEN** `form_update` is called with `form: { ..., revisions: 'current' }` against a form with revisions disabled
- **THEN** no prompt is shown
- **AND** the PUT body contains `revisions: 'current'`

#### Scenario: Caller passes revisions: '' on a disabled form

- **WHEN** `form_update` is called with `form: { ..., revisions: '' }` against a form with revisions disabled
- **THEN** the per-form tracking gate prompts the user

#### Scenario: User chooses enable revisions (original)

- **WHEN** the gate prompts and the user chooses "enable-original"
- **THEN** the PUT body contains `revisions: 'original'`

#### Scenario: User chooses proceed without history

- **WHEN** the gate prompts and the user chooses "proceed-without-history"
- **THEN** any caller-supplied `revisions` is stripped from the PUT body
- **AND** subsequent `form_update` calls for the same `formId` in this process do not re-prompt

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