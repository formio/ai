## Context

The Form.io revision API is documented in [plugin/skills/formio-api/references/project-form-revisions.md](plugin/skills/formio-api/references/project-form-revisions.md): list (`GET /form/:formId/v`), fetch by version (`GET /form/:formId/v/:version`), enable revisions (a regular `PUT /form/:formId` with `revisions: true` in the body), draft save/get (`PUT|GET /form/:formId/draft`), and publish (`PUT /form/:formId` once revisions are enabled). Auth is the same `x-jwt-token` portal-login flow used by every other tool.

The MCP server already has a stable pattern for form-scoped tools — see [packages/mcp-server/src/tools/form_get.ts](packages/mcp-server/src/tools/form_get.ts), [form_list.ts](packages/mcp-server/src/tools/form_list.ts), [form_update.ts](packages/mcp-server/src/tools/form_update.ts):

1. Take `cwd` plus a tool-specific input via Zod schemas; describe with `cwdSchema` so the project resolver applies.
2. Resolve the project config with `resolveProjectConfig(cwd, config)`.
3. Translate a `formIdOrPath` argument with `isMongoId` so callers can use either a MongoDB id or a path.
4. Call `formioFetch(path, params, cfg, init)` for HTTP I/O.
5. Wrap the response with `toMcpTextResult` / errors with `toMcpError`.
6. Register from `tools/index.ts` inside `registerAllTools`.

The existing `form_*` tools all assume the canonical form path is `form/{id}` — the same prefix applies to revision endpoints, so reuse is straightforward.

## Goals / Non-Goals

**Goals:**

- Cover the full FIO-11561 scope: list revisions, get form at a specific revision, enable revisions, create draft, publish draft.
- Match existing tool ergonomics so an LLM can use them with the same mental model as `form_get` / `form_update` (accept either `_id` or `path` for the form, accept either sequential `vid` or revision `_id` for `form_revision_get`, return JSON via `toMcpTextResult`).
- Keep the diff small: no new dependencies, no new helpers unless reused by ≥2 tools, no parallel "revisions service" abstraction.
- Update the skill reference's `## MCP Tool Preference` section so Claude prefers the new tools over raw HTTP for revision operations.

**Non-Goals:**

