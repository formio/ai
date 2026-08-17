## 1. Client-neutral configuration
<!-- depends_on: none -->

### Red

- [x] 1.1 Write failing test: `getConfig()` returns `baseUrl` of `https://api.form.io` when `FORMIO_BASE_URL` is unset, both with and without `FORMIO_PLUGIN_CONTEXT=1` set
- [x] 1.2 Write failing test: `getConfig()` returns `projectUrl` from the environment even when `FORMIO_PLUGIN_CONTEXT=1` is set, and `undefined` when unset, without throwing
- [x] 1.3 Write failing test: trailing slashes are stripped from both `baseUrl` and `projectUrl`, and `FORMIO_FORCE_BROWSER` is surfaced on the config object
- [x] 1.4 Write failing test: `createServer()` succeeds with an entirely empty `FORMIO_*` environment and registers every tool

### Green

- [x] 1.5 Remove the `pluginContext` branch from `src/config.ts`: always default `baseUrl`, always read `projectUrl` from env, add `forceBrowser`
- [x] 1.6 Confirm `createServer()` needs no change to satisfy 1.4; adjust only if a test proves otherwise

### Refactor

- [x] 1.7 Review implementation and refactor as needed

## 2. Project resolution precedence and actionable errors
<!-- depends_on: 1 -->

### Red

- [x] 2.1 Write failing test: environment `FORMIO_PROJECT_URL` wins over a project-map entry for the same `cwd`
- [x] 2.2 Write failing test: with no environment project URL, the map entry for `cwd` resolves the project, and a mapped `FORMIO_BASE_URL` overrides the configured base URL
- [x] 2.3 Write failing test: unmapped `cwd` with no environment project URL throws an error containing `project_set`, `FORMIO_PROJECT_URL`, and the searched `cwd`
- [x] 2.4 Write failing test: no `cwd` and no environment project URL throws an error containing `project_set` and `FORMIO_PROJECT_URL`
- [x] 2.5 Write failing test: `cwdSchema` accepts an absolute path, accepts omission, and rejects a relative path — with `FORMIO_PLUGIN_CONTEXT` set and unset
- [x] 2.6 Write failing test (integration): each project-scoped tool (`form_*`, `role_*`, `action_*`, `project_export`, `project_import`) returns the resolution error rather than an HTTP failure when nothing resolves, and `hello` still succeeds

### Green

- [x] 2.7 Rewrite `resolveProjectConfig` in `src/project-resolver.ts` to the env → map → error precedence, dropping `isPluginContext`
- [x] 2.8 Replace `buildCwdSchema()` with a single optional-absolute schema and one description naming `project_set` and `FORMIO_PROJECT_URL`
- [x] 2.9 Route any tool that resolves a project outside `resolveProjectConfig` (if any) through it, so 2.6 passes for every tool

### Refactor

- [x] 2.10 Review implementation and refactor as needed

## 3. Unconditional project_set registration
<!-- depends_on: 2 -->

### Red

- [x] 3.1 Write failing test: `tools/list` includes `project_set` when the server is started with an empty environment
- [x] 3.2 Write failing test: `project_set` writes `~/.formio/projects.json` with mode `0600`, and a subsequent project-scoped call with that `cwd` resolves to the written project when `FORMIO_PROJECT_URL` is unset
- [x] 3.3 Write failing test: `project_set`'s description states that an environment `FORMIO_PROJECT_URL` takes precedence over the map

### Green

- [x] 3.4 Register `project_set` unconditionally in `src/tools/index.ts`, removing the `FORMIO_PLUGIN_CONTEXT` guard and its rationale comment
- [x] 3.5 Update the `project_set` tool description for the precedence note

### Refactor

- [x] 3.6 Review implementation and refactor as needed

## 4. Browserless detection in the login flow
<!-- depends_on: 1 -->

### Red

- [x] 4.1 Write failing test: `CI=true` with no API key throws before any port is bound or browser launched, with an error naming `FORMIO_API_KEY`
- [x] 4.2 Write failing test: a host with neither `DISPLAY` nor `WAYLAND_DISPLAY` and no other signal is NOT browserless — the login server starts and prints its URL
- [x] 4.3 Write failing test: `SSH_CONNECTION` set with no display throws; container detection (`/.dockerenv`) throws with an error naming `FORMIO_AUTH_HOST` / `FORMIO_AUTH_PORT`
- [x] 4.4 Write failing test: `FORMIO_FORCE_BROWSER=1` suppresses the check even with `CI=true`; `darwin` with a clean environment does not trip it
- [x] 4.5 Write failing test: API-key mode with `CI=true` authenticates without raising the browserless error
- [x] 4.6 Write failing test: the browserless error reaches the caller as a tool error with the server still connected

### Green

