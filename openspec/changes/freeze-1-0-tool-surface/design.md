## Context

`@formio/mcp` registers 21 tools. Measured on `main` with `registerAllTools` and an in-memory client: `tools/list` serializes to 68,551 characters; the `cwd` argument description is 644 characters and appears on 20 tools (~12.9k); `project_set`'s entry alone is 7,294; the server instructions are 5,161.

Verified against the Form.io source (`~/Documents/formio/modules/nirvana`):

- **Path aliases.** `apps/formio/src/middleware/alias.js` rewrites `/{path}/…` to `/form/{id}/…` when the remainder starts with a reserved sub-route. Core reserves `action` but not `v`, `draft` or `actions`; Enterprise (`apps/formio-server/config.js:96-147`) replaces the list and adds `v` and `draft`, but not `actions`. An unknown alias returns **400 "Invalid alias"**. So `/{path}`, `/{path}/action[/{id}]` resolve everywhere, `/{path}/draft` and `/{path}/v[/{vid}]` resolve on Enterprise, and `/{path}/actions[/{name}]` never resolves.
- **Paging.** resourcejs (`packages/resourcejs/Resource.js`) defaults `limit` to 10 with no maximum (607-622), applies `sort` and `select` as given (334-353, 648-649), and reports the total on every index response as `Content-Range: {from}-{to}/{total}` (or `*/{total}` when empty) via `node-paginate-anything`; a `skip` at or past the total returns **416**. `GET /role`, `GET /form/{id}/action` and the form-revision index (`FormRevisionResource.js:66-74`, no default sort) are resourcejs indexes. `GET /form/{id}/actions` is a plain `res.json` array (`actions.js:758`), not paged.
- **Tag filter.** `tags=a,b` compares against the literal string `"a,b"`; `tags__in` is any-of, `tags__all` is all-of (`Resource.js:456-500`).
- **Output schemas.** The SDK wraps each raw output shape in a closed object: every tool publishes `additionalProperties: false` at the top level. With the SDK client, a `form_get` result carrying `_vid` or `pdfComponents` is rejected ("must NOT have additional properties"), and `settings: null` fails server-side validation.
- **Consent.** `form_create` and `form_update` call `gateRevisionsLicense`, which on an unlicensed deployment asks once per deployment (elicitation, or a local browser page from `revisions/browser-prompts.ts`) and persists the answer in `~/.formio/revisions-license-consent.json`; `form_update` then calls `gateRevisionsTracking` (`revisions/tracking.ts`), which asks per form when its stored `revisions` is off.

