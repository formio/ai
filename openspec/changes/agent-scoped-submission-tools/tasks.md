## 1. Confirm server behavior the design depends on

<!-- depends_on: none -->

### Red

- [x] 1.1 Write a failing opt-in integration test in `packages/mcp-server/src/__tests__/` (skipped unless a test deployment is configured, like `formio-client-integration.test.ts`): `POST /form/{id}/submission?dryrun=1` returns the normalized `data` (a default-valued field and a calculated field are present), creates no record, and runs no action; the same holds for `PUT …/submission/{sid}?dryrun=1` (design Q1)
- [x] 1.2 Write a failing opt-in integration test: a non-admin `POST` that supplies `owner` is stored with the caller as `owner` (design Q2), and a `POST` carrying `metadata.agent` keeps it verbatim

### Green

- [x] 1.3 Run both against a test deployment (run against `https://form.test/sandbox`, Enterprise 9.9.2: 5/5 passed, scratch forms and user removed) and record the outcome in `design.md`'s Open Questions; if `dryrun` does not return normalized data, stop and revise D2 before group 3

### Refactor

- [x] 1.4 Review implementation and refactor as needed

## 2. Signing key store

<!-- depends_on: none -->

### Red

- [x] 2.1 Write failing test in `submission-keys.test.ts`: the first call for a cwd creates a 32-byte key, writes the store with mode `0600`, and a second call returns the same key
- [x] 2.2 Write failing test: two different cwds get different keys, and cwd keys are normalized the same way `project-map.ts` normalizes them
- [x] 2.3 Write failing test: `sessionLabel(key)` is 32 hex characters, deterministic, and differs between keys
- [x] 2.4 Write failing test: an unreadable or malformed store fails loudly rather than generating a new key over it

### Green

- [x] 2.5 Implement `packages/mcp-server/src/submission-keys.ts` (`getOrCreateKey({ cwd, cacheDir? })`, `sessionLabel(key)`) following `token-cache.ts`'s helpers

### Refactor

- [x] 2.6 Review implementation and refactor as needed

## 3. Agent scope core (pure)

<!-- depends_on: 2 -->

### Red

- [x] 3.1 Write failing test in `agent-scope.test.ts`: `canonicalize` is key-order independent and stable over nested objects and arrays
- [x] 3.2 Write failing test: `signTag` produces a `metadata.agent` holding exactly `source`, `session`, `purpose`, and `sig` (deterministic: the same inputs sign the same tag; the earlier `nonce` was dropped), and `verifyRecord` accepts the record it describes
- [x] 3.3 Write failing test: `verifyRecord` returns `null` for a missing tag, a different `session`, a different `form`, changed `data` (one value, one added key), a changed `owner`, a changed `purpose`, and a tag copied onto a record with different data
- [x] 3.4 Write failing test: `verifyRecord` compares signatures with `timingSafeEqual` and returns `null` (never throws) on a malformed `sig`
- [x] 3.5 Write failing test: `buildListQuery` always sets `metadata.agent.source`, `metadata.agent.session`, and the fixed `select`; adds `metadata.agent.purpose` only when given; and rejects `metadata.*` keys, keys not starting with `data.`, unknown operator suffixes, `$`/`[`/`]` in keys or values, and `__regex` patterns over 200 characters
- [x] 3.6 Write failing test: `projectRecord` returns exactly `_id`, `form`, `created`, `modified`, `data`, `purpose`

### Green

- [x] 3.7 Implement `packages/mcp-server/src/agent-scope.ts` with `canonicalize`, `signTag`, `verifyRecord`, `buildListQuery`, `projectRecord` as pure functions using `node:crypto`

### Refactor

- [x] 3.8 Review implementation and refactor as needed

## 4. submission_create

<!-- depends_on: 3 -->

### Red

