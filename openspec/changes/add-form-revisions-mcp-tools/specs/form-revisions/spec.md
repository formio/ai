## ADDED Requirements

### Requirement: List form revisions

The MCP server SHALL expose a `form_revisions_list` tool that returns the revision history for a Form.io form, accepting either a form `_id` or a path and resolving paths to `_id` before issuing the upstream request. The tool SHALL return a **compact summary per revision** rather than the raw upstream document — each entry SHALL contain `vid` (from `_vid`), `modified` (ISO timestamp), `user` (from `_vuser`), and `note` (from `_vnote`). Full form snapshots (`components`, `access`, `settings`, etc.) are intentionally omitted from the summary; callers needing a single revision's full body SHALL use `form_revision_get`.

#### Scenario: List revisions by form id returns compact summaries

- **WHEN** the caller invokes `form_revisions_list` with `cwd` and a `formIdOrPath` that is a Mongo `_id`
- **THEN** the tool issues `GET ${FORMIO_PROJECT_URL}/form/{id}/v` and returns an array of summary objects (each with `vid`, `modified`, `user`, `note`) wrapped via `toMcpTextResult`. Full form snapshot fields (e.g. `components`, `access`, `_id`, `_rid`, `revisionId`) are NOT included in the summary entries.

#### Scenario: List revisions by form path

- **WHEN** the caller invokes `form_revisions_list` with a `formIdOrPath` that is not a Mongo id
- **THEN** the tool first resolves the path to an `_id` via `formioFetch`, then issues `GET /form/{id}/v` and returns the summarized result

#### Scenario: Form not found

- **WHEN** the upstream call returns 404
- **THEN** the tool returns an `toMcpError` payload preserving the upstream message and status

#### Scenario: Tool description points to `form_revision_get` for full bodies

- **WHEN** an MCP client lists the server's tools and inspects `form_revisions_list`'s description
- **THEN** the description states the four summary fields (`vid`, `modified`, `user`, `note`) and points the caller to `form_revision_get` for fetching a specific revision's full form definition

### Requirement: Get form at a specific revision

The MCP server SHALL expose a `form_revision_get` tool that returns the full form definition at a specific revision, identified by either a sequential version number or a revision `_id`.

#### Scenario: Fetch by sequential version

- **WHEN** the caller invokes `form_revision_get` with `formIdOrPath` and `version: "2"`
- **THEN** the tool issues `GET /form/{id}/v/2` and returns the revision document

#### Scenario: Fetch by revision id

- **WHEN** the caller invokes `form_revision_get` with a `version` that is a Mongo `_id`
- **THEN** the tool issues `GET /form/{id}/v/{revisionId}` and returns the revision document

#### Scenario: Revision missing

- **WHEN** the upstream call returns 404
- **THEN** the tool returns a `toMcpError` payload identifying the form and version requested

### Requirement: Set form revisions mode (enable, switch, or disable)

The MCP server SHALL expose a `form_revisions_set` tool that sets the form's `revisions` field. The tool SHALL accept a **required** `mode: "current" | "original" | ""` argument matching the on-disk wire values: `"current"` and `"original"` enable revisions (display mode for historical submissions); `""` disables revisions. There SHALL be NO default — calls without `mode` SHALL be rejected by the input schema so the agent confirms intent with the user. The tool SHALL avoid clobbering unrelated fields by performing a GET → merge → PUT.

#### Scenario: Enable on a form that does not yet have revisions

- **WHEN** the caller invokes `form_revisions_set` for a form with `revisions: ""`, with `mode: "current"`
- **THEN** the tool fetches the current form via `GET /form/{id}`, sets `revisions: "current"` on the body (preserving all other fields), and issues `PUT /form/{id}` with the merged body, returning the updated form

#### Scenario: Disable revisions on a revisioned form

- **WHEN** the caller invokes `form_revisions_set` for a form whose `revisions` is `"current"` or `"original"`, with `mode: ""`
- **THEN** the tool issues `PUT /form/{id}` with `revisions: ""` on the merged body, returning the updated form. The server preserves `_vid` and existing `formrevisions` rows; only the form's `revisions` field flips.

