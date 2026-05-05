## 1. form_revisions_list
<!-- depends_on: none -->

### Red

- [x] 1.1 Write failing test: tool returns the array from `GET /form/{id}/v` when called with a Mongo `_id` and forwards `cwd` through `resolveProjectConfig`
- [x] 1.2 Write failing test: tool resolves a path argument to an `_id` via `formioFetch` before calling `/v`
- [x] 1.3 Write failing test: tool returns a `toMcpError` payload preserving the upstream message when `formioFetch` throws a 404
- [x] 1.4 Snapshot a real `GET /form/{id}/v` response — confirmed wire fields per `formrevisions` doc: `_id`, `_rid`, `revisionId`, `_vid`, `_vnote`, `_vuser`, `modified`, plus full form snapshot. Commit the fixture so future shape changes break loudly

### Green

- [x] 1.5 Implement `packages/mcp-server/src/tools/form_revisions_list.ts` (registers `form_revisions_list`, accepts `cwd` + `formIdOrPath`, uses `isMongoId` + `formioFetch`, wraps with `toMcpTextResult` / `toMcpError`)
- [x] 1.6 Wire `registerFormRevisionsListTool` into `registerAllTools` in [packages/mcp-server/src/tools/index.ts](packages/mcp-server/src/tools/index.ts)
- [x] 1.7 If the upstream listing omits any of `vid` / `modified` / `owner` / `note`, document the gap explicitly in the tool's description string so callers don't expect fields that aren't there

### Refactor

- [x] 1.8 Review implementation and refactor as needed

## 2. form_revision_get
<!-- depends_on: none -->

### Red

- [x] 2.1 Write failing test: tool fetches `GET /form/{id}/v/{version}` for a sequential numeric version
- [x] 2.2 Write failing test: tool fetches `GET /form/{id}/v/{revisionId}` when `version` is a Mongo `_id`
- [x] 2.3 Write failing test: tool resolves a path-style `formIdOrPath` to an `_id` first
- [x] 2.4 Write failing test: missing revision (upstream 404) surfaces via `toMcpError` with form + version in the message

### Green

- [x] 2.5 Implement `packages/mcp-server/src/tools/form_revision_get.ts` accepting `cwd`, `formIdOrPath`, `version: string | number`
- [x] 2.6 Register the tool in `registerAllTools`

### Refactor

- [x] 2.7 Review implementation and refactor as needed

## 3. form_revisions_set
<!-- depends_on: none -->

Single tool covers enable, switch, and disable via the form's `revisions` field. Required `mode` enum is the wire value: `"current" | "original" | ""`.

### Red

- [x] 3.1 Write failing test: with `mode: "current"` on a form whose `revisions` is `""`, tool fetches the form, merges `revisions: "current"`, and `PUT`s the merged body. Assert exactly one `PUT` is issued; the server-side side-effect of creating the v1 `formrevisions` row is out of the tool's responsibility
- [x] 3.2 Write failing test: with `mode: "original"`, the merged body sent to `PUT /form/{id}` carries `revisions: "original"`
- [x] 3.3 Write failing test: with `mode: ""` on a revisioned form, the merged body sent to `PUT /form/{id}` carries `revisions: ""` (disable). Assert exactly one `PUT` is issued
- [x] 3.4 Write failing test: invocation without `mode` fails Zod validation, no upstream HTTP is issued, and the error names `mode`
- [x] 3.5 Write failing test: invocation with an unknown mode value (e.g. `"bogus"`) fails Zod validation, no upstream HTTP is issued
- [x] 3.6 Write failing test: tool description and the `mode` parameter description (passed to `server.tool(...)`) tell the agent to confirm intent with the user and list all three valid values
- [x] 3.7 Write failing test: when current form already has the requested `mode` (including `""` on an already-disabled form), tool short-circuits and returns the existing form without issuing a `PUT`
- [x] 3.8 Write failing test: when current form has a different `revisions` value, tool issues a `PUT` flipping it
- [x] 3.9 Write failing test: initial `GET /form/{id}` 404 surfaces via `toMcpError` and no `PUT` is issued
- [x] 3.10 Write failing test: upstream 402/403 (Security Module / license rejection) surfaces verbatim through `toMcpError`
- [x] 3.11 Pin assertions against the confirmed shape: `revisions` is a single string field on the form doc (values `""` / `"current"` / `"original"`). Snapshot enable + disable wire fixtures so the tests assert against real wire data

### Green

- [x] 3.12 Implement `packages/mcp-server/src/tools/form_revisions_set.ts` (GET → mutate → PUT; `mode` is a required Zod enum `["current", "original", ""]` with no default; no-op short-circuit; tool/parameter descriptions tell the agent to confirm intent). Do NOT issue a separate seed write for the first `formrevisions` row — same PUT inserts v1 row automatically. On disable, server preserves `_vid` and existing rows.
- [x] 3.13 Register the tool in `registerAllTools`

### Refactor

- [x] 3.14 Review implementation and refactor as needed

## 4. form_draft_create
<!-- depends_on: none -->

### Red

- [x] 4.1 Write failing test: with an explicit `definition` and no `note`, tool issues `PUT /form/{id}/draft` with that body and no `_vnote` field
- [x] 4.2 Write failing test: with an explicit `definition` and `note: "wip"`, tool issues `PUT /form/{id}/draft` with `_vnote: "wip"` at the top level of the body
- [x] 4.3 Write failing test: without `definition`, tool fetches the current form via `GET /form/{id}` and `PUT`s that body to `/draft`
- [x] 4.4 Write failing test: upstream 404 on `PUT /draft` (revisions not enabled) returns a `toMcpError` whose message instructs the caller to run `form_revisions_set` first
- [x] 4.5 Write failing test: tool's MCP description (passed as the second arg to `server.tool(...)`) contains the substring "one active draft" and "overwrites" so MCP clients listing the tool see the warning