This change follows `confine-requests-to-project-origin` (PR #88), whose path-argument rule, redirect handling and API-key binding it builds on.

## Goals / Non-Goals

**Goals:**

- One naming rule, one form-addressing rule, one list contract, one error contract, and output schemas that never reject a valid response — frozen as the 1.0 surface.
- No tool call ever waits on an out-of-band prompt.
- `tools/list` at or below 50,000 characters with no rule an agent acts on removed.
- Every skill, README and test that names a changed tool or argument updated in the same change.

**Non-Goals:**

- 401 handling, timeouts, the licence-probe cache, browser launch, logout — `harden-auth-and-errors`.
- Atomic local-state writes, mapping ancestor lookup — `harden-local-state-and-release`.
- Patch semantics for updates: `form_update`, `role_update` and `action_update` stay full replacement (PUT) in 1.0, documented as such.
- Cutting the 1.0.0 version — the plan's release step.

## Decisions

**1. Renames are clean: no aliases.**
`action_types_list` → `action_type_list`, `form_revisions_list` → `form_revision_list`, `hello` → `server_status`. The old names are not registered. CLAUDE.md asks for clean breaks unless compatibility is requested, and the major version is the signal.

**2. `formId` always means an ObjectId; `formIdOrPath` means either.**
The routes decide: a read whose route resolves a path alias (`form_get`, `form_revision_list`, `form_revision_get`) takes `formIdOrPath`; writes and every action tool take `formId`. Action list/get/update/delete would resolve a path through the reserved `action` sub-route, but the catalog (`actions`) does not, and one argument meaning one thing across the seven action tools beats path support on five of them. A path passed as `formId` gets `INVALID_ARGUMENT` naming `form_get` as the way to read the `_id`. On an Open Source deployment `formIdOrPath` with a path fails for `draft` and `v` sub-routes with Form.io's 400, mapped to `NOT_FOUND` with the body — those routes are Enterprise-only anyway.

**3. `form_publish` and `form_revert` reuse `revisions/flows.ts`.**
The flows already exist as `publishDraft` / `revertToVersion`; the tools are thin registrations over them, each with only the arguments it needs. `form_update`'s draft mode changes from "refuse non-allowlisted keys" to "pick the allowlisted keys": `pick(form, DRAFT_FIELDS)`. A draft save carrying none of them is still refused (`INVALID_ARGUMENT`), so an empty draft is never written by accident.

**4. `acceptNoHistory` replaces both prompts; the per-form check stays, without the prompt.**
Removed: `revisions/browser-prompts.ts`, the elicitation paths, the in-memory approved-form set, and the persisted licence-consent file with its read/write helpers. Kept: `checkRevisionsLicensed`, `stripRevisions`, the note prefix, and the per-form read of the stored `revisions` setting (one GET before a standard update), now feeding a refusal instead of a prompt. The refusal message is written for the agent to relay: why the save would carry no history, the two ways forward (`acceptNoHistory: true`, or `form.revisions` on a licensed deployment). Elicitation is not kept even where a client supports it: one path for every client is easier for skills to describe and test, and the chat already is the channel to the user.
*Alternative considered:* elicitation with a refusal fallback — rejected; two behaviours by client capability is what made the prompt path hard to reason about.

**5. Errors: a typed error at the source, one mapper at the edge.**
`formioFetch` throws `FormioApiError { status, url, body }` (body read as text, truncated to 2,000 characters, Form.io's `message` / `name` extracted into the prose when the body is JSON) and `FormioNetworkError { url, cause }` for a request with no response. Resolution errors already have classes (`ProjectNotConfiguredError`, `ProjectMapUnreadableError`, `CommittedConfigUnusableError`, base-URL unresolved); each gains a `code`. `toMcpError` maps every known class to `{ code, status?, body? }` and anything else to `INTERNAL`. The `code` set is the one in the `tool-error-contract` spec; `REDIRECTED` comes from PR #88's redirect refusal.
SDK-level input validation (zod failures before the handler runs) is produced by the SDK as text with no `structuredContent`; it keeps naming the argument (PR #88 made the path messages actionable) but carries no `code`. Wrapping every handler to re-validate would duplicate the SDK's check.

**6. The list contract reads `Content-Range`.**
`formioFetch` gains a `withMeta` option returning `{ data, total }`, parsing `Content-Range` (`a-b/N` or `*/N`). A 416 from a `skip` past the end is answered with `{ items: [], total: N, hasMore: false }` using the `*/N` it carries. Default `limit` is 100: Form.io imposes no maximum, and 100 keeps a typical project's roles, actions and forms in one page without flooding context with full form definitions (`form_list` selects summary fields by default already). The list result's item key stays per tool (`forms`, `roles`, `actions`, `revisions`, `actionTypes`), with `total` and `hasMore` beside it.

**7. Output schemas are passed as open zod objects.**
Each tool's `outputSchema` becomes `z.looseObject(shape)` instead of a raw shape, and documented fields that Form.io stores as Mixed (`settings`, `properties`, `condition`, `owner`, `access`) accept `null`. A test lists every tool and asserts no published schema carries `additionalProperties: false`, and replays recorded Form.io documents (with `_vid`, `pdfComponents`, `controller`, `esign`, `null` settings) through each read and write tool's schema.

**8. Description budget: shorten what repeats, move what explains.**
The `cwd` description drops to ≤200 characters ("The user's working directory, absolute. Selects the Form.io project; see project_set and the server instructions."), because the full resolution rules already live in the server instructions every client receives once and in `project_set`. `project_set` keeps every rule it enforces and drops the rationale paragraphs (to the README). Output-schema field descriptions are trimmed to what a caller branches on. Measured target: ≤50,000 characters for the 22 tools after this change, pinned by a test. Each removal is checked against the skills: no skill relies on description text it now omits (the skills carry their own guidance and call `project_get`).

**9. Boolean env vars: one `readBooleanEnv`.**
`FORMIO_INSECURE_TLS` already accepted `true`/`1`; `FORMIO_FORCE_BROWSER` accepted only `1`. Both use the same function. (`CI` is a third-party convention read with its own rule and is left alone.)

**10. `exports` exposes only `package.json`.**
Nothing imports `@formio/mcp` as a library (`scripts/build-plugin.ts` and `build-mcpb.ts` bundle from `src/stdio.ts`). The `bin` entry is unaffected by `exports`.

**11. `~/.formio/projects.json` keeps its entry format.** *(Confirmed by the maintainer, 2026-10-09.)*
A rename of the `env` block's keys was considered and set aside. It is a machine-local file the server writes, not tool surface, and renaming its keys needs either a reader for the old shape (a compatibility shim CLAUDE.md rules out) or invalidating every user's existing mappings. Its current shape is documented as-is. `formio.json` already ignores unknown keys, so `$schema` works today; no change.

**12. CLI flags and exit codes are documented, not changed.**
`project get [--cwd]`, `project set [--project-url] [--base-url] [--force] [--reset] [--cwd]`; exit 0 OK, 1 not configured, 2 failed, 3 base URL unresolved. The README table becomes the 1.0 reference.

**13. Skills move with the tools.**
The shared preflight paragraph (15 skills, identical text enforced by `shared-prose-stays-identical.test.ts`) lists the writing tools; it gains `form_publish`, `form_revert`, `role_update`, `action_update`, `action_delete`. `formio-actions` names `action_type_list`; `formio-api`'s `project-form-revisions.md` is rewritten for `form_revision_list`, `form_publish`, `form_revert` and `acceptNoHistory` (its consent sections go); every `role_create` example uses the nested `role`. A test asserting that every tool name a skill mentions is registered belongs to `drift-guards`, but a grep-based check for the three old names runs in this change.

**14. This change carries the major changesets.**
`@formio/mcp` and `@formio/ai` get `major` here, because this is the change that breaks the surface; changes landing after it add `minor` / `patch` changesets that fold into the same version when the plan's release step runs `changeset version`.

## Risks / Trade-offs

- [Agents and scripts calling old names fail] → The tool list is read at connect, so a client sees the new names immediately; skills and READMEs ship in the same release; the changeset lists every rename.
- [The extra GET before a standard update] → It existed already (the tracking gate); unchanged cost.
- [An error result's `structuredContent` validated against the tool's `outputSchema`] → The SDK skips it for `isError` results on both sides (verified in `@modelcontextprotocol/sdk` server `mcp.js` and client `index.js`); a test asserts an error result passes through a validating client.
- [Default limit 100 returns large form lists] → `form_list` selects summary fields unless `select` overrides; `limit` is caller-tunable.
- [Trimming descriptions changes tool choice] → Only repetition and rationale are removed; the planner and both resources harnesses are run before and after per the plan's measurement rule.

## Migration Plan

1. Merge PR #88; rebase this branch on `main`.
2. Land the change with major changesets; the release step produces 1.0.0.
3. Rollback is a revert of the merge; no on-disk format changes (the licence-consent file is simply no longer read).

## Open Questions

None outstanding. Resolved 2026-10-09: `projects.json` keeps its format (Decision 11); the default page size is 100 (Decision 6).
