## 1. Eval baseline
<!-- depends_on: none -->

Run before any prose edit — the harnesses have no absolute pass bar, only relative structural scores, so a post-only run proves nothing (design Decision 9).

**Deviation, agreed during apply:** task 1.2 found **zero** coupling between either harness and this change's surface, so the fresh baseline was deferred and tasks 1.3–1.5 are folded into group 8 as a single post-rewrite pass compared against the artifacts already on disk (`.eval-artifacts/formio-resource-planner/iteration-2`, `.eval-artifacts/formio-angular-resources/iteration-before`). This halves the subagent cost. The comparison is weaker: those artifacts were produced at an unrecorded commit.

### Red

- [x] 1.1 Read `plugin/skills/formio-resource-planner/evals/README.md` and `plugin/skills/formio-angular/formio-angular-resources/evals/README.md` end to end; record each harness's seed steps, iteration-directory convention, and grading command without improvising
- [x] 1.2 Grep both `evals/evals.json` files and every fixture for assertions on the current step numbering (`Step 4`, `Step 5`, `Step 6`, `Step 6a`, `Step 5.5`), on `frontendDesignStatus`, and on `.mcp.json`; record each hit as a fixture that must be updated in group 5 — **zero hits**; both graders assert artifact structure only (`template.md` headings, `template.json` keys, Angular routing shape), so no fixture needs updating and task 5.9 is a verify-only step

### Green

- [x] 1.3 ~~Run the `formio-resource-planner` harness at the current HEAD~~ — deferred to group 8 per the deviation above
- [x] 1.4 ~~Run the `formio-angular-resources` harness at the current HEAD~~ — deferred to group 8 per the deviation above
- [x] 1.5 Record the comparison points for group 8: `.eval-artifacts/formio-resource-planner/iteration-2` and `.eval-artifacts/formio-angular-resources/iteration-before`, with `without_skill/` baselines carried forward from them per both READMEs

### Refactor

- [x] 1.6 Review implementation and refactor as needed

## 2. Delete the MCP Config step
<!-- depends_on: 1 -->

Spec: `formio-application-skill` — REMOVED "New sibling doc MCP_CONFIG.md", REMOVED "Step 3 writes .mcp.json with captured URLs", ADDED "formio-application runs a five-step orchestration".

### Red

- [x] 2.1 Write failing test: no live skill document under `plugin/skills/` (exempting `formio-mcp-setup/SKILL.md` and any `evals/` path) contains `.mcp.json`, `.cursor/mcp.json`, `.vscode/mcp.json`, or `.codex/config.toml`
- [x] 2.2 Write failing test: `plugin/skills/formio-application/MCP_CONFIG.md` does not exist, and no document in the library links to it
- [x] 2.3 Write failing test: `formio-application/SKILL.md` enumerates exactly five steps — Intent, Plan, Deployment, Import, Framework routing — and links only `INTENT.md`, `DEPLOYMENT.md`, `IMPORT.md`, `FRAMEWORK.md`
- [x] 2.4 Write failing test: no live skill document instructs halting, restarting, or reloading for MCP configuration to take effect (`restart Claude Code`, `/reload-plugins`, `restart boundary`)
- [x] 2.5 Write failing test: `formio-application/SKILL.md` routes a failed tool probe to `formio-mcp-setup` and states it writes no MCP configuration itself

### Green

- [x] 2.6 Delete `plugin/skills/formio-application/MCP_CONFIG.md`
- [x] 2.7 Remove the Step 4 section, the "Expect one restart boundary on build-new" bullet, and the `MCP_CONFIG.md` row from `formio-application/SKILL.md`; state that Deployment and Import run in the same invocation because `project_set` is read at tool-call time
- [x] 2.8 Remove every `MCP_CONFIG.md` cross-reference and restart-boundary sentence from `formio-application/{DEPLOYMENT,IMPORT,INTENT,FRAMEWORK}.md`
- [x] 2.9 Add the missing-tools branch to `formio-application/SKILL.md`: route to `formio-mcp-setup`, write nothing, do not claim the request is finished

### Refactor

- [x] 2.10 Review implementation and refactor as needed

## 3. Renumber the orchestration steps
<!-- depends_on: 2 -->

Design Decision 2 — Import 5 → 4 (4.5 for the auth handoff), Framework routing 6 → 5 (5a for the design pre-check). About fifty references move.

