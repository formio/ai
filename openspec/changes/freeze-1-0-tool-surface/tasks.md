## 1. Error contract
<!-- depends_on: none -->

### Red

- [ ] 1.1 Write failing tests for `FormioApiError` / `FormioNetworkError` thrown by `formioFetch`: status, URL, body text truncated to 2,000 characters; Form.io's JSON `message` included in the prose
- [ ] 1.2 Write failing tests for `toMcpError`: each known error class maps to its `code` (`NOT_CONFIGURED`, `BASE_URL_UNRESOLVED`, `CONFIG_UNREADABLE`, `INVALID_ARGUMENT`, `AUTH_REQUIRED`, `FORBIDDEN`, `NOT_FOUND`, `VALIDATION_FAILED`, `REDIRECTED`, `UPSTREAM_ERROR`, `NETWORK_ERROR`, unknown → `INTERNAL`) with `status` / `body` where present
- [ ] 1.3 Write failing tool-level tests: a Form.io 400 on `form_create` yields `VALIDATION_FAILED` with body; `ECONNREFUSED` yields `NETWORK_ERROR` naming the cause and URL; an unconfigured directory yields `NOT_CONFIGURED`; an error result passes through an output-validating client

### Green

- [ ] 1.4 Implement the typed errors in `formio-client.ts` and give the resolution error classes a `code`
- [ ] 1.5 Implement the mapper in `mcp-responses.ts` (`structuredContent: { code, status?, body? }`)

### Refactor

- [ ] 1.6 Review implementation and refactor as needed

## 2. Open output schemas
<!-- depends_on: none -->

### Red

- [ ] 2.1 Write a failing test that lists every tool and asserts no `outputSchema` contains `additionalProperties: false` at any level
- [ ] 2.2 Write failing tests replaying recorded Form.io documents (form with `_vid`, `pdfComponents`, `controller`, `esign`, `settings: null`; revision with `_rid`, `_vnote`, `_vuser`; action with `condition: null`) through `form_get`, `form_revision_get`, `form_update`, `action_get` via a validating client

### Green

- [ ] 2.3 Pass each `outputSchema` as `z.looseObject(...)` and let Mixed fields accept `null` in `output-schemas.ts`

### Refactor

- [ ] 2.4 Review implementation and refactor as needed

## 3. Renames and server_status
<!-- depends_on: 1 -->

### Red

- [ ] 3.1 Write failing tests: the tool list contains `action_type_list`, `form_revision_list`, `server_status`, and not `action_types_list`, `form_revisions_list`, `hello`
- [ ] 3.2 Write failing `server_status` tests: unconfigured → version + `status: "not-configured"` with no Form.io request; configured → version, status, both URLs and sources

### Green

- [ ] 3.3 Rename the two list tools and their files/tests; replace `hello` with `server_status` built on `reportProject`
- [ ] 3.4 Update `capability-quality`, `server-empty-env`, `project-resolution-errors` and `mcpb-build` tests and `scripts/build-mcpb.ts`'s smoke call

### Refactor

- [ ] 3.5 Review implementation and refactor as needed

## 4. List contract
<!-- depends_on: 1, 3 -->

### Red

- [ ] 4.1 Write failing tests for `formioFetch`'s `withMeta` option: parses `Content-Range` `0-9/42` and `*/0`; a 416 with `*/3` returns no items and `total: 3`
- [ ] 4.2 Write failing tool tests for `form_list`, `role_list`, `action_list`, `form_revision_list`: default `limit=100&skip=0` always sent; `total` and `hasMore` returned; no `count`; `sort` / `select` forwarded
- [ ] 4.3 Write failing tests: `form_list` `tags: ["a","b"]` sends `tags__all=a,b`; `form_revision_list` defaults `sort=-_vid` and compact `select`; `action_type_list` returns the whole catalog with `hasMore: false`

### Green

- [ ] 4.4 Implement `withMeta` and the 416 handling in `formio-client.ts`
- [ ] 4.5 Implement the shared list arguments/result (one helper) and apply it to the four paged tools and `action_type_list`; update output schemas

### Refactor

- [ ] 4.6 Review implementation and refactor as needed

## 5. form_publish, form_revert, form_update draft
<!-- depends_on: 1 -->

### Red

- [ ] 5.1 Write failing tests for `form_publish`: publishes the draft's allowlisted fields with the note; `NO_DRAFT` with no PUT when there is no draft; no `form` argument; `LICENSE_REQUIRED` when unlicensed
- [ ] 5.2 Write failing tests for `form_revert`: overlays the revision's allowlisted fields with the note; `NOT_FOUND` for an unknown version; `version` checked by the path-argument rule
- [ ] 5.3 Write failing tests for `form_update`: no `publish` / `revert` / `version` arguments; `draft: true` with `form_get`'s output saves only the allowlisted fields; a draft body with none of them is `INVALID_ARGUMENT`

### Green

- [ ] 5.4 Register `form_publish` and `form_revert` over `revisions/flows.ts`
- [ ] 5.5 Remove publish/revert from `form_update`; change draft mode to pick allowlisted fields

