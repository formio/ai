## 1. Self-sufficient, staged configuration errors
<!-- depends_on: none -->

### Red

- [x] 1.1 In `packages/mcp-server/src/__tests__/project-resolver.test.ts`, write a failing test: the unset-project error contains a runnable `project set --project-url` command including the searched `--cwd`, and states the three valid URL shapes
- [x] 1.2 Write a failing test: the unset-project error does NOT ask for the base URL in the same message
- [x] 1.3 Write a failing test: the base-URL error contains a runnable `project set --base-url` command, echoes the resolved project URL, says the deployment is a sibling host of the same parent domain, and does not claim the project URL is unset
- [x] 1.4 Write a failing test for the staged sequence: an unmapped directory given a path-less non-`form.io` project URL reports the project-URL error first and the base-URL error only on the next call
- [x] 1.5 Assert on load-bearing tokens only — command name, flag, echoed URL, absence of `api.form.io` — per the design's brittleness note

### Green

- [x] 1.6 Extend the two error builders in `packages/mcp-server/src/project-resolver.ts` with their remedy commands and the shape guidance, keeping the `project_set` tool name alongside the CLI form so both audiences are served by one string
- [x] 1.7 Factor the shape guidance so the `instructions` in `server.ts` and these errors read from one constant rather than two copies

### Refactor

- [x] 1.8 Review implementation and refactor as needed

## 2. Partial updates to an existing mapping
<!-- depends_on: 1 -->

### Red

- [x] 2.1 Write a failing test: `project set --base-url <url> --cwd <mapped path>` with no `--project-url` succeeds, updates only the base URL, and leaves the mapped project URL intact
- [x] 2.2 Write a failing test: the same command against an UNmapped directory fails, naming `--project-url` as required when there is no mapping
- [x] 2.3 Write a failing test: `project set --cwd <path>` with neither URL flag fails, naming both flags
- [x] 2.4 Write a failing test for the `project_set` MCP tool: `baseUrl` alone on a mapped `cwd` succeeds; neither URL fails naming both
- [x] 2.5 Write a failing test asserting the existing no-mapping `--base-url` fallback chain (mapped value, then `FORMIO_BASE_URL`) is unchanged

### Green

- [x] 2.6 Make `--project-url` conditionally optional in `packages/mcp-server/src/cli/project-command.ts` and implement partial-update semantics through the existing `writeProjectEntry` path
- [x] 2.7 Apply the same optionality to the `project_set` tool and its description, so the tool and the command are one behavior

### Refactor

- [x] 2.8 Review implementation and refactor as needed

## 3. project get as the skills' read surface
<!-- depends_on: 1, 2 -->

### Red

- [x] 3.1 Write a failing test: `project get` with nothing configured prints the same self-sufficient unset-project message the tools raise, so a skill can relay it verbatim
- [x] 3.2 Write a failing test: `project get` with a resolved project URL and an unresolved base URL prints the base-URL message, prints the project URL, exits `2`, and says JWT authentication is what is blocked

### Green

- [x] 3.3 Route both CLI failure paths through the shared error builders from group 1 rather than through separate CLI-local strings

### Refactor

- [x] 3.4 Review implementation and refactor as needed

## 4. Skills delegate: the shared preflight probe
<!-- depends_on: none -->

### Red

- [x] 4.1 In `packages/skill-tests/src/skill-descriptions/mcp-setup-skill.test.ts`, extend the `preflight contract` block with a failing test asserting every `SKILL.md` except `formio-mcp-setup`'s instructs running `project get` with the user's working directory before the first deployment-touching call
- [x] 4.2 Write a failing test asserting each such preflight instructs relaying the command's own error and running the `project set` command that error names
- [x] 4.3 Write a failing test asserting each such preflight forbids guessing a base URL, reusing another project's, and editing `~/.formio/projects.json`
- [x] 4.4 Write a failing sweep over every `plugin/skills/**/*.md` asserting NO document carries build-time URL guidance — the three valid URL shapes, a Base-URL derivation table, a `project get` exit-code table, or URL validation rules (scheme, trailing slash, project-equals-base)
- [x] 4.4a Write the companion test that keeps the sweep honest: `Formio.setBaseUrl` / `setProjectUrl` documentation in `formio-sdk`, `formio-form/references/setup.md`, `formio-auth/references/token-swap.md`, and `formio-angular`'s `CONFIG.md` / `AUTH.md` / `formio-angular-resources/references/app-integration.md` is runtime configuration of the generated app and MUST survive, example URL values included — frame the sweep the way `build-time-vs-runtime.test.ts` already frames this boundary
- [x] 4.5 Write a failing test asserting every `project get` invocation in the skills library is version-pinned, per the design's stale-`npx` mitigation
- [x] 4.6 Write a failing test asserting reference-only skills still answer document-only questions without the probe
- [x] 4.6a Write a failing test asserting `formio-resource-planner` keeps the tools preflight and the raw-HTTP prohibition but carries NO probe — it calls no MCP tool by design, and `formio-application` has already probed before invoking it

