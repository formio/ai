## Why

Form.io supports per-form revision history (versioned form definitions with author, timestamp, and note metadata) plus a draft/publish workflow, but the MCP server exposes none of it. Agents using the server cannot inspect prior form versions, restore one, enable revisions on an existing form, or move a draft to publication — forcing users out of the agent loop and back to the portal UI for any version-aware editing. Tracked in [FIO-11561](https://formio.atlassian.net/browse/FIO-11561).

## What Changes

- Add six new MCP tools under `packages/mcp-server/src/tools/`:
  - `form_revisions_list` — return revision summaries (`vid`, modified date, owner display, note) for a form.
  - `form_revision_get` — return the full form definition at a specific `vid`.
  - `form_revisions_set` — set the form's `revisions` field to enable, switch, or disable revisions. Required `mode: "current" | "original" | ""` — no default. `"current"` and `"original"` enable (display mode for historical submissions); `""` disables (server preserves `_vid` and existing `formrevisions` rows). Calling without `mode` is a schema error so the agent asks the user.
  - `form_draft_create` — create or overwrite the form's single active draft (the portal allows only one draft at a time).
  - `form_draft_get` — fetch the form's current active draft (the `_vid: "draft"` row in `formrevisions`). Distinct from `form_revision_get`, which fetches a published, immutable numbered revision.
  - `form_draft_publish` — promote the current draft (or a caller-supplied definition) to a new published revision, accepting an optional `note` so the published revision carries the same "Revision notes" string the portal UI captures.
- Register all six via `registerAllTools` in [packages/mcp-server/src/tools/index.ts](packages/mcp-server/src/tools/index.ts), following the existing `form_*` registration pattern (cwd-resolved project config, `formioFetch`, `toMcpTextResult` / `toMcpError`).
- Update the existing [plugin/skills/formio-api/references/project-form-revisions.md](plugin/skills/formio-api/references/project-form-revisions.md) so its `## MCP Tool Preference` section names the new tools instead of saying "No MCP tool covers this operation — use the HTTP endpoint directly."
- If needed, tighten the router skill's trigger clause in [plugin/skills/formio-api/SKILL.md](plugin/skills/formio-api/SKILL.md) so revision-related prompts (drafts, publishing, version history) reliably activate the skill.

## Capabilities

### New Capabilities

- `form-revisions`: MCP tools and skill reference for listing form revisions, fetching a form at a specific revision, enabling revisions on a form, and managing the draft/publish lifecycle for a form.

### Modified Capabilities

<!-- The existing project-form-revisions.md reference already exists and is already covered by skills-validator. Editing its MCP Tool Preference section does not change spec-level behavior, so no capability deltas are needed here. -->


## Impact

- **Code**: new files under `packages/mcp-server/src/tools/` (`form_revisions_list.ts`, `form_revision_get.ts`, `form_revisions_set.ts`, `form_draft_create.ts`, `form_draft_get.ts`, `form_draft_publish.ts`), edits to `tools/index.ts` to register them, new tests under `packages/mcp-server/src/tools/__tests__/` (or wherever the existing form tool tests live).
- **Skills library**: edit `plugin/skills/formio-api/references/project-form-revisions.md` (`## MCP Tool Preference` section); optional trigger-clause tightening in `plugin/skills/formio-api/SKILL.md`.
- **Validator**: no schema-level change expected — existing skills-validator coverage of `project-form-revisions.md` remains sufficient.
- **APIs consumed** (per `project-form-revisions.md`):
  - `GET ${FORMIO_PROJECT_URL}/form/:formId/v` — list revisions
  - `GET ${FORMIO_PROJECT_URL}/form/:formId/v/:version` — get form at specific revision (sequential `vid` or revision `_id`)
  - `PUT ${FORMIO_PROJECT_URL}/form/:formId` — enable revisions (set `revisions` flag) and publish (a `PUT` on a revisioned form publishes the next revision)
  - `PUT ${FORMIO_PROJECT_URL}/form/:formId/draft` — save a draft
  - `GET ${FORMIO_PROJECT_URL}/form/:formId/draft` — read current draft (used to support an "open the draft" flow even though the ticket only names create/publish).
- **Auth**: no change — reuses existing portal-login JWT via `formioFetch`.
- **No breaking changes** to existing tools or skill structure.