### Red

- [x] 3.1 Write failing test: no live skill document references `Step 6`, `Step 6a`, `Step 5.5`, or `Step 5 (Import)`
- [x] 3.2 Write failing test: `formio-application/IMPORT.md` identifies itself as Step 4 and `FRAMEWORK.md` as Step 5 with a Step 5a pre-check

### Green

- [x] 3.3 Renumber every step reference in `formio-application/{SKILL,INTENT,DEPLOYMENT,IMPORT,FRAMEWORK}.md`
- [x] 3.4 Renumber the `formio-application` step references in `formio-angular/{SKILL,AUTH,BOOTSTRAP}.md`
- [x] 3.5 Grep the whole library for surviving old-numbering phrasings and fix the stragglers — note: `BOOTSTRAP.md` keeps its own independent phase numbering, so the renumber and its test are scoped to the orchestrator's documents plus explicit `formio-application Step N` cross-references

### Refactor

- [x] 3.6 Review implementation and refactor as needed

## 4. Portable capability probe and question mechanism
<!-- depends_on: 2 -->

Spec: `agent-neutral-skill-prose` — "Tool availability is determined by a capability probe", "Structured questions are described portably and stay batched"; `formio-application-skill` — MODIFIED DEPLOYMENT.md and FRAMEWORK.md, ADDED "INTENT.md captures build-vs-modify in one question round"; `formio-form-builder-skill` — MODIFIED INTENT requirement.

### Red

- [x] 4.1 Write failing test: no live skill document contains `mcp__plugin_`, and none branches on how the server was installed (no "plugin mode", no `verify-project-url` hook reference)
- [x] 4.2 Write failing test: every live document that mentions a client question tool does so as a parenthetical example — the tool name never appears without portable instruction wording ("question round", "structured question mechanism") in the same paragraph
- [x] 4.3 Write failing test: `formio-application/DEPLOYMENT.md` still asks for both URLs in one round and still names `FORMIO_PROJECT_URL` and `FORMIO_BASE_URL`
- [x] 4.4 Write failing test: `formio-application/INTENT.md` still offers exactly the two options "Build a new app" and "Modify / extend an existing app" and documents the skip-Steps-3-and-4 branch
- [x] 4.5 Write failing test: `formio-form-builder/INTENT.md` still scripts one round capturing both form type and embed intent
- [x] 4.6 Write failing test: `formio-application/FRAMEWORK.md` asks the multi-framework pick in one round without naming a client tool as the mechanism

### Green

- [x] 4.7 Replace plugin-mode namespace sniffing in `formio-application/SKILL.md` with the capability probe wording used by `formio-mcp-setup` Step 1
- [x] 4.8 Apply the portable question phrasing across `formio-application/{SKILL,DEPLOYMENT,FRAMEWORK,INTENT}.md`, preserving every explicit option set and every batching sentence
- [x] 4.9 Apply it across `formio-angular/{SKILL,SETUP,AUTH}.md` and `formio-angular/formio-angular-resources/{SKILL.md,references/interview-guide.md}`
- [x] 4.10 Apply it across `formio-form-builder/{SKILL,INTENT,SAVE}.md` and `formio-resource-planner/SKILL.md`
- [x] 4.11 Replace every reliance on a client's built-in "Other" affordance with "allow a free-text answer alongside the fixed options"

### Refactor

- [x] 4.12 Review implementation and refactor as needed

## 5. Portable frontend-design dependency and installer target
<!-- depends_on: 2 -->

Spec: `agent-neutral-skill-prose` — "A portable third-party skill is named, and only its distribution wording is neutralized", "Skill-installer invocations take the agent from the detected client". Design Decision 5.

**Corrected after review:** this group first genericized `frontend-design` out of the prose entirely (a silent probe, `designSkillStatus: 'available' | 'inline-brief'`, no install offer). That was over-correction — `frontend-design` is a portable Agent Skill with spec-conformant frontmatter and a client-agnostic body, shipping at <https://github.com/anthropics/claude-plugins-public/tree/main/plugins/frontend-design>. The name, the install offer, `frontendDesignStatus: 'available' | 'declined'`, and `FRONTEND_DESIGN_BRIEF` are all restored; only the single-form detection and the `/plugin` / `claude plugin install` / `/reload-plugins` commands stay out.