### Refactor

- [ ] 5.6 Review implementation and refactor as needed

## 6. acceptNoHistory
<!-- depends_on: 1, 5 -->

### Red

- [ ] 6.1 Write failing tests: unlicensed `form_create` / `form_update` without `acceptNoHistory` → `HISTORY_NOT_ACCEPTED`, no write; with it → write without `revisions`
- [ ] 6.2 Write failing tests: licensed `form_update` of a form with `revisions` off → `HISTORY_NOT_ACCEPTED`; retry with `form.revisions: "original"` enables and saves; retry with `acceptNoHistory: true` saves without
- [ ] 6.3 Write a failing test that no form write sends an elicitation request or opens a local page, and that `~/.formio/revisions-license-consent.json` is neither read nor written

### Green

- [ ] 6.4 Replace the licence and per-form gates with the `acceptNoHistory` check; delete `revisions/browser-prompts.ts` and the consent persistence and elicitation code
- [ ] 6.5 Remove the tests that covered the deleted prompt paths (`browser-prompts-launch`, the prompt cases in `revisions`, `local-server-edges`, `runnable-remedies`)

### Refactor

- [ ] 6.6 Review implementation and refactor as needed

## 7. Argument shapes: role_create, action formId
<!-- depends_on: 1 -->

### Red

- [ ] 7.1 Write failing tests: `role_create` takes `role: { title, description?, default?, admin? }` and POSTs it; flat `title` is rejected
- [ ] 7.2 Write failing tests: every action tool refuses a non-ObjectId `formId` with a message pointing to `form_get` for the `_id`

### Green

- [ ] 7.3 Change `role_create`'s input to the shared role schema used by `role_update`
- [ ] 7.4 Give every action tool's `formId` the ObjectId schema with the remedy message

### Refactor

- [ ] 7.5 Review implementation and refactor as needed

## 8. Environment booleans and package exports
<!-- depends_on: none -->

### Red

- [ ] 8.1 Write failing tests: `FORMIO_FORCE_BROWSER` and `FORMIO_INSECURE_TLS` read `true`, `TRUE`, ` 1 ` as true and `0`, `false`, `yes`, unset as false
- [ ] 8.2 Write a failing test that `packages/mcp-server/package.json` declares `exports` exposing only `./package.json` and still declares the `formio-mcp` bin

### Green

- [ ] 8.3 Implement `readBooleanEnv` in `config.ts` and use it for both variables
- [ ] 8.4 Add `exports` to `package.json`

### Refactor

- [ ] 8.5 Review implementation and refactor as needed

## 9. Description budget
<!-- depends_on: 3, 4, 5, 6, 7 -->

### Red

- [ ] 9.1 Write a failing test that the serialized `tools/list` is at most 50,000 characters and every `cwd` description is at most 200 characters and names the user's working directory

### Green

- [ ] 9.2 Shorten the `cwd` description; move `project_set`'s rationale to the README keeping every rule it enforces; trim output-schema field descriptions to what a caller branches on
- [ ] 9.3 Confirm the server instructions still carry the full `cwd` and resolution guidance; run the planner and both resources eval harnesses before and after and record that scores did not drop

### Refactor

- [ ] 9.4 Review implementation and refactor as needed

## 10. Skills and docs follow the surface
<!-- depends_on: 3, 4, 5, 6, 7 -->

### Red

- [ ] 10.1 Write a failing skill-tests check that no markdown under `plugin/skills/`, nor the three READMEs, names `action_types_list`, `form_revisions_list`, the `hello` tool, `form_update`'s `publish` / `revert`, flat `role_create` fields, a list `count`, or the revisions consent prompt
- [ ] 10.2 Write a failing check that every copy of the shared preflight paragraph lists `form_publish`, `form_revert`, `role_update`, `action_update` and `action_delete` among the writing tools

### Green

- [ ] 10.3 Update the preflight paragraph in all 15 skills together (`shared-prose-stays-identical.test.ts`), `formio-actions` (`action_type_list`), `formio-api` (`project-form-revisions.md` rewritten for the new tools and `acceptNoHistory`; `project-roles.md`), `formio-auth`, planner and `formio-sdk` references naming `role_create`
- [ ] 10.4 Update the root `README.md`, `packages/mcp-server/README.md` (tool table, CLI flags and exit codes as the 1.0 reference, `project_set` rationale moved in), `plugin/README.md` and `server.json`

### Refactor

- [ ] 10.5 Review implementation and refactor as needed

## 11. Release notes and Definition of Done
<!-- depends_on: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10 -->

### Red

- [ ] 11.1 Confirm `pnpm check:releases` fails until the changeset exists

### Green

- [ ] 11.2 Add a `major` changeset for `@formio/mcp` and `@formio/ai` listing every rename, the new tools, the list and error contracts, `acceptNoHistory`, and the removed consent file
- [ ] 11.3 Run `pnpm test`, `pnpm lint`, `pnpm format`, `pnpm check:releases` and `openspec validate --strict`

### Refactor

- [ ] 11.4 Review implementation and refactor as needed
