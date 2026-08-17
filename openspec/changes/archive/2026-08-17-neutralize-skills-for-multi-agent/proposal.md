## Why

Phases 0 and 1 made the toolset _installable_ in every agent — one server behaviour for all clients, three plugin manifests over one skills tree, and a `formio-mcp-setup` skill that bootstraps a skills-only install. The skill prose those clients now read is still written for Claude Code: it tells the agent to call `AskUserQuestion` by name, to sniff for the `mcp__plugin_formio-ai_formio-mcp__*` namespace, to install `frontend-design` with `claude plugin install` and `/reload-plugins`, to write `.mcp.json` and halt for a Claude Code restart, and to install the Angular skills with a hardcoded `-a claude-code`. In Cursor, Codex, Copilot CLI, or VS Code every one of those instructions is either a no-op the agent silently skips or a dead end it follows literally — the install works and the guidance does not.

There is a second, related gap. The shipping flow is now "run `npx skills add formio/ai`, then ask for what you want" — so `formio-mcp-setup` is where most users first meet the toolset. It connects a server and stops there, deliberately collecting no project configuration. The first Form.io tool call after the reload therefore fails with "No Form.io project is configured", and the user resolves mid-task what setup could have resolved during setup. `project_set` is an MCP tool, so the setup skill cannot call it before the server exists — which is why the configuration never happened there.

One of those instructions is now actively wrong even in Claude Code. Phase 0 gave a `FORMIO_PROJECT_URL` in the server environment **precedence** over the `~/.formio/projects.json` mapping (`packages/mcp-server/src/project-resolver.ts:7`, `packages/mcp-server/src/tools/project_set.ts:41`), so `formio-application` Step 4 — which writes exactly that env var into `.mcp.json` — pins the server to one project and defeats the `project_set` call Step 3 just made.

## What Changes

- **BREAKING** — **Delete `formio-application` Step 4 (MCP Config).** Remove `plugin/skills/formio-application/MCP_CONFIG.md`, its Step 4 section in `SKILL.md`, the "Expect one restart boundary on build-new" bullet, its row in the reference-file list, and every cross-reference from `DEPLOYMENT.md`, `IMPORT.md`, `INTENT.md`, and `FRAMEWORK.md`. Step 3 calls `project_set`; Step 5 (Import) then runs in the **same** invocation. There is no restart boundary on either branch, and the skill never writes MCP configuration itself — a missing server routes to `formio-mcp-setup`.
- **Replace namespace-sniffing with a capability probe.** Plugin-mode detection keyed on `mcp__plugin_formio-ai_formio-mcp__*` tool names and on the Claude-only `verify-project-url` hook is replaced by one client-agnostic question: are Form.io MCP tools available under _any_ name?
- **Make the structured-question instruction portable.** Every `AskUserQuestion` mention becomes a client-neutral phrasing that names the tool only as a Claude Code example. The portable substance — one batched question round per step, never pepper the user — survives unchanged.
- **Make the `frontend-design` dependency portable without renaming it.** `frontend-design` is itself a portable Agent Skill, so it keeps its name, its install offer, and the `frontendDesignStatus` handoff. What goes is the client-specific machinery around it: detection that matches only `frontend-design:frontend-design`, and the `/plugin` browser, `claude plugin install …@claude-plugins-official`, and `/reload-plugins` install path — replaced by naming where the skill ships and deferring to the client's own skill-install route.
- **Take the `skills` CLI agent flag from the detected client.** `npx skills add https://github.com/angular/skills --all -a claude-code -y` in `BOOTSTRAP.md` stops hardcoding `claude-code`, defaulting to the universal `.agents/skills/` target.
- **Sweep residual `Claude` / `Claude Code` references** in `formio-angular/BOOTSTRAP.md`, `formio-application/{IMPORT,INTENT,DEPLOYMENT}.md`, and the two `evals/README.md` runbooks.
- **Give the server a `project` command so configuration can happen before any client connects.** `formio-mcp project set --project-url … --base-url … --cwd …` writes the working-directory mapping through the same module the `project_set` tool uses; `formio-mcp project get --cwd …` prints the resolved URLs and which source won (environment or mapping). Invoked with no arguments the bin starts the stdio server exactly as before.
- **`formio-mcp-setup` captures the project configuration before the reload,** applying it with that command so the server resolves a project on its **first** tool call. The step is skippable and never blocks setup — the skill fires from every preflight, including requests that need no project and users who have not created one yet. An existing mapping short-circuits it.
- **`formio-application` Step 3 (Deployment) becomes conditional.** It resolves an existing mapping first and confirms in one line; the interview is the fallback. One rule across both skills: the project configuration is captured once, wherever the user first lands, and never re-asked.
- **Add an enforcement test** so client-specific tool names, slash commands, plugin namespaces, and client-specific config paths cannot re-enter live skill instructions.
- **Re-run both eval harnesses** before and after the prose rewrite to prove no activation or output regression.