### Red

- [x] 5.1 Write failing test: no live skill document contains `claude plugin install`, `claude-plugins-official`, or `/reload-plugins`, and the install offer names where `frontend-design` ships instead
- [x] 5.2 Write failing test: the handoff names `frontendDesignStatus` with values `available` and `declined` on both sides of the contract, and no document carries the interim `designSkillStatus` name
- [x] 5.3 Write failing test: `formio-application/FRAMEWORK.md` Step 5a detects `frontend-design` by name accepting more than one registered form, offers the install portably, and specifies the inline Bootstrap 5 brief fallback plus the per-approval-gate disclosure
- [x] 5.4 Write failing test: no `skills add` invocation in the library passes a literal `-a claude-code`, and `BOOTSTRAP.md` documents `.agents/skills/` as the default target
- [x] 5.5 Write failing test: the never-emit-unstyled-UI guarantee survives — `FRAMEWORK.md` and `formio-angular/BOOTSTRAP.md` both state that unstyled output is never emitted silently

### Green

- [x] 5.6 Rewrite the Step 5a pre-check in `formio-application/{SKILL,FRAMEWORK}.md` to detect `frontend-design` by skill rather than by one client's prefix and to offer the install portably, keeping `frontendDesignStatus: 'available' | 'declined'`
- [x] 5.7 Update the consumer side in `formio-angular/{SKILL,BOOTSTRAP,AUTH}.md` and `formio-angular/formio-angular-resources/{SKILL.md,references/phase-a-plan-template.md}`: keep `frontendDesignStatus` and `FRONTEND_DESIGN_BRIEF`, match the skill under any registered form, and apply the Step 7d brief inline on `declined`
- [x] 5.8 Change the `skills add` invocation in `formio-angular/BOOTSTRAP.md` to take `-a` from the detected client, defaulting to `.agents/skills/`
- [x] 5.9 Update the fixtures and `expected_output` entries recorded in task 1.2 so both harnesses assert the new numbering and variable name — **nothing to update**: task 1.2 found zero coupling. What did need updating was `packages/skill-tests/src/skill-descriptions/fixtures/descriptions-before-preflight.json`, whose frozen `formio-application` description carried the retired `.mcp.json`/restart promise

### Refactor

- [x] 5.10 Review implementation and refactor as needed

## 6. The `project` command on the bin
<!-- depends_on: none -->

Spec: `server-config` — "The bin configures a project without an MCP session" and "A stand-alone server asks for both URLs before it needs them". Independent of every prose group; the setup-skill step in group 7 has nothing to call until this exists (design Decision 6).

**Scope added during apply:** used stand-alone, with no skills installed, the server was the only thing that could tell an agent how to configure a project — and its guidance never mentioned the base URL. `baseUrl` builds the portal-login URL (`auth.ts:117`) and keys the JWT cache, so omitting it silently defaulted to `https://api.form.io` and pointed a self-hosted user's login at the wrong deployment. Tasks 6.13–6.17 close that (design Decision 10).

### Red

- [x] 6.1 Write failing test: invoking the bin with no arguments still connects a stdio transport and serves the full tool list — the transport path is unchanged. **Passes on arrival:** the behaviour already exists, so this is a regression guard for the dispatch change rather than a Red test; left as a real spawn-and-handshake test because that is what makes it load-bearing
- [x] 6.2 Write failing test: `project set --project-url … --base-url … --cwd /abs/path` writes an entry readable by `readProjectEntry` with both env keys, at mode `0600`, preserving mappings for other working directories
- [x] 6.3 Write failing test: `project set` with no `--cwd` keys the mapping on the absolute `process.cwd()`, and with no `--base-url` falls back to `FORMIO_BASE_URL` from the environment
- [x] 6.4 Write failing test: `project set` with a non-`http`/`https` or malformed `--project-url` exits non-zero and names the argument and the received value
- [x] 6.5 Write failing test: `project get --cwd …` prints the resolved project and base URL and names the working-directory mapping as the winning source
- [x] 6.6 Write failing test: `project get` names the environment as the winning source when `FORMIO_PROJECT_URL` is set and a different mapping exists for the same cwd
- [x] 6.7 Write failing test: `project get` with nothing configured exits non-zero with a message naming `project set`
- [x] 6.8 Write failing test: a mapping written by `project set` resolves on a tool call with that cwd, with no prior `project_set` tool call