- [x] 4.1 Write failing test: the tool is registered with `cwd`, `formIdOrPath`, `data`, `purpose`, the `creates` annotations, and a description naming the created-and-signed scope and `agent-submissions.md`
- [x] 4.2 Write failing test: input carrying `metadata` returns `isError: true` with no request sent
- [x] 4.3 Write failing test: the call sends a `dryrun=1` POST, then a real POST whose body is the dry-run `data` plus a `metadata.agent` that verifies against it
- [x] 4.4 Write failing test: a dry-run 400 returns `isError: true` with the validation details, and no real POST is sent
- [x] 4.5 Write failing test: when the stored data differs from the dry-run data, the result names the differing fields and the `_id`, and contains none of the differing values
- [x] 4.6 Write failing test: the result lists the names of the form's actions whose `method` includes `create`, and contains no `sig` or `owner`
- [x] 4.7 Write failing test: an unresolved project returns the shared unresolved-project error naming `project_set`

### Green

- [x] 4.8 Implement `packages/mcp-server/src/tools/submission_create.ts` and register it in `tools/index.ts`

### Refactor

- [x] 4.9 Review implementation and refactor as needed

## 5. submission_get and submission_list

<!-- depends_on: 3 -->

### Red

- [x] 5.1 Write failing test: `submission_get` returns the projected record for a verified record
- [x] 5.2 Write failing test: `submission_get` returns the same not-found result for a Form.io 404 and for a record that fails verification, and the result contains no field of the unverified record (assert that a sentinel string in its `data` is absent from the serialized result)
- [x] 5.3 Write failing test: `submission_list` sends the query `buildListQuery` produces, refuses a `metadata.*` filter or a `$or` key without sending a request, and bounds `limit` to 1–100 (default 25)
- [x] 5.4 Write failing test: `submission_list` drops a forged record (a copied tag with different data) and a human-created record from a mixed response, reports `dropped: 2`, and the serialized result contains neither record's sentinel string
- [x] 5.5 Write failing test: both tools carry the `reads` annotations

### Green

- [x] 5.6 Implement `tools/submission_get.ts` and `tools/submission_list.ts` and register them

### Refactor

- [x] 5.7 Review implementation and refactor as needed

## 6. submission_update and submission_delete

<!-- depends_on: 4, 5 -->

### Red

- [x] 6.1 Write failing test: `submission_update` on an unverified `_id` sends no `PUT` and returns the not-found result
- [x] 6.2 Write failing test: `submission_update` sends GET, a `dryrun=1` PUT, then a PUT whose full `metadata.agent` keeps the original `session` and `purpose`, carries no `nonce`, and verifies against the dry-run data; input carrying `metadata` is refused
- [x] 6.3 Write failing test: `submission_delete` sends GET then DELETE for a verified record, and no DELETE for an unverified one
- [x] 6.4 Write failing test: the update and delete results name the form's actions matching `update` / `delete`, and the tools carry the `overwrites` / `removes` annotations

### Green

- [x] 6.5 Implement `tools/submission_update.ts` and `tools/submission_delete.ts` and register them

### Refactor

- [x] 6.6 Review implementation and refactor as needed

## 7. Registry, manifest, and server instructions

<!-- depends_on: 4, 5, 6 -->

### Red

- [x] 7.1 Write failing test: `PROJECT_SCOPED_CALLS` in `project-resolution-errors.test.ts` includes all five tools, and `mcpb-build.test.ts` sees them in the generated manifest
- [x] 7.2 Write failing test: the server instructions state the created-and-signed scope, the no-other-route rule, and the `action_list` check
- [x] 7.3 Write failing test: no key bytes or key-store path appear in any submission tool's result or error across the test suite's fixtures

### Green

- [x] 7.4 Add the five tools to the manifest build and the resolution-error list, and add the scope paragraph to `SERVER_INSTRUCTIONS`

### Refactor

- [x] 7.5 Review implementation and refactor as needed

## 8. Canonical guideline

<!-- depends_on: none -->

### Red