- Diffing two revisions, restoring a revision in-place, or any client-side merge logic. Callers can compose `form_revision_get` + `form_update` themselves.
- Exposing revision history for resources or actions (those entities aren't revisioned).
- Adding a `form_revisions_disable` tool; un-setting `revisions` is a regular `form_update` and out of ticket scope.
- Caching revision payloads.
- Changing the MCP server's auth model.

## Decisions

### Decision 1: Five tools, one per ticket bullet

Map the ticket's five bullets directly to five tools rather than collapsing into a single multi-action tool:

- `form_revisions_list`
- `form_revision_get`
- `form_revisions_set`
- `form_draft_create`
- `form_draft_publish`

**Rationale:** the existing tool registry already follows verb-per-tool naming (`form_get`, `form_update`, `form_create`). One tool per action keeps tool descriptions narrowly scoped, which matters for tool-selection accuracy by the calling LLM. Collapsing into `form_revisions` with a `mode` discriminator hurts that.

**Alternatives considered:**

- Single `form_revisions` tool with an `action` discriminator. Rejected — descriptions become a wall of conditionals, defeats the registry pattern.
- Three tools (list, get, write) with the write tool taking an enum of `enable|draft|publish`. Rejected — same issue at a smaller scale; also makes draft vs publish ambiguous since both are `PUT`.

### Decision 2: Accept `formIdOrPath` everywhere, resolve to `_id` once

Each new tool accepts a `formIdOrPath: string` arg and, when it is not a Mongo id, performs a single `formioFetch` to resolve the path to an `_id` before issuing the revision-specific request. Revision endpoints in the reference are documented under `/form/:formId/v` etc. with `formId` as the Mongo `_id`; the safest read is that the `_id` form is canonical. Resolving once on entry keeps callers from having to know which endpoints accept paths.

**Rationale:** matches `form_get.ts`'s `isMongoId(formIdOrPath)` ergonomic. Avoids subtle 404s if the API rejects paths on `/v/:version`.

**Alternatives considered:**

- Pass through whatever the caller gave us. Rejected — burns the LLM if the API inconsistently accepts paths.
- Add a separate `formId` arg with no path support. Rejected — would diverge from `form_get`/`form_update` UX.

### Decision 3: `form_revision_get` accepts either sequential `vid` or revision `_id`

Per the reference, `GET /form/:formId/v/:version` accepts both. Expose a single `version: string | number` arg with a Zod union, document both forms in `.describe()`, and pass through as a string segment.

**Rationale:** matches the API; no client-side branching needed.

### Decision 4: `form_revisions_set` covers enable, switch, and disable via the form's `revisions` field

The form doc carries a single string field `revisions` with three values: `""` (disabled), `"current"` (enabled, latest-revision rendering), `"original"` (enabled, captured-revision rendering). One tool covers all transitions.

The tool takes a **required** `mode: "current" | "original" | ""` argument matching the wire values verbatim — no default. When the calling LLM invokes the tool without `mode`, the Zod schema rejects the call so the agent confirms intent with the user. The tool then:

1. `GET /form/:formId` to fetch the current form definition.
2. Merge `revisions: mode` into the form body. Verified against `mcp.forms`: single string field, not a boolean, not nested.
3. `PUT /form/:formId` with the merged body.

Short-circuits when the form's current `revisions` value already matches the requested `mode` (including `""` on an already-disabled form) to avoid unnecessary writes.

**Rationale:** one tool with one knob matches the underlying schema (one field, three values). Splitting enable/disable across two tools would inflate the surface without gaining clarity. Disable is non-destructive — verified end-to-end that `revisions: ""` preserves `_vid` and existing `formrevisions` rows server-side.

**Alternatives considered:**

- Separate `form_revisions_set` + `form_revisions_disable`. Rejected — two tools for one wire field. Required-mode guard already forces the agent to be explicit; an explicit `mode: ""` is a safer disable path than a no-arg "disable" tool that could be invoked by mistake.
- Boolean-only. Rejected — drops the display-mode choice the portal exposes.
- `mode` with a default. Rejected — the three values have different effects, and silent defaults invite surprise.
- Require the caller to pass the full form body. Rejected — undermines the tool's value (LLM has to do the GET anyway).
- Use a hypothetical `PATCH` endpoint. Rejected — not present in the reference.

### Decision 5: `form_draft_create` accepts either an explicit `definition` or "copy from current published", and an optional `note`

Default: when called with no `definition`, the tool fetches the current published form and saves that as the draft (`PUT /form/:formId/draft`). When `definition` is supplied (full form JSON), it is used verbatim. The tool ALSO accepts an optional `note: string` that is forwarded as `_vnote` in the draft save body — drafts are themselves rows in `formrevisions` and carry their own `_vnote` (verified: a `Save Draft` click in the portal sends `_vnote` in the `PUT /form/:id/draft` body and that note persists on the `_vid: "draft"` row).

The tool description must state explicitly that **a form has at most one active draft at a time** ([per the help docs](https://help.form.io/userguide/forms/form-revisions)). Calling `form_draft_create` overwrites any existing draft. Storage detail: drafts live in `formrevisions` with `_vid: "draft"` (string sentinel) — a single row per form.

**Rationale:** matches the most common UX — "start a draft from the live form, then iterate" — without forcing the LLM to hand-roll a body. Supplying `definition` keeps the explicit path open.

**Alternatives considered:**

- Always require `definition`. Rejected — pushes the GET-then-PUT pattern onto every caller.
- Always copy from published, no override. Rejected — blocks the case where the LLM has constructed a new body from scratch.
- Refuse-if-draft-exists (require an explicit overwrite flag). Rejected — adds friction without protecting much, since the portal itself silently overwrites.

### Decision 6: `form_draft_publish` reads draft, then publishes via `PUT /form/:formId`, and forwards a revision `note`

Per the reference, publishing is a regular form `PUT` once revisions are enabled. Per the [help docs](https://help.form.io/userguide/forms/form-revisions), the portal captures a free-text "Revision notes" string at publish time and surfaces it on the Revisions tab. The MCP tool exposes the same as an optional `note: string`. The tool:

1. `GET /form/:formId/draft` to fetch the current draft (skipped if `definition` is supplied).
2. Attach the `note` to the body as **`_vnote`** at top level. Confirmed end-to-end against the live server (Playwright capture): `Save Draft` in the portal sends `PUT /form/:id/draft` with `_vnote` in the request body, and `Publish` sends `PUT /form/:id` with `_vnote` in the request body. Server populates `_vuser` itself from the JWT; callers do NOT send it.
3. `PUT /form/:formId` with the merged body.
4. Return the published form (which carries the new `_vid`).

Accept a `definition` arg (same shape as `form_draft_create`) to publish without going through the saved draft.

**Important nuance** (verified): publish is a no-op when the body matches the current published form ignoring `_vnote`. No new revision row is created, the draft row survives, and the response returns the unchanged form. The MCP tool surfaces this as success — it does not fabricate a "no-op" error. Callers wanting a guaranteed `_vid` bump must change something in the body.

**Auto-clear:** when publish DOES create a new revision row, the server also removes the `_vid: "draft"` row. The MCP tool does not need to delete the draft separately.

**Rationale:** the ticket lists `note` as one of the four columns surfaced by "Show form revisions" — without a `note` arg on publish, the listing tool always shows blank notes for revisions the agent created. That defeats half the value of the listing.

**Alternatives considered:**

- No `note` arg, callers preset it on the draft body. Rejected — `note` is a publish-time input in the portal, not a draft body field. Wrong layer.
- Required `note`. Rejected — the portal allows blank notes; matching that keeps the tool unsurprising.

### Decision 7: Reference doc edit instead of new reference doc

The proposal initially called for a new `form-revisions.md` reference. The repo already has [plugin/skills/formio-api/references/project-form-revisions.md](plugin/skills/formio-api/references/project-form-revisions.md). Edit the existing file's `## MCP Tool Preference` section from:

> No MCP tool covers this operation — use the HTTP endpoint directly.

to a list of the five new tools mapped to the endpoints they cover, retaining a fallback note for endpoints they don't.

**Rationale:** avoids reference duplication and validator churn.

## Risks / Trade-offs

- [Reading current form before enable risks a `_vid` race] → keep the `GET → mutate → PUT` window tight; surface 409s as `toMcpError` so the LLM can retry. No locking added; matches existing `form_update` posture.
- [Some Form.io deployments may not accept paths on `/v/:version`] → resolving to `_id` on entry side-steps this, at the cost of one extra GET when callers pass a path. Acceptable.
- [`form_draft_create`'s default-copy-from-published is a "magic" behavior] → document it explicitly in the tool description so the LLM knows when to pass `definition`. If telemetry shows confusion later, split into two tools (`form_draft_open_from_published`, `form_draft_save`).
- [Drift risk: reference doc says publishing is a `PUT /form/:formId`, which is the same endpoint as enable] → the tool boundary handles disambiguation (`form_revisions_set` vs `form_draft_publish`). Reference doc edit clarifies which tool to prefer.
- [Form Revisions are gated behind the Security Module / license per [help docs](https://help.form.io/userguide/forms/form-revisions); unlicensed projects will reject calls] → propagate the upstream `402`/`403` through `toMcpError` verbatim so the LLM surfaces a useful message instead of retrying blindly.
- [Exact JSON field names for `note`, `mode`, and the per-revision listing fields (`_vid` vs `vid`, `modified`, `owner`, `note`) are not pinned by the public reference] → confirm during the Red phase by exercising a real revisioned form via `formioFetch` and snapshot-test the response shape. Tool descriptions document only what was confirmed.
- [Single-active-draft constraint means `form_draft_create` silently overwrites] → call this out in the tool description; consider returning the *previous* draft body in the tool response so the agent can recover if it overwrote unintentionally. Defer to implementation; not in scope of this design unless ticket grows.

## Migration Plan

No migration. New tools, additive change. Rollback is `git revert`.

## Open Questions

Pinned against the live `mcp` MongoDB on 2026-05-04 — a freshly created revisioned form, its draft response, and its `formrevisions` doc together yield the following shape, which the implementation can target directly:

- Enable mode is a **single string field** on the form doc: `revisions: "" | "current" | "original"` (empty string = disabled). No sibling display-mode field. The MCP tool's `mode` arg maps 1:1 onto this field.
- The draft endpoint returns the full form definition (same shape as a published form). The wire shape round-trips through the same JSON as published forms, but the storage is in `formrevisions` (NOT a separate `formdrafts` collection and NOT on the form doc itself).
- Drafts live as a **single row in `formrevisions` per form** with `_vid: "draft"` (string sentinel, not a number). Saving a draft upserts that row — there is at most one active draft per form.
- Each numeric `formrevisions` document carries: `_id`, `_rid` (parent form `_id`), `revisionId` (== `_id`), `_vid` (sequential integer), `_vnote` (note, empty string when none provided), `_vuser` (string display name of the publisher, e.g. `"admin"`), `modified` (timestamp), plus the full form snapshot fields (`title`, `components`, `access`, etc.). The `_vid: "draft"` row carries the same fields except `_vid` is the literal string `"draft"`.
- `_vuser` is populated server-side from the JWT — callers do NOT send it.
- Therefore the MCP `note` arg on both `form_draft_create` and `form_draft_publish` maps to wire field **`_vnote`** at the top level of the request body. The listing tool exposes `_vid`/`_vnote`/`_vuser`/`modified` directly without reshaping.

Confirmed via Playwright + MongoDB on 2026-05-04 against a local portal session:

- The publish payload IS `PUT /form/:id` with `_vnote` at the top level of the request body. Submitted body included `_vnote: "<note>"` alongside the full form definition; response returned `_vid` incremented by 1, and the new `formrevisions` doc carried the submitted `_vnote` plus `_vuser` set to the publisher's display name.
- The response body to `PUT /form/:id` strips `_vnote` (not echoed back). Callers should rely on the side-effect of the new revision row, not on the response payload, to confirm the note was persisted.
- The publish request body also carries the *current* `_vid` (the version being published from). Server returns the new `_vid`. MCP tool should preserve whatever `_vid` is on the form/draft body it sends — no special handling needed.
- `_vid` stays at `0` while `revisions` is `""` — non-revisioned forms never bump it (verified against multiple forms in the same project). The counter only advances once revisions are turned on.
- **Enabling revisions on an existing form is a single write — the server seeds the first revision automatically.** A `PUT /form/:id` that flips `revisions` from `""` to `"current"` (or `"original"`) bumps `_vid` from `0` to `1` and inserts one `formrevisions` row at `_vid: 1`, capturing the form state at enable time (with empty `_vnote`, `_vuser` set to the publisher). There is no separate seed call. `form_revisions_set` therefore needs only the GET → merge → PUT it already plans; it must NOT issue any extra seed write.
- A `PUT /form/:id` on a revisioned form creates one new numeric `formrevisions` row **only when the submitted body actually differs from the current published form**. If the body is identical to the current published (ignoring `_vnote`), the server returns 200 with the existing form unchanged — no new revision, no error. This is a safe no-op.
- When `PUT /form/:id` does create a new numeric revision row, it also **removes the existing `_vid: "draft"` row** (verified end-to-end). When `PUT /form/:id` is a no-op (no diff), the draft row survives untouched. So publish auto-clears the draft only when a real revision is created.
- Publish does NOT auto-fetch the saved draft. The body sent in `PUT /form/:id` is what gets published. The portal UI fetches `GET /form/:id/draft` first, then sends that body to `PUT /form/:id`.

Remaining unresolved:

- `form_revisions_set` no-op behavior is now decided: short-circuit when the form already has revisions enabled with the requested `mode`; PUT to switch when the mode differs. Already captured in the spec; nothing left to confirm here.
