## Why

1.0.0 makes the `@formio/mcp` tool surface a contract: after it, a renamed tool, a re-shaped argument, or a tightened output schema is a major release. Today that surface is inconsistent in ways an agent pays for on every call, and some of it is wrong:

- Names mix singular and plural (`form_list` beside `action_types_list`, `form_revisions_list`), and `hello` reports nothing a caller needs.
- `form_update` folds four operations behind flags: publish and revert ignore the `form` body yet require it, and draft refuses fields `form_get` returns.
- Every list tool returns only the first page: `role_list`, `action_list` and `form_revisions_list` send no `limit`, so Form.io's default of 10 truncates them silently, revisions come back oldest first, `count` is the page length, and `form_list`'s multi-tag filter matches nothing.
- Every output schema is closed at the top level, so a spec-compliant client rejects `form_get`'s response whenever Form.io returns a field the schema does not list (`_vid`, `pdfComponents`, `controller`, `esign`, …) — a successful read or write reported as a failure.
- Form writes on a deployment without revisions can stop mid-call for an out-of-band consent prompt (elicitation, or a local browser page when the client has none).
- Errors are prose only, and drop Form.io's response body.
- The tool list costs about 68.5k characters of context; the 644-character `cwd` description alone repeats on 20 tools.

Fixing these after 1.0 would each be a breaking change. Fixing them now is one.

## What Changes

- **BREAKING** — Renames: `action_types_list` → `action_type_list`, `form_revisions_list` → `form_revision_list`, and `hello` → `server_status`, which reports the server version and how the caller's `cwd` resolves (or why it does not) without making a Form.io request.
- **BREAKING** — `form_publish` (`formId`, `note`) and `form_revert` (`formId`, `version`, `note`) are new tools; `form_update` loses its `publish`, `revert` and `version` arguments. `form_update` keeps the full update and `draft: true`; in draft mode it saves the draft fields from the body it is given and ignores the server-owned ones `form_get` returns, instead of refusing them.
- **BREAKING** — Form-addressing arguments follow one rule: `formId` is always a 24-character ObjectId; `formIdOrPath` accepts an ObjectId or a form path. Reads that Form.io serves by path (`form_get`, `form_revision_list`, `form_revision_get`) take `formIdOrPath`; writes and every action tool take `formId` (the action-type catalog route does not accept a path).
- **BREAKING** — `role_create` takes a nested `role` object, like `role_update`.
- **BREAKING** — One list contract for `form_list`, `role_list`, `action_list`, `form_revision_list`: `limit` (default 100), `skip`, `sort`, `select` arguments, and `total` + `hasMore` in the result, read from Form.io's `Content-Range` header. `count` is removed. `form_revision_list` sorts newest first and returns compact metadata. `form_list`'s `tags` matches forms carrying all the given tags. `action_type_list` returns the whole catalog, which Form.io does not page.
- **BREAKING** — The revisions consent prompts (elicitation and the local browser page) are removed. `form_create` and `form_update` take an optional `acceptNoHistory: boolean`; when a write would save without revision history and it is not `true`, the tool refuses with a message the agent relays to the user, and the agent retries with the user's answer. The persisted consent file is removed.
- **BREAKING** — Tool errors keep their prose message and add `structuredContent: { code, status?, body? }`, with `code` from a fixed set and Form.io's response body (truncated) included.
- Output schemas are open at every level: fields Form.io returns beyond the documented ones pass through, and documented fields accept the types Form.io actually stores (including `null`).
- Boolean environment variables share one parser (`true` / `1`, case-insensitive, trimmed): `FORMIO_INSECURE_TLS`, `FORMIO_FORCE_BROWSER`.
- `@formio/mcp`'s `package.json` gains `exports` with no library entry: the package is its `formio-mcp` binary.
- Tool descriptions are trimmed to a measured budget: the `cwd` description is shortened (its full guidance stays in the server instructions and `project_set`), and `project_set`'s description loses its rationale and history, keeping every rule a caller acts on. A test pins the `tools/list` size.
- The CLI's `project get` / `project set` flags and exit codes (0, 1, 2, 3) are documented as part of the 1.0 surface, unchanged.
- Skills, READMEs and tests are updated for every renamed tool and changed argument in the same change.
- Changesets: **major** for `@formio/mcp` and `@formio/ai`.

## Capabilities

### New Capabilities

- `form-publish`: the `form_publish` tool — publish a form's draft as its live version.
- `form-revert`: the `form_revert` tool — restore a prior revision's allowlisted fields onto the live form.
- `server-status`: the `server_status` tool, replacing `hello`.
- `tool-list-contract`: the paging arguments and the `total` / `hasMore` result every list tool shares.
- `tool-error-contract`: the structured error every tool returns, and its `code` set.
- `tool-output-schemas`: output schemas are open, so a valid Form.io response is never reported as a validation failure.
- `tool-description-budget`: the measured size budget for `tools/list` and the rules for what a description keeps.
- `revisions-history-acceptance`: the `acceptNoHistory` argument that replaces the consent prompts.

### Modified Capabilities

- `form-update`: drops the publish/revert flags; draft accepts `form_get`'s output; the tracking gate becomes `acceptNoHistory`.
- `form-create`: the unlicensed path uses `acceptNoHistory` instead of a prompt.
- `form-revisions`: `form_revisions_list` becomes `form_revision_list` (paged, newest first); the license and per-form gates refuse instead of prompting.
- `form-list`: joins the list contract; tag filter matches all tags.
- `role-create`: nested `role` argument.
- `role-list`: joins the list contract.
- `action-crud`: `action_list` joins the list contract; `formId` is an ObjectId on every action tool.
- `action-types-discovery`: `action_types_list` becomes `action_type_list`.
- `project-map-routing`: the scenario that names `hello` names `server_status`.
- `server-config`: one boolean parser for every boolean environment variable; the package publishes no library entry.

## Impact

- Code: `packages/mcp-server/src/tools/*` (renames, new `form_publish` / `form_revert` / `server_status`, list contract, `role_create`), `src/output-schemas.ts`, `src/mcp-responses.ts` and `src/formio-client.ts` (error contract, `Content-Range`), `src/revisions/*` (`browser-prompts.ts` and `tracking.ts` removed; license consent persistence removed), `src/config.ts` and `src/formio-client.ts` (boolean parsing), `src/project-resolver.ts` (`cwd` description), `src/tools/project_set.ts` (description), `src/server.ts` (instructions), `package.json` (`exports`), `scripts/build-mcpb.ts` (smoke call to `hello`).
- Skills: the shared preflight paragraph in 15 skills (names the writing tools), `formio-actions` (`action_types_list`), `formio-api` references (`form_revisions_list`, publish/revert, consent sections, `role_create`), `formio-auth` and planner references naming `role_create`, `formio-sdk` roles reference. `shared-prose-stays-identical.test.ts` requires every copy of the preflight paragraph to change together.
- Docs: root `README.md`, `packages/mcp-server/README.md`, `plugin/README.md`, `server.json`.
- Clients: any agent or script calling the renamed tools, `form_update`'s `publish` / `revert`, `role_create`'s flat fields, or reading `count` must move to the new surface. `~/.formio/revisions-license-consent.json` is no longer read.
- Release: ships with a major changeset for both packages; the 1.0.0 version is cut by the release step of the plan.