### Green

- [x] 6.9 Add a command module exposing a pure function over parsed arguments, reusing `project-map.ts` for I/O and `project_set.ts`'s URL normalization — no second copy of the file format, the merge rules, or the validation
- [x] 6.10 Add argument branching to `packages/mcp-server/src/stdio.ts`: dispatch `project set` / `project get`, exit with the module's status, and fall through to the stdio transport when no arguments are given
- [x] 6.11 Make `project get` report the winning source by reusing `resolveProjectConfig`'s precedence rather than reimplementing it

### Red (added during apply — stand-alone gap)

- [x] 6.13 Write failing test: the server declares MCP `instructions` naming the Project URL, the Base URL, and `project_set`, and naming no client, skill, or plugin
- [x] 6.14 Write failing test: the resolution error raised with no project configured names the base URL and states that it defaults to `https://api.form.io`
- [x] 6.15 Write failing test: the `project_set` description states that the base URL builds the login URL and falls back to `https://api.form.io`

### Green (added during apply — stand-alone gap)

- [x] 6.16 Add `SERVER_INSTRUCTIONS` to `createServer`, so an agent with no skills installed is told to ask for both URLs and persist them with `project_set`
- [x] 6.17 Extend `missingProjectError` and the `project_set` description to name the base URL and the cost of omitting it

### Refactor

- [x] 6.12 Review implementation and refactor as needed — extracted `CommandContext`, replaced the double-incrementing flag loop with a reduce that rejects stray tokens, removed the `let` around resolution via `resolveOrNull`, and documented the `cacheDir` seam. **Deviation:** the `code-simplifier` subagent dispatch this phase normally ends with was skipped per the session-standing instruction not to call the Agent tool unprompted; the review was done inline instead

## 7. Setup-time project configuration
<!-- depends_on: 2, 4, 6 -->

Spec: `formio-mcp-setup-skill` — "Setup offers to configure the project before the reload", "The project-configuration step is skippable and never blocks setup"; `formio-application-skill` — MODIFIED DEPLOYMENT.md. Depends on group 6 for the command, group 2 for the deleted step, and group 4 for the question phrasing this step reuses.

### Red

- [x] 7.1 Write failing test: `formio-mcp-setup/SKILL.md` documents a project-configuration step that runs after the client configuration is written and before the reload instruction
- [x] 7.2 Write failing test: the step applies configuration by invoking `project set` on the bin — the document contains no instruction to edit `~/.formio/projects.json` and no instruction to add `FORMIO_PROJECT_URL` or `FORMIO_BASE_URL` to any client configuration file
- [x] 7.3 Write failing test: the step confirms with `project get` rather than asserting success
- [x] 7.4 Write failing test: the step is documented as skippable, names `project_set` as the first-tool-call fallback, and its closing message describes setup as complete rather than failed
- [x] 7.5 Write failing test: the step short-circuits when `project get` already resolves a project for the working directory
- [x] 7.6 Write failing test: the step handles a failed `project set` — an older published `@formio/mcp`, an unreachable registry — as a skipped step, still delivering the reload instruction and the handoff
- [x] 7.7 Write failing test: the step references `formio-application/DEPLOYMENT.md` by file path for the URL descriptions and example values, and does not duplicate them
- [x] 7.8 Write failing test: `formio-application/DEPLOYMENT.md` resolves an existing mapping before interviewing and confirms in one line when one is found

### Green

- [x] 7.9 Add the project-configuration step to `formio-mcp-setup/SKILL.md`, sequenced between the client-configuration write and the reload instruction, with the one-round question, the `project set` invocation, and the `project get` confirmation
- [x] 7.10 Add the skip, short-circuit, and command-failure branches, each with its closing wording
- [x] 7.11 Update the skill's "What you are NOT doing" section — collecting the project configuration is now in scope, while choosing an API key and continuing the user's original request remain out
- [x] 7.12 Make `formio-application/DEPLOYMENT.md` resolve an existing mapping first and confirm in one line, with the interview as the fallback
- [x] 7.13 Update `formio-application/SKILL.md` Step 3 to match, and add the new command to `openspec/changes/package-as-agent-plugin/client-verification.md` alongside the tracked `project_set` publish gap