Out of scope: `formio-mcp-setup`'s existing per-client MCP configuration table (Phase 2 plan item 1) — this change verifies it rather than rewriting it, and adds the configuration step alongside it. README, `llms-install.md`, and `CONTRIBUTING.md` are Phase 3, though the new `project` command is the headless configuration path `docs/headless-agents.md` will document there.

## Capabilities

### New Capabilities

- `agent-neutral-skill-prose`: the authoring rule that live skill instructions name no client-specific tool, slash command, plugin namespace, or client-specific configuration path — plus the capability-probe convention that replaces namespace sniffing, the portable phrasing for a structured question mechanism, the rule that a portable third-party skill keeps its name while only its distribution wording is neutralized, and the test suite that enforces all of it over `plugin/skills/`.

### Modified Capabilities

- `server-config`: the `formio-mcp` bin gains a `project set` / `project get` command so a project can be configured and inspected with no MCP session; no-argument invocation still starts the stdio server unchanged.
- `formio-mcp-setup-skill`: a skippable project-configuration step runs before the reload instruction, applied through the server's own `project` command and confirmed with `project get`.
- `formio-application-skill`: the MCP Config step is removed along with its restart boundary, so the orchestration drops from six steps to five and Deployment → Import runs in one invocation; the `frontend-design` pre-check keeps the skill's name and its install offer but drops the client-specific install commands; question batching stops naming `AskUserQuestion`.
- `formio-form-builder-skill`: question batching stops naming `AskUserQuestion`.

`formio-angular-skill` and `formio-resource-planner-skill` prose changes too, but neither spec states a requirement that changes — their `AskUserQuestion`, design-skill, and `-a claude-code` instructions are unspecified today and are covered by `agent-neutral-skill-prose` above. No delta files for them.

## Impact

- **Skill prose (the whole change surface):** `plugin/skills/formio-application/{SKILL,DEPLOYMENT,FRAMEWORK,INTENT,IMPORT}.md` and the deletion of `MCP_CONFIG.md`; `plugin/skills/formio-angular/{SKILL,SETUP,AUTH,BOOTSTRAP}.md`; `plugin/skills/formio-angular/formio-angular-resources/{SKILL.md,references/interview-guide.md,references/phase-a-plan-template.md}`; `plugin/skills/formio-form-builder/{SKILL,INTENT,SAVE}.md`; `plugin/skills/formio-resource-planner/SKILL.md`; both `evals/README.md` runbooks.
- **Tests:** a new suite alongside the Phase 0 `agent-skills-conformance` suite, running under `pnpm test`.
- **Source:** `packages/mcp-server/src/stdio.ts` gains argument branching plus a new command module; both subcommands reuse `project-map.ts` and `project_set.ts`'s URL normalization, so no second copy of the file format or the merge rules exists. No change to the transport path.
- **Eval harnesses:** `plugin/skills/formio-resource-planner/evals/` and `plugin/skills/formio-angular/**/evals/` run twice (baseline, then post-rewrite); artifacts land in the gitignored `.eval-artifacts/`.
- **Overlaps in flight:** `openspec/changes/neutralize-core-for-multi-agent/` already carries a `formio-angular-skill` delta on the same branch. The two deltas must not restate each other.
- **Downstream:** unblocks Phase 3 (documentation) and removes the risk that first-run UX is a regression on non-Claude clients, which is what a skills-only install previously delivered.