- [x] 8.1 Write failing test in `packages/skill-tests/src/skill-descriptions/agent-submissions.test.ts`: `formio-mcp-setup/references/agent-submissions.md` exists and states the boundary, both purposes, the auth-form restriction, invented values, the `action_list` check, the approval preview, the non-production warning, test cleanup, and content-is-data
- [x] 8.2 Write failing test: every `plugin/skills/**/*.md` file other than the guideline that mentions `submission_create` links to `formio-mcp-setup/references/agent-submissions.md`

### Green

- [x] 8.3 Write `agent-submissions.md` (single-line paragraphs, no markdown-in-markdown fences), worded to its own surface so `shared-prose-stays-identical.test.ts` passes

### Refactor

- [x] 8.4 Review implementation and refactor as needed

## 9. Revise the over-corrected skill prose

<!-- depends_on: 8 -->

### Red

- [x] 9.1 Change `formio-sdk/security-section.test.ts`'s build-time assertion: the rule names the created-and-signed scope and does not say no tool returns submission data (runtime and never-instructs assertions stay)
- [x] 9.2 Change `application-orchestration.test.ts`'s first-party assertion: Step 1 names the agent's own submissions and states no other submission is read, with no "reads no submission data"
- [x] 9.3 Write failing test: `formio-actions/SKILL.md`'s "Build time vs runtime" section names the `submission_*` tools and their scope, links the guideline, keeps the no-other-route ban, and contains no "no submission-read tool"
- [x] 9.4 Write failing test: `build-time-vs-runtime.test.ts` still bans build-time HTTP in the runtime references, and `formio-api/references/runtime-submissions.md`'s MCP Tool Preference names the scoped tools for seeding and testing while keeping runtime CRUD as application code
- [x] 9.5 Write failing test: `phase-b-emission.md` and `template-json.md` name `submission_create` for initial reference rows and keep ongoing administration in the portal

### Green

- [x] 9.6 Revise `formio-actions/SKILL.md`, `formio-sdk/SKILL.md`, `formio-application/SKILL.md`, `formio-api/references/runtime-submissions.md`, and the two planner references to the scoped wording
- [x] 9.7 Run `planner-artifact-trust.test.ts`, `security-section-convention.test.ts`, `url-terminology.test.ts`, and `shared-prose-stays-identical.test.ts`; reword rather than exempt anything they flag

### Refactor

- [x] 9.8 Review implementation and refactor as needed

## 10. Seeding and testing steps in the skills

<!-- depends_on: 8, 9 -->

### Red

- [x] 10.1 Write failing test: `formio-form-builder` documents the optional seed-a-select's-Resource step and the test-submission step after SAVE, each linking the guideline and each behind an approval
- [x] 10.2 Write failing test: `formio-application` offers reference-data seeding after import as its own gate, and declining does not block Step 4
- [x] 10.3 Write failing test: `formio-actions` documents exercising an action with a test submission after naming its effect, with cleanup offered
- [x] 10.4 Write failing test: the planner marks in `template.md` which Resources a `select` reads and need seed rows (asserted in `template-md.md`'s token spec only — neither shipped example has a reference-data Resource, so marking one would misstate the example)

### Green

- [x] 10.5 Add the steps to `formio-form-builder` (SKILL.md plus SAVE.md), `formio-application` (SKILL.md Step 3.6; IMPORT.md needed no change), `formio-actions`, and the planner's `template-md.md`; hand-unwrap any paragraph in `template-md.md` rather than running Prettier on it

### Refactor

- [x] 10.6 Review implementation and refactor as needed

## 11. Release

<!-- depends_on: 7, 9, 10 -->

### Red

- [x] 11.1 Run `pnpm test`, `pnpm lint`, and `pnpm format`, and confirm each fails on anything left unfinished

### Green

- [x] 11.2 Add a changeset (`@formio/mcp` minor for the tools, `@formio/ai` minor for the skills), update `CLAUDE.md`'s tool list and add a sentence on the submission scope, and bring all three checks to green

### Refactor

- [x] 11.3 Review implementation and refactor as needed