#### Scenario: Mode is required

- **WHEN** the caller invokes `form_revisions_set` without supplying `mode`
- **THEN** the Zod input schema rejects the call with a validation error naming `mode`, and no upstream HTTP request is made

#### Scenario: Tool description directs the agent to confirm intent

- **WHEN** an MCP client lists the server's tools and inspects `form_revisions_set`'s description and the `mode` parameter description
- **THEN** the description states that `mode` is required, lists all three valid values (`"current"`, `"original"`, `""`), and tells the agent to confirm intent with the user rather than guessing

#### Scenario: Enable with mode "original"

- **WHEN** the caller invokes `form_revisions_set` with `mode: "original"`
- **THEN** the merged body sent to `PUT /form/{id}` carries `revisions: "original"`, not `"current"` and not `""`

#### Scenario: No-op when already at requested mode

- **WHEN** the caller invokes `form_revisions_set` for a form whose `revisions` field already matches the requested `mode` (including `mode: ""` on an already-disabled form)
- **THEN** the tool returns the existing form without issuing a `PUT`

#### Scenario: Switch mode between current and original

- **WHEN** the caller invokes `form_revisions_set` with a `mode` different from the form's current `revisions` value
- **THEN** the tool issues a `PUT /form/{id}` that flips the value and returns the updated form

#### Scenario: Form not found

- **WHEN** the initial `GET /form/{id}` returns 404
- **THEN** the tool returns a `toMcpError` payload and does not issue a `PUT`

#### Scenario: License-gated rejection

- **WHEN** the upstream `PUT /form/{id}` returns 402 or 403 because the project lacks the Security Module / form-revisions license
- **THEN** the tool returns a `toMcpError` payload preserving the upstream status and message verbatim

### Requirement: Get the current draft of a revisioned form

The MCP server SHALL expose a `form_draft_get` tool that returns the form's currently saved draft (the single `_vid: "draft"` row in `formrevisions`). The tool SHALL accept either a form `_id` or a path and resolve paths to `_id` before issuing the upstream request. This tool is distinct from `form_revision_get`: that tool reads an immutable numbered revision via `GET /form/{id}/v/{version}`, whereas `form_draft_get` reads the mutable WIP draft via `GET /form/{id}/draft`. The tool description SHALL state this distinction so the agent picks the correct tool.

#### Scenario: Fetch draft by form id

- **WHEN** the caller invokes `form_draft_get` with `cwd` and a `formIdOrPath` that is a Mongo `_id`
- **THEN** the tool issues `GET /form/{id}/draft` and returns the draft document via `toMcpTextResult`

#### Scenario: Fetch draft by form path

- **WHEN** the caller invokes `form_draft_get` with a `formIdOrPath` that is not a Mongo id
- **THEN** the tool first resolves the path to an `_id` via `formioFetch`, then issues `GET /form/{id}/draft` and returns the draft document

#### Scenario: No draft exists

- **WHEN** the upstream `GET /form/{id}/draft` returns 404 because no draft has been saved (or revisions are not enabled)
- **THEN** the tool returns a `toMcpError` payload preserving the upstream message and status

#### Scenario: Tool description distinguishes draft from numbered revision

- **WHEN** an MCP client lists the server's tools and inspects `form_draft_get`'s description
- **THEN** the description states that this tool reads the mutable active draft (the `_vid: "draft"` row) and points the caller to `form_revision_get` for immutable numbered revisions

### Requirement: Create or update the draft of a revisioned form

The MCP server SHALL expose a `form_draft_create` tool that saves a draft revision for a form, defaulting to copying the current published form when no explicit definition is supplied, and accepting an optional `note: string` argument that is forwarded as `_vnote` on the saved draft row. The tool description SHALL state that a form has at most one active draft at a time and that calling `form_draft_create` overwrites any existing draft.