### Green

- [x] 4.6 Implement `packages/mcp-server/src/tools/form_draft_create.ts` accepting `cwd`, `formIdOrPath`, optional `definition`, optional `note`, with the warning surfaced in the description string
- [x] 4.7 Register the tool in `registerAllTools`

### Refactor

- [x] 4.8 Review implementation and refactor as needed

## 5. form_draft_get
<!-- depends_on: none -->

### Red

- [x] 5.1 Write failing test: with a Mongo `_id` formIdOrPath, tool issues a single `GET /form/{id}/draft` and returns the draft via `toMcpTextResult`
- [x] 5.2 Write failing test: with a path-style formIdOrPath, tool resolves the path to an `_id` first via `formioFetch`, then issues `GET /form/{id}/draft`
- [x] 5.3 Write failing test: upstream 404 (no draft saved or revisions disabled) surfaces via `toMcpError` preserving the upstream message
- [x] 5.4 Write failing test: tool MCP description distinguishes the active draft from numbered revisions and points callers to `form_revision_get` for immutable history (substrings: "draft", "form_revision_get")

### Green

- [x] 5.5 Implement `packages/mcp-server/src/tools/form_draft_get.ts` accepting `cwd` + `formIdOrPath`, mirroring `form_revision_get.ts` in shape (cwd-resolved config, `isMongoId` short-circuit, `formioFetch`, `toMcpTextResult` / `toMcpError`)
- [x] 5.6 Wire `registerFormDraftGetTool` into `registerAllTools` in [packages/mcp-server/src/tools/index.ts](packages/mcp-server/src/tools/index.ts)

### Refactor

- [x] 5.7 Review implementation and refactor as needed

## 6. form_draft_publish
<!-- depends_on: 4 -->

### Red

- [x] 6.1 Write failing test: with no `definition` and no `note`, tool fetches `GET /form/{id}/draft` and publishes via `PUT /form/{id}` with that body
- [x] 6.2 Write failing test: with a `note: "Added email field"` and no `definition`, the body sent to `PUT /form/{id}` includes `_vnote: "Added email field"` (field name confirmed against `mcp.formrevisions`)
- [x] 6.3 Write failing test: with a `definition`, tool publishes via `PUT /form/{id}` using the supplied body, skips the draft GET, and still attaches `note` if provided
- [x] 6.4 Write failing test: missing draft (upstream 404 on draft GET) surfaces via `toMcpError` indicating no draft exists
- [x] 6.5 Write failing test: 409 conflict from publishing `PUT` is preserved through `toMcpError`
- [x] 6.6 Write failing test: when the publish body matches the current published form (ignoring `_vnote`), the tool returns the form (success — not an error) and the response indicates no new revision was created
- [x] 6.7 Write failing test: tool description states (a) note rides as `_vnote`, (b) server auto-clears the draft row when a real revision is created, (c) publish is a no-op against an unchanged body
- [x] 6.8 Snapshot the publish wire format (already pinned via Playwright capture): top-level `_vnote` in the `PUT /form/{id}` request body, response strips it, new `formrevisions` row carries the value plus `_vuser`. Commit the captured request/response pair as a fixture so future drift breaks loudly. Also snapshot the draft-save wire (`PUT /form/{id}/draft` with top-level `_vnote`) — verified end-to-end and the server upserts a `formrevisions` row with `_vid: "draft"`

### Green

- [x] 6.9 Implement `packages/mcp-server/src/tools/form_draft_publish.ts` accepting `cwd`, `formIdOrPath`, optional `definition`, optional `note`. Do NOT issue a separate delete of the draft row — server clears it automatically when a real revision is created
- [x] 6.10 Register the tool in `registerAllTools`

### Refactor

- [x] 6.11 Review implementation and refactor as needed

## 7. Skill reference update
<!-- depends_on: 1, 2, 3, 4, 5, 6 -->

### Red

- [x] 7.1 Write failing skills-validator (or string-content) test asserting `plugin/skills/formio-api/references/project-form-revisions.md`'s `## MCP Tool Preference` section names all six new tools (`form_revisions_list`, `form_revision_get`, `form_revisions_set`, `form_draft_create`, `form_draft_get`, `form_draft_publish`)

### Green

- [x] 7.2 Replace the `## MCP Tool Preference` block in `project-form-revisions.md` to map each new tool to the endpoint(s) it covers, keeping the canonical portal-login JWT auth paragraph intact
- [x] 7.3 Confirm `pnpm test` passes (skills-validator suite still green)

### Refactor

- [x] 7.4 Review implementation and refactor as needed

## 8. Definition of Done
<!-- depends_on: 1, 2, 3, 4, 5, 6, 7 -->

### Red

- [x] 8.1 (No new tests — this group exercises the existing suite end-to-end)

### Green

- [x] 8.2 Run `pnpm test` and resolve any failures
- [x] 8.3 Run `pnpm lint` (typecheck) and resolve any errors
- [x] 8.4 Run `pnpm format` and commit any formatting deltas

### Refactor

- [x] 8.5 Review implementation and refactor as needed
