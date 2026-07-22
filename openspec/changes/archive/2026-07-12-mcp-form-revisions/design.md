## Context

Form.io exposes a draft/publish/revert revision lifecycle on deployments licensed for the Security Module. Once `revisions` is enabled on a form, every standard `PUT /form/:id` also creates a new revision automatically — the draft/publish flow is optional, but day-to-day history tracking happens on standard updates. The MCP server previously only wrapped the flat `PUT /form/:id`, so LLMs could not stage edits, list history, or roll back, and had no way to surface either gating decision to the user (deployment-level license, per-form tracking mode). Standard updates against a revisions-disabled form also silently skipped history with no user-facing decision point.

## Goals / Non-Goals

**Goals:**

- Expose draft/publish/revert via `form_update` flags and add list/get tools for revisions.
- Block draft/publish/revert on unlicensed deployments with a clear error; offer one-time "continue without revision tracking" consent for standard writes.
- Force a per-form decision when a stored form has revisions disabled, instead of silently mirroring the disabled state.
- Persist every write's `_vnote` with a `@formio/mcp:` prefix so revision history is attributable on every path that produces a revision — standard updates (when `revisions` is enabled), drafts, publishes, reverts.

**Non-Goals:**

- No backward-compat shim for callers that previously passed `revisions: ''` to silently no-op the prompt — the gate now fires.
- No general-purpose UI for picking revisions; the browser fallback exists only because some MCP clients do not yet implement elicitation.

## Decisions

### Two distinct gates, in that order

1. **License gate** (`gateRevisionsLicense`) — keyed on `baseUrl`. Throws for draft/publish/revert when unlicensed; otherwise prompts once per `baseUrl` and persists positive consent in `~/.formio/revisions-license-consent.json`. Returns `{ licensed, form }` with `revisions` stripped when unlicensed.
2. **Per-form tracking gate** (`gateRevisionsTracking`) — keyed on `formId`. Runs only on standard `form_update` against licensed deployments when the stored form has `revisions` disabled and the caller did not opt in via `revisions: 'original'|'current'`. `revisions: ''` does NOT count as opt-in (would let an LLM auto-skip the audit-trail decision). Approval to "proceed without history" is session-scoped (`Set<formId>` in-memory).

**Rationale:** the two gates ask different questions ("is this deployment capable of revisions" vs. "for THIS form, how do you want them tracked"). Conflating them either silently strips revisions on every write or re-prompts forever. The split also lets `form_create` skip the tracking gate (there is no stored form yet).

### Prompt transport: elicitation with a browser fallback

When MCP elicitation is available, the gate uses it. Otherwise it spins up a local Express server on an ephemeral 127.0.0.1 port, renders a styled consent page, opens the user's browser, and resolves on the `/callback` POST. The fallback exists only because some clients have not shipped elicitation yet; both gates have a `// TEMPORARY` marker so we remove the browser path when we no longer need it.

### Field allowlists for draft / publish / revert

- Draft PUT body fields: `components`, `settings`, `tags`, `properties`, `controller`, `esign`, `display`. Non-allowlisted fields cause `saveDraft` to throw — anything outside the set is either silently dropped on publish (footgun) or has no effect on a draft (server-managed metadata).
- Publish overlays the live form with the draft's allowlist; caller `form` is ignored entirely so identity (title/name/path/access) is never silently rewritten by a publish.
- Revert overlays the live form with the revision's revert allowlist (`components`, `tags`, `properties`, `display`) — narrower than publish because reverts are rollback-only, not full revision restoration. 
- Standard updates are not affected

### `revisions: 'original'` default on form_create

New forms default to `revisions: 'original'` on licensed deployments so submission history is preserved by default — every subsequent standard `form_update` then produces a revision automatically, no draft/publish step required. Callers can override (`'current'`, `''`). On unlicensed deployments the field is stripped (the API would write it, but can't honor it).

### Standard updates are the primary history-tracking path

Draft/publish/revert exist for staged workflows, but the day-to-day history-tracking contract is: enable `revisions` on the form (default for new forms, opt-in via the per-form gate for existing ones), then every `form_update` PUT creates a revision server-side with the caller's `note` attached as `_vnote`. The two gates above exist to make sure that path is opted into deliberately — once opted in, no further prompts fire on subsequent updates to the same form.

## Risks / Trade-offs

- **Browser fallback opens an actual browser tab** — fine in interactive sessions, awkward in headless ones. The license gate is one-time per `baseUrl`; the tracking gate is one prompt per new form. We accept the friction.
- **Express dependency** adds a transitive footprint to the MCP server. Pinned to the consent-page use case; remove when elicitation is universal.
- **In-process license cache (`revisionsLicensedByBaseUrl`)** does not re-check `/config.js` across the lifetime of a process. If a deployment flips its Security Module state mid-session, the cached value lags until the MCP server restarts. Acceptable — license state is administrative and rare.

## Migration Plan

No data migration. Existing `.mcp.json` configs continue to work. First standard write against an unlicensed deployment prompts the user once and writes the consent file; first standard write against a licensed deployment for a form with revisions disabled prompts once per form.

Rollback: revert the PR; delete `~/.formio/revisions-license-consent.json` if undesired state lingers.