After issuing the `PUT /form/{id}/draft`, the tool SHALL issue a follow-up `GET /form/{id}/draft` and return the GET response (not the PUT response). This works around an upstream Form.io server bug: `FormResource.putDraft` calls Mongoose `findOneAndUpdate` without `{ new: true }` on overwrite, so the PUT response is the **pre-update** document. The re-fetch returns ground truth, mirroring how the portal sidesteps the bug via a full page reload after each draft save. The workaround SHALL be removed once the upstream bug is fixed.

#### Scenario: Save explicit draft body

- **WHEN** the caller invokes `form_draft_create` with `formIdOrPath` and a `definition` object
- **THEN** the tool issues `PUT /form/{id}/draft` with the supplied definition (no `_vnote` if `note` was not supplied) and returns the saved draft

#### Scenario: Default to copying current published form

- **WHEN** the caller invokes `form_draft_create` with `formIdOrPath` and no `definition`
- **THEN** the tool fetches the current form via `GET /form/{id}` and issues `PUT /form/{id}/draft` with that body, returning the saved draft

#### Scenario: Save draft with a note

- **WHEN** the caller invokes `form_draft_create` with `formIdOrPath` and `note: "wip-add-email-field"`
- **THEN** the body sent to `PUT /form/{id}/draft` includes `_vnote: "wip-add-email-field"` at the top level, and the resulting `formrevisions` row at `_vid: "draft"` carries that note

#### Scenario: Revisions not enabled

- **WHEN** the upstream `PUT /form/{id}/draft` returns 404 because the form does not have revisions enabled
- **THEN** the tool returns a `toMcpError` payload whose message guides the caller to invoke `form_revisions_set` first

#### Scenario: Tool description warns of overwrite

- **WHEN** an MCP client lists the server's tools and inspects `form_draft_create`'s description
- **THEN** the description states that a form may have only one active draft at a time and that this tool overwrites any existing draft

#### Scenario: Returns post-PUT GET, not stale PUT response

- **WHEN** the caller invokes `form_draft_create` to overwrite an existing draft and the upstream `PUT /form/{id}/draft` returns the pre-update document
- **THEN** the tool issues a follow-up `GET /form/{id}/draft` and returns the GET response (carrying the new `_vnote` and other just-saved fields), not the stale PUT response

### Requirement: Publish a draft form with an optional revision note

The MCP server SHALL expose a `form_draft_publish` tool that promotes the saved draft to the next published revision, accepting an optional `note: string` argument that is forwarded as the published revision's note (the same value the portal collects under "Revision notes"), with an optional `definition` override to publish a caller-supplied body without going through the saved draft.

The tool SHALL strip any `_vnote` field from the resolved publish body BEFORE issuing the PUT, regardless of whether the body came from the merged draft path or the caller-supplied `definition` path. The published revision's `_vnote` SHALL be set EXCLUSIVELY by the explicit `note` argument — a draft's own `_vnote` SHALL NOT carry over to the published revision. This matches portal behavior, where the draft note (work-in-progress) and the publish note (revision note) are independent concepts.

The tool description SHALL explicitly forbid the calling agent from auto-populating `note` based on the draft's `_vnote`. Both the tool description and the `note` parameter description SHALL instruct the agent to leave `note` undefined unless the user has explicitly stated what the published revision's note should be.

#### Scenario: Publish saved draft

- **WHEN** the caller invokes `form_draft_publish` with `formIdOrPath`, no `definition`, and no `note`
- **THEN** the tool fetches the current draft via `GET /form/{id}/draft`, issues `PUT /form/{id}` with that body, and returns the published form

#### Scenario: Publish saved draft with a note

- **WHEN** the caller invokes `form_draft_publish` with `formIdOrPath` and `note: "Added email field"`
- **THEN** the tool fetches the current draft, attaches the note to the publish body via the API's revision-note field, issues `PUT /form/{id}`, and returns the published form whose listing entry exposes that note via `form_revisions_list`

#### Scenario: Publish caller-supplied definition

- **WHEN** the caller invokes `form_draft_publish` with `formIdOrPath` and a `definition`
- **THEN** the tool issues `PUT /form/{id}` with the supplied definition (plus `note` if provided) and returns the published form, without first fetching the draft