### Green

- [x] 4.7 Add the probe clause to every tool-calling skill preflight, worded identically so the sweeps hold — that is ten of the twelve `SKILL.md` files under `plugin/skills/`, excluding `formio-mcp-setup` (the handoff target) and `formio-resource-planner` (no tool calls), and INCLUDING the nested `formio-angular/formio-angular-resources/SKILL.md`, which the conformance suite's recursive walk holds to the same contract
- [x] 4.8 Delete the duplicated URL wording the sweep in 4.4 finds, in every file it finds it

### Refactor

- [x] 4.9 Review implementation and refactor as needed

## 5. Delete DEPLOYMENT.md and collapse formio-application to four steps
<!-- depends_on: 4 -->

### Red

- [x] 5.1 Update `packages/skill-tests/src/skill-descriptions/application-orchestration.test.ts`: the `enumerates exactly five steps` assertion (line ~65) becomes four, and add a failing assertion that `SKILL.md` contains no Deployment step
- [x] 5.2 Write a failing test asserting `plugin/skills/formio-application/DEPLOYMENT.md` does not exist, and that no file under `plugin/skills/` links to it
- [x] 5.3 Write a failing test asserting `formio-application`'s preflight runs `project get` after confirming the tools are present, routes a missing-tools result to `formio-mcp-setup` without probing, and stashes the resolved values
- [x] 5.4 Write a failing test asserting `INTENT.md`'s two branches describe no Deployment step and no URL interview, and reference no fifth step
- [x] 5.5 Write a failing test asserting `FRAMEWORK.md` refers to Step 4 / Step 4a rather than Step 5 / Step 5a
- [x] 5.6 Write a failing test asserting `formio-mcp-setup/SKILL.md` runs `project get` before interviewing, asks only for the value the message names, and links to no `DEPLOYMENT.md`
- [x] 5.7 Write a failing test asserting `formio-angular/SETUP.md` obtains the URLs from `project get` — including when `formio-application` handed them in — and carries no exit-code table
- [x] 5.8 Write a failing test asserting `formio-angular/CONFIG.md` sources `appUrl` and `apiUrl` from `project get`, and surfaces a mismatch with an existing `config.ts` instead of skipping the phase

### Green

- [x] 5.9 Delete `plugin/skills/formio-application/DEPLOYMENT.md`
- [x] 5.10 Rewrite `plugin/skills/formio-application/SKILL.md`: preflight gains the configuration probe, the five-steps section becomes four (Intent → Plan → Import → Framework, with Step 3.5 for the auth handoff), the stance bullets and Inputs table drop their Deployment references, and the Links list drops `DEPLOYMENT.md`
- [x] 5.11 Renumber `INTENT.md`'s two downstream-consequence lists to the four-step flow and remove their Deployment entries
- [x] 5.12 Renumber `FRAMEWORK.md`'s Step 5 / Step 5a citations to Step 4 / Step 4a, and `IMPORT.md`'s step references to the four-step flow — including its branch notes, which currently describe the gate as following an MCP-configuration step that no longer exists
- [x] 5.13 Rewrite `formio-mcp-setup/SKILL.md`'s project step as a `project get` probe with an error-driven interview, deleting the restated shape guidance and the `DEPLOYMENT.md` pointer
- [x] 5.14 Update `formio-angular/SETUP.md` and `CONFIG.md` per 5.7 and 5.8, including the config-mismatch branch, and delete SETUP's exit-code table and `DEPLOYMENT.md` pointer

### Refactor

- [x] 5.15 Review implementation and refactor as needed

## 6. Spec sync and repo checks
<!-- depends_on: 1, 2, 3, 4, 5 -->

### Red

- [x] 6.1 Write a failing test asserting `openspec/specs/formio-application-skill/spec.md` contains no requirement mentioning `DEPLOYMENT.md` or `MCP_CONFIG.md`, and that its orchestration requirement describes four steps

### Green

- [x] 6.2 Confirm `guard-unconfigured-project-calls` is archived first — this change's `server-config` delta is written on top of its edits, and applying out of order reverts them
- [x] 6.3 Apply the four delta specs in `openspec/changes/server-owns-project-configuration/specs/` to their counterparts under `openspec/specs/`, including the two REMOVED and two ADDED requirements in the `formio-application-skill` delta
- [x] 6.4 Run `pnpm test`, `pnpm lint`, and `pnpm format`, plus the prose-wrap pass on every edited skill markdown file (`npx prettier --prose-wrap never --ignore-path=/dev/null --write "plugin/skills/**/*.md"`)

### Refactor

- [x] 6.5 Review implementation and refactor as needed