- [x] 4.7 Add a browserless predicate to `src/auth.ts` (or a small sibling module) and call it before `app.listen`, throwing the ordered guidance message
- [x] 4.8 Keep the existing launch-failure path intact — a failed `open`/`xdg-open` still leaves the server listening with a manually openable URL

### Refactor

- [x] 4.9 Review implementation and refactor as needed

## 5. Sub-skill rename and description trim
<!-- depends_on: none -->

### Red

- [x] 5.1 Write failing test: `plugin/skills/formio-angular/formio-angular-resources/SKILL.md` exists, its `name` equals its directory name, and `plugin/skills/formio-angular/resources/` does not exist
- [x] 5.2 Write failing test: the sub-skill's whitespace-normalized `description` is ≤ 1,024 characters and still contains its required Angular-explicit trigger phrases and `Not for:` clause
- [x] 5.3 Write failing test: no file in the repository (excluding `openspec/changes/`) contains the literal `formio-angular/resources/`
- [x] 5.4 Write failing test: the sub-skill body documents the four supported feature shapes and the two-phase cadence trimmed out of the description

### Green

- [x] 5.5 `git mv plugin/skills/formio-angular/resources plugin/skills/formio-angular/formio-angular-resources`, then update every relative link in `formio-angular/{SKILL,BOOTSTRAP,AUTH,SETUP,CONFIG}.md`, the sub-skill's `references/*.md`, and its `evals/{README.md,grade.py,evals.json}`
- [x] 5.6 Trim the description to ≤ 1,024 characters, moving the feature-shape enumeration and cadence narration into the body
- [x] 5.7 Update path references in `CLAUDE.md`, `README.md`, `plugin/README.md`, and `plugin/skills/formio-resource-planner/evals/README.md`

### Refactor

- [x] 5.8 Review implementation and refactor as needed

## 6. Agent Skills conformance suite
<!-- depends_on: 5 -->

### Red

- [x] 6.1 Write failing test: the enumeration helper's recursive scope includes every top-level skill plus `formio-angular/formio-angular-resources/SKILL.md`
- [x] 6.2 Write failing test: every discovered `SKILL.md` has a spec-legal `name` (1–64 chars, `a-z0-9-`, no leading/trailing/consecutive hyphens) that equals its directory name
- [x] 6.3 Write failing test: every discovered `SKILL.md` has a non-empty `description` of ≤ 1,024 normalized characters
- [x] 6.4 Write failing test: every frontmatter key is in `{name, description, license, compatibility, metadata, allowed-tools}`, with the failure message naming file and offending key
- [x] 6.5 Write failing test (fixture-driven): a synthetic skill with a mismatched directory name, a bad charset, an over-budget description, and an unknown key each fail with the expected message

### Green

- [x] 6.6 Add the recursive scope to `packages/skill-tests/src/skill-descriptions/helpers.ts` alongside the existing top-level scope
- [x] 6.7 Add the conformance suite under `packages/skill-tests/src/` using that helper, with no new dependency or external binary
- [x] 6.8 Point the existing description-budget assertion at the recursive scope, keeping the routing/collision guards on the top-level scope

### Refactor

- [x] 6.9 Review implementation and refactor as needed

## 7. Plugin packaging, docs, and release
<!-- depends_on: 3, 4, 6 -->

### Red

- [x] 7.1 Write failing test: the built plugin manifest's MCP env block contains no `FORMIO_PLUGIN_CONTEXT` key (extend `scripts/test-plugin.ts`)
- [x] 7.2 Write failing test: the built plugin's skills tree contains `formio-angular/formio-angular-resources/SKILL.md`
- [x] 7.3 Write failing test: the built plugin's server bundle answers `tools/list` including `project_set` with an empty environment

### Green

- [x] 7.4 Remove `FORMIO_PLUGIN_CONTEXT` from `plugin/.claude-plugin/plugin.json`; update the stale flag rationale in `plugin/hooks/verify-project-url.mjs`
- [x] 7.5 Update the README environment-variable table (drop `FORMIO_PLUGIN_CONTEXT`, add `FORMIO_FORCE_BROWSER`, restate the `project_set` row as available to every client) and the same content in `packages/mcp-server/README.md`
- [x] 7.6 Record the precedence decision (D1) — G10 and the Phase 0 status, in the initiative notes (since untracked; see `prune-shipped-surface`) in place of the `FORMIO_PROJECT_MAP` flag
- [x] 7.7 Add a changeset calling out the removed environment variable and the new browserless behavior

### Refactor

- [x] 7.8 Review implementation and refactor as needed

## 8. Eval regression check
<!-- depends_on: 5 -->

### Red

- [x] 8.1 Capture a pre-change baseline: run the `formio-angular-resources` eval suite per its `evals/README.md` and record the grading output

### Green

- [x] 8.2 Re-run the same suite after the rename and description trim; confirm activation and grading are no worse than baseline, and record both runs in the change notes

### Refactor

- [x] 8.3 Review implementation and refactor as needed