#### Scenario: No draft exists

- **WHEN** the caller invokes `form_draft_publish` without a `definition` and `GET /form/{id}/draft` returns 404
- **THEN** the tool returns a `toMcpError` payload indicating no draft exists

#### Scenario: `_vid` conflict on publish

- **WHEN** the publishing `PUT /form/{id}` returns 409
- **THEN** the tool returns a `toMcpError` payload preserving the conflict message so the caller can retry

#### Scenario: Publish with no diff vs current published form

- **WHEN** the caller invokes `form_draft_publish` and the resolved publish body matches the current published form exactly (ignoring `_vnote`)
- **THEN** the tool returns the form (HTTP 200, success) without surfacing an error, and the response signals to the caller that no new revision was created — the MCP tool description SHALL document this no-op behavior so the calling LLM knows to vary the body if a `_vid` bump is required

#### Scenario: Server auto-clears the saved draft after a successful publish

- **WHEN** `form_draft_publish` issues a `PUT /form/{id}` that creates a new numeric revision row
- **THEN** the tool does NOT issue a separate delete of the draft row; the upstream server removes the `_vid: "draft"` row automatically as part of the publish

#### Scenario: Draft's `_vnote` does NOT transfer to the published revision when no `note` arg supplied

- **WHEN** the caller invokes `form_draft_publish` without supplying a `note` argument and the saved draft has a non-empty `_vnote`
- **THEN** the publish body sent to `PUT /form/{id}` SHALL NOT contain `_vnote`, and the resulting numbered revision row's `_vnote` SHALL be the empty string `""` — matching portal behavior where the draft note and the publish note are independent

#### Scenario: Caller-supplied `definition._vnote` is stripped before publishing

- **WHEN** the caller invokes `form_draft_publish` with a `definition` object that contains `_vnote`, and no `note` argument
- **THEN** the publish body sent to `PUT /form/{id}` SHALL NOT contain the `_vnote` from the supplied `definition`; the published revision's `_vnote` SHALL be empty unless the caller also passes a `note` argument

#### Scenario: Tool description forbids the agent from auto-inferring `note` from the draft

- **WHEN** an MCP client lists the server's tools and inspects `form_draft_publish`'s description and the `note` parameter description
- **THEN** both descriptions explicitly instruct the agent NOT to auto-populate `note` from the draft's `_vnote`, state that draft notes and publish notes are independent concepts, and direct the agent to leave `note` undefined unless the user has explicitly stated what the published revision's note should be

### Requirement: Tool registration

All six tools SHALL be registered through `registerAllTools` in [packages/mcp-server/src/tools/index.ts](packages/mcp-server/src/tools/index.ts) and SHALL accept `cwd` (the standard `cwdSchema`) so the project resolver applies.

#### Scenario: Server exposes the new tools

- **WHEN** `registerAllTools` runs against an `McpServer` instance
- **THEN** the server's tool list includes `form_revisions_list`, `form_revision_get`, `form_revisions_set`, `form_draft_create`, `form_draft_get`, and `form_draft_publish`, each with a `cwd` argument

### Requirement: Skill reference points to the new tools

The reference document at [plugin/skills/formio-api/references/project-form-revisions.md](plugin/skills/formio-api/references/project-form-revisions.md) SHALL replace its current "No MCP tool covers this operation" note with a `## MCP Tool Preference` block that names the six new tools and maps each to the endpoint it covers.

#### Scenario: MCP Tool Preference section names the new tools

- **WHEN** a reader opens `project-form-revisions.md`
- **THEN** the `## MCP Tool Preference` section instructs Claude to prefer `form_revisions_list`, `form_revision_get`, `form_revisions_set`, `form_draft_create`, `form_draft_get`, and `form_draft_publish` over raw HTTP calls for the operations they cover

#### Scenario: Skills validator still passes

- **WHEN** `pnpm test` runs after the reference is updated
- **THEN** the skills-validator suite passes, confirming the reference still carries the canonical portal-login JWT auth paragraph and required heading layout