### Refactor

- [x] 7.14 Review implementation and refactor as needed

## 8. Enforcement suite, residual sweep, and eval re-run
<!-- depends_on: 3, 4, 5, 7 -->

Spec: `agent-neutral-skill-prose` — "Live skill instructions name no client-specific mechanism". Added last so it grades finished prose (design Decision 8).

### Red

- [x] 8.1 Write failing test: the suite enumerates every `SKILL.md` and reference document under `plugin/skills/` and asserts the full denylist — `mcp__plugin_`, `frontend-design:frontend-design`, `/reload-plugins`, `/mcp`, `restart Claude Code`, `Claude Code plugin`, `-a claude-code`, plus `verify-project-url` and `FORMIO_PLUGIN_CONTEXT` — failing with file, matched string, and rule. Slash commands match as inline code, not bare substrings: `/mcp` is a substring of `@formio/mcp`
- [x] 8.2 Write failing test: the exemption list is by explicit path — `plugin/skills/formio-mcp-setup/SKILL.md` and any `evals/` path are exempt, and the suite asserts both are in the declared list rather than matched by heuristic
- [x] 8.3 Write failing test: a document reading "using the client's structured question mechanism (in Claude Code, `AskUserQuestion`)" passes the suite, proving parentheticals are not banned
- [x] 8.4 Write failing test: residual bare Claude references are gone from `formio-angular/BOOTSTRAP.md` and `formio-application/{IMPORT,INTENT,DEPLOYMENT}.md` — each remaining mention is a parenthetical example
- [x] 8.5 Write failing test: `formio-mcp-setup/SKILL.md` still carries the four-client configuration table and the four-client reload list, unchanged by this change (Phase 2 plan item 1 verification)

### Green

- [x] 8.6 Add `packages/skill-tests/src/skill-descriptions/agent-neutral-prose.test.ts` with a shared markdown-document enumerator in `helpers.ts` (reference docs, not just `SKILL.md`) and the explicit exemption list
- [x] 8.7 Sweep the residual `Claude` / `Claude Code` mentions in `formio-angular/BOOTSTRAP.md` and `formio-application/{IMPORT,INTENT,DEPLOYMENT}.md`; convert each to a parenthetical example or delete it
- [x] 8.8 Reword the two `evals/README.md` runbooks so their Claude Code references read as "the client this benchmark ran under" rather than a requirement, keeping them on the exemption list either way
- [x] 8.9 Unwrap prose, then run `pnpm test`, `pnpm lint`, `pnpm format` — **the documented prose-unwrap command corrupts four files** (`pnpm format` is safe; `.prettierignore` excludes `*.md`, and the unwrap command overrides that with `--ignore-path=/dev/null`) (`${FORMIO_PROJECT_URL}` → `${FORMIO*PROJECT_URL}` in `formio-api/references/platform-*.md`; the fenced template in `formio-resource-planner/references/template-md.md` collapsed). Those were reverted and the formatter bug recorded as an open question; only the files this change edits were unwrapped, and they pass `prettier --check`
- [x] 8.10 Re-run the `formio-resource-planner` harness and diff `grading.json` against the group 1 baseline — **98/124 → 128/131 with_skill**, no assertion regressed. The one remaining failure (3 of 4 evals) is a grader bug: it demands a Save Submission action on `userLogin`, which a login form must not have. Present at baseline too
- [x] 8.11 Re-run the `formio-angular-resources` harness and diff against baseline — **51/55 → 51/54 with_skill**, net flat. eval-1's two failures are a pre-existing fixture/grader filename mismatch present in both columns; eval-2 lost one path-shaped assertion that this change does not explain (see `eval-evidence.md`)
- [x] 8.12 Record the before/after scores in the change directory — `eval-evidence.md`, including the re-grade-the-baseline-with-the-current-grader method, both grader bugs found, and the unexplained eval-2 delta

### Refactor

- [x] 8.13 Review implementation and refactor as needed — verified one owner for the denylist (`agent-neutral-prose.test.ts`) and cross-referenced it from the two group suites that overlap it, so a reviewer can see which is authoritative. **Deviation:** the `code-simplifier` subagent dispatch was skipped per the session-standing instruction not to call the Agent tool unprompted; review done inline
