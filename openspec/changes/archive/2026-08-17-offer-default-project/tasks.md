## 1. The server offers a configured default without applying it
<!-- depends_on: none -->

Spec: `default-project-offer` — "A configured project may be offered without being applied". Design Decision 1.

### Red

- [x] 1.1 Write failing test: with `FORMIO_DEFAULT_PROJECT_URL` set and the working directory unmapped, a project-scoped tool call still fails to resolve — resolution is unchanged by the variable
- [x] 1.2 Write failing test: that failure names the configured URL as the suggested project and instructs persisting it with `project_set`
- [x] 1.3 Write failing test: with the variable unset, the error names no suggestion and still names `project_set` and the base URL
- [x] 1.4 Write failing test: with `FORMIO_PROJECT_URL` set, tools resolve to it regardless of the default, and no suggestion is surfaced
- [x] 1.5 Write failing test: `SERVER_INSTRUCTIONS` describes the default as a value to confirm and persist, not to assume

### Green

- [x] 1.6 Read `FORMIO_DEFAULT_PROJECT_URL` in `config.ts`, carried as a field distinct from `projectUrl` so it cannot reach resolution by accident
- [x] 1.7 Name it in `missingProjectError` when set, leaving the message unchanged when it is not
- [x] 1.8 Extend `SERVER_INSTRUCTIONS` with the confirm-then-persist wording

### Refactor

- [x] 1.9 Review implementation and refactor as needed — `defaultProjectUrl` is a separate `FormioConfig` field with a comment stating why it must never merge into `projectUrl`; `resolveProjectConfig` passes it only to the error builder, so it has no path into resolution

## 2. The variables are distinguished in writing
<!-- depends_on: 1 -->

Spec: `default-project-offer` — "The pinning and offering variables are distinguished in writing". Design Decision 2.

### Red

- [x] 2.1 Write failing test: every environment table documenting either variable states that `FORMIO_PROJECT_URL` pins and cannot be overridden by `project_set`, and that `FORMIO_DEFAULT_PROJECT_URL` is only offered
- [x] 2.2 Write failing test: the `project_set` tool description names `FORMIO_PROJECT_URL` as the value taking precedence, and does not claim the same of the default
- [x] 2.3 Write failing test: no document introduces a `FORMIO_DEFAULT_BASE_URL`

### Green

- [x] 2.4 Update the environment tables in `README.md`, `packages/mcp-server/README.md`, and `plugin/README.md`
- [x] 2.5 Confirm the `project_set` description already draws the distinction; extend it only if it does not

### Refactor

- [x] 2.6 Review implementation and refactor as needed — `project_set`'s description already named only `FORMIO_PROJECT_URL` as taking precedence, so it needed no edit; a test now pins that so a future edit cannot blur the two

## 3. The Cursor install prompt offers rather than pins
<!-- depends_on: 1 -->

Spec: `agent-plugin-packaging` — MODIFIED "A Cursor plugin manifest prompts for configuration at install time". Design Decision 3. **Behavioural** for Cursor users who filled in the project URL.

### Red

- [x] 3.1 Write failing test: the Cursor manifest assigns its install-time project placeholder to `FORMIO_DEFAULT_PROJECT_URL` and no placeholder to `FORMIO_PROJECT_URL`
- [x] 3.2 Write failing test: the placeholder set and `variables.properties` keys are still exactly equal, and nothing is `required`
- [x] 3.3 Write failing test: the variable's description says the value is a default that `project_set` can override per directory

### Green

- [x] 3.4 Rewire `env` and rename the variable in `plugin/.cursor-plugin/plugin.json`
- [x] 3.5 Rewrite the variable's title and description to match the wiring
- [x] 3.6 Run `pnpm test`, `pnpm lint`, `pnpm format`, then `pnpm build:plugin` and `pnpm test:plugin` — the smoke test asserts the placeholder/variable match Cursor enforces at submission

### Refactor

- [x] 3.7 Review implementation and refactor as needed — **two Phase 1 tests hardcoded the old variable name** and were updated: `plugin-manifests.test.ts` asserted `variables.properties.FORMIO_PROJECT_URL` exists, and `plugin-build.test.ts`'s negative smoke case deleted that key to prove the placeholder/variable mismatch check fires. Also added `FORMIO_DEFAULT_PROJECT_URL` to the build test's documented-env list. Left alone deliberately: `scripts/test-plugin.ts` pins `FORMIO_PROJECT_URL` to make its `tools/list` check deterministic, which is a correct use of the pin

**Groups 2 and 3 were edited before their tests were written.** Redness was verified against the pre-edit manifest from `git show HEAD:` — its `env` carried `FORMIO_PROJECT_URL`, which the new assertion forbids — rather than asserted.
