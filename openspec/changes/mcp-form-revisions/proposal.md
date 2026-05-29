## Why

Form.io supports a draft → publish → revert revision lifecycle on licensed deployments, but the MCP server only exposed a flat PUT. Once `revisions` is enabled on a form, every standard `PUT /form/:id` also creates a new revision automatically — the draft/publish flow is optional, but day-to-day history tracking happens on standard updates. LLMs had no way to stage edits, list history, roll back, surface the "Security Module required" license condition, or surface the per-form revision-mode decision to the user. Result: silent loss of audit history on unlicensed deployments, no way to drive Form.io's revisions workflow from chat, and standard updates against a revisions-disabled form silently skipped history with no user-facing decision point.

## What Changes

- **NEW** `form_revisions_list` — `GET /form/:id/v`, returns revision summaries.
- **NEW** `form_revision_get` — `GET /form/:id/v/:version`, returns a single revision body.
- **`form_update`** gains `draft`, `publish`, `revert` (mutually exclusive), `version` (for `revert`), and required `note`. Drafts/publishes/reverts use field allowlists; `note` is persisted as `_vnote` with `@formio/mcp:` prefix on every write — including standard PUTs, which create a new revision server-side whenever the stored form has `revisions` enabled.
- **`form_get`** gains `draft: true` to fetch the in-flight draft (errors when no draft exists).
- **`form_create`** defaults `revisions: 'original'` on licensed deployments; strips `revisions` when unlicensed.
- **License gate** — once per `baseUrl`, prompts the user to "continue without revision tracking" when the Security Module is absent. Positive consent persists in `~/.formio/revisions-license-consent.json`. `draft`/`publish`/`revert` throw on unlicensed deployments.
- **Per-form tracking gate** — on standard `form_update` against a licensed deployment, when the stored form has `revisions` disabled and the caller did not opt in via `revisions: 'original'|'current'`, prompts the user to enable revisions or proceed without history. `revisions: ''` does NOT bypass the prompt. Per-form approvals are session-scoped.
- Both gates prompt via MCP elicitation when the client supports it; fall back to a local browser consent page otherwise.

## Capabilities

### New Capabilities

- `form-revisions`

### Modified Capabilities

- `form-create`
- `form-update`
- `form-get`

## Impact

- New tools: `form_revisions_list`, `form_revision_get` (registered in `tools/index.ts`).
- New module: `src/revisions/` (license gate, tracking gate, draft/publish/revert flows, browser fallback prompts, helpers).
- Touched tools: `form_create`, `form_update`, `form_get`.
- New on-disk file: `~/.formio/revisions-license-consent.json` (mode 0600).
- Reference doc updated: `plugin/skills/formio-api/references/project-form-revisions.md`.