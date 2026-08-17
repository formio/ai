## Context

Phase 0 (`neutralize-core-for-multi-agent`) made the MCP server behave identically in every client: `FORMIO_PLUGIN_CONTEXT` is gone, `project_set` is registered everywhere, and project resolution follows a documented precedence — server-environment `FORMIO_PROJECT_URL` first, then the working-directory mapping in `~/.formio/projects.json`. Phase 1 (`package-as-agent-plugin`) shipped three plugin manifests over one skills tree plus `formio-mcp-setup`, so a skills-only install can bootstrap the server.

What is left is prose. Eleven skills, ~20 documents, all written against Claude Code:

- `formio-application` Step 4 writes `.mcp.json` with a `FORMIO_PROJECT_URL` env block and halts for a Claude Code restart. Under Phase 0's precedence, that env var **overrides** the `project_set` mapping Step 3 just wrote — the step is not merely non-portable, it is wrong.
- Plugin-mode detection matches the tool prefix `mcp__plugin_formio-ai_formio-mcp__` and a Claude-only hook side effect.
- Thirteen documents instruct the agent to call `AskUserQuestion` by name.
- Seven documents detect `frontend-design:frontend-design` and offer a marketplace install plus `/reload-plugins`.
- `BOOTSTRAP.md` installs the Angular skills with a hardcoded `-a claude-code`.

Constraints: skill markdown carries no hard line wraps (one line per paragraph, one line per frontmatter `description`); no backward-compatibility shims; `pnpm test` / `pnpm lint` / `pnpm format` must pass. Two eval harnesses exist and are the only regression signal for prose changes.

## Goals / Non-Goals

**Goals:**

- Every live skill instruction is executable by any Agent-Skills client.
- The prose stops contradicting the server: no step writes an env var that defeats `project_set`.
- The portable substance survives verbatim in meaning — question batching, explicit option sets, approval gates, the never-emit-unstyled-UI guarantee, and the `formio-mcp-setup` routing.
- Regressions are provable, not asserted: both eval harnesses run before and after.
- The de-Claudeing is enforced by a test, so it cannot silently rot back.

**Non-Goals:**

- Rewriting `formio-mcp-setup`. It already owns the per-client configuration table and reload list (Phase 2 plan item 1) — this change verifies and exempts it.
- Touching `packages/mcp-server/`. Phase 0 finished the server side.
- README, `llms-install.md`, `plugin/README.md`, `docs/headless-agents.md`, `CONTRIBUTING.md` — Phase 3.
- An installer CLI — Phase 4.
- Running the evals under Cursor or Codex. The risk that skill quality outside Claude Code is unmeasured stays open; this change proves no regression in Claude Code, which is where both harnesses run today.

## Decisions

### 1. Delete the MCP Config step rather than make it client-conditional

The Phase 2 plan said to keep the halt-and-reload gate and make the instruction client-conditional. That is now the wrong shape. Writing `env.FORMIO_PROJECT_URL` pins the server against the working-directory mapping, so the "portable" version of this step would faithfully reproduce a bug across four clients. The step also duplicates `formio-mcp-setup`, which already writes configuration for all four clients behind an approval gate.

After deletion the orchestration has exactly two states to reason about: Form.io tools are available (proceed), or they are not (route to `formio-mcp-setup`). No install-method branch, no restart boundary, no `.mcp.json`.

Alternatives considered:

- _Client-conditional Step 4, as planned._ Rejected: propagates the precedence bug and forks the step four ways.
- _Keep Step 4 but drop the env block._ Rejected: what remains is "write `command`/`args` for a server that isn't connected", which is `formio-mcp-setup`'s entire job.

Users who deliberately pin a server to one project by setting `FORMIO_PROJECT_URL` in their own launch configuration keep that behaviour — it is documented on `project_set` and is unaffected.

### 2. Renumber the steps; do not leave a gap

Deleting Step 4 renumbers Import 5 → 4 and Framework routing 6 → 5 (with 6a → 5a and 5.5 → 4.5). About fifty step references across `formio-application/*.md` and three `formio-angular` documents move. A gap ("Step 3, then Step 5") is cheaper to produce and worse to read, and these documents _are_ the product. Renumber, then grep for surviving `Step 6` / `Step 5 (Import)` phrasings as a check.

### 3. One portable phrasing pattern, applied uniformly

Every de-Clauded instruction follows the same shape: state the portable instruction, then optionally name a client tool as a parenthetical example.

> Ask both questions in one round using the client's structured question mechanism (in Claude Code, `AskUserQuestion`).

This keeps the batching rule — the part that actually changes agent behaviour — front and centre while leaving the Claude Code reader the concrete tool. Options sets stay specified. Where prose relied on `AskUserQuestion`'s built-in "Other" affordance, it becomes "allow a free-text answer alongside the fixed options" rather than naming the affordance.

Alternative considered: strip the tool names entirely. Rejected — Claude Code is the client most users are on and the majority of eval coverage; a bare "ask the user" reads as permission to pepper, which is the regression the batching rule exists to prevent.

### 4. The capability probe is the agent's own tool list, not a filesystem check

"Probe" means: check whether `form_list`, `form_create`, `project_import`, and `project_set` are callable, under whatever names this client exposes them. It is not a file check, not a namespace match, and not a hook side effect. `formio-mcp-setup` Step 1 already states the portable form of this; the orchestrator adopts the same wording so both skills describe one mechanism.

### 5. `frontend-design` keeps its name; only its distribution wording is client-specific

`frontend-design` is a **portable Agent Skill**, not a Claude Code artifact. Its `SKILL.md` carries only spec-conformant frontmatter (`name`, `description`, `license`), its body is design guidance with nothing client-specific in it, and it ships in a `skills/` directory at <https://github.com/anthropics/claude-plugins-public/tree/main/plugins/frontend-design> — the layout every Agent Skills client reads. So naming it is both accurate and more useful than a paraphrase: "consult `frontend-design`" is actionable, "consult the client's design skill" is not, and the paraphrase also destroys any way to tell the user how to get it.

What is genuinely client-specific is narrower than the name:

- Asserting `frontend-design:frontend-design` as **the** registration form. The namespaced form is one possibility among several, so detection matches the skill under any registered form and says so.
- `/plugin` browse, `claude plugin install frontend-design@claude-plugins-official`, and `/reload-plugins`. Those are replaced by naming where the skill ships and letting the client's own skill-install route do the work.

The install offer therefore **stays**, because there is something real to offer. `frontendDesignStatus: 'available' | 'declined'` stays with it — `'declined'` describes an actual user decision. `FRONTEND_DESIGN_BRIEF` keeps its name.

Alternatives considered:

- _Genericize to "the client's design skill" with a silent probe and `designSkillStatus: 'available' | 'inline-brief'`._ This was implemented first and then reverted. It was over-correction: it treated a portable skill as a client artifact, dropped a name the agent can actually match on, and removed a legitimate install offer on the false premise that nothing could be offered.
- _Full revert, keeping the Claude-only install commands._ Rejected: those commands do nothing in Cursor, Codex, or Copilot CLI, which is the whole point of this phase.

### 6. Configure the project through a new bin command, not by editing state or pinning env

`formio-mcp-setup` runs when no server is connected, so `project_set` — an MCP tool — is uncallable there. Three ways to get a project configured before the first tool call:

- _Skill hand-writes `~/.formio/projects.json`._ Rejected: couples skill prose to the server's private `0600` state file, written with a bare `JSON.stringify`. A merge slip in prose clobbers other workspaces' mappings, and the format is then defined in two places.
- _Skill writes `FORMIO_PROJECT_URL` into the client configuration `env` block._ Rejected: that is the precedence trap this change is removing from `formio-application`, relocated to the setup skill. Any later `project_set` would silently no-op.
- _Give the bin a `project` command._ Chosen.

`formio-mcp project set --project-url … --base-url … --cwd …` calls `writeProjectEntry` directly, so the server keeps sole ownership of the file format, the merge behaviour, and the mode. It needs no MCP session, so it works before the reload; the mapping is read at tool-call time, so the first tool call after the reload already resolves. `project_set` still works afterwards against the same file — no conflict, because nothing is pinned.

`project get --cwd …` exists so the skill can confirm rather than assert, and so a user can answer "which project am I pointed at, and why" — it names the winning source, which is the only way to diagnose an environment value overriding a mapping. Both fall out as the headless/CI configuration path Phase 3 will document.

`stdio.ts` is nine lines today. It gains argument branching only; the command lives in its own module as a pure function over parsed arguments, with the write and the printing at the edge, per this repository's functional-style rule. No arguments means unchanged stdio behaviour — that path is asserted by a test, because breaking it breaks every client at once.

### 7. Project configuration is captured once, wherever the user first lands

Two skills can now capture it: `formio-mcp-setup`'s new step, and `formio-application` Step 3. Neither may re-ask what the other already got, so both resolve an existing mapping first and confirm in one line. `DEPLOYMENT.md` stays the single source of the plain-language URL descriptions and example values; the setup skill references it by path rather than duplicating it, which is the same rule the planner ↔ auth handoff already follows.

The setup step is skippable and says so. It fires from every skill's preflight — an API-reference question needs no project, and a user who has not created one yet cannot answer. Blocking there would make setup feel broken in exactly the flow this whole phase exists to fix. Skipping is not a failure: the closing message still describes setup as complete and names `project_set` as what will capture the project on the first tool call.

### 8. Enforce with a denylist test and an explicit exemption list

A new suite alongside Phase 0's `agent-skills-conformance` suite walks every `SKILL.md` and reference document under `plugin/skills/` and fails on: `mcp__plugin_`, `frontend-design:frontend-design`, `/reload-plugins`, `/mcp`, `restart Claude Code`, `Claude Code plugin`, and `-a claude-code`.

Exemptions are a hardcoded path list, never a heuristic: `plugin/skills/formio-mcp-setup/SKILL.md` (its subject _is_ per-client paths and reload steps) and anything under an `evals/` directory (runbooks describing how a benchmark was reproduced). An explicit list makes each exemption a reviewable decision.

Not on the denylist: the bare word `Claude`. Parenthetical examples are the sanctioned pattern, and banning the word would ban them. The narrower strings above are the ones that mark an unexecutable instruction.

### 10. The stand-alone server has to ask for both URLs itself

The shipping flow assumes skills are present, but `@formio/mcp` is also installed on its own — from the MCP Registry, the Docker catalog, a Cursor MCP entry, the `.mcpb` desktop bundle. In that case the server is the only thing that can tell an agent how to configure a project, and its guidance was incomplete: the resolution error named `project_set` and `FORMIO_PROJECT_URL`, never the base URL.

That omission is not cosmetic. `baseUrl` builds the portal-login URL (`auth.ts:117`) and keys the JWT cache, and it falls back to `https://api.form.io`. A self-hosted user whose agent called `project_set` with only a project URL therefore got a login pointed at Form.io's hosted cloud — a silent failure with a confusing symptom.

Three channels, all server-side, none client-specific:

1. **MCP server `instructions`** — declared on `createServer`, surfaced at initialize, so it reaches an agent before any tool call and regardless of what skills exist. This is the proactive channel; the error is only reactive. It names no client, skill, or plugin, asserted by test.
2. **The resolution error** — now asks for both URLs and states that the base URL defaults to `api.form.io`, which is wrong for a self-hosted deployment.
3. **The `project_set` description** — states what the base URL does and what omitting it costs, rather than listing it as an optional parameter.

Alternative considered: fix only the error text. Rejected — it fires after a failed call, so the first thing a stand-alone user sees is still a failure. Instructions turn that into a question asked up front.

### 9. Baseline the evals before touching prose

Run both harnesses on the current branch first, then again after the rewrite, and compare `grading.json`. Running only afterwards proves nothing: the harnesses have no absolute pass bar, only relative structural scores. Baseline artifacts land in the gitignored `.eval-artifacts/` per each skill's `evals/README.md`.

## Risks / Trade-offs

- **Renumbering leaves a stale cross-reference that no test catches.** → Grep for `Step 6`, `Step 5 (Import)`, `Step 6a`, and `Step 5.5` after the edit; the eval harnesses exercise the orchestration end to end and will surface a step the agent cannot find.
- **Removing the design-skill question changes behaviour Claude Code users see today.** → It removes a prompt, never a capability: `frontend-design` is still consulted when present, and the inline brief is disclosed when it is not. Called out in the proposal as user-visible.
- **`designSkillStatus` rename breaks the handoff if one side is missed.** → It is a two-sided contract in `formio-application/{SKILL,FRAMEWORK}.md` and `formio-angular/{SKILL,BOOTSTRAP}.md` plus the resources sub-skill; grep for the old name until zero hits. No shim, per repository policy.
- **The eval harnesses may move for reasons unrelated to this change.** → Baseline on the same commit the rewrite starts from, and treat only structural-score deltas on the affected steps as signal.
- **The two in-flight changes on this branch both touch `formio-angular-skill`.** → Phase 0's delta covers layout, sub-skill description, and cross-references; this change files no `formio-angular-skill` delta at all, so they cannot restate each other.
- **The new `project` command does not exist in `@formio/mcp@0.8.4`,** so prose naming it fails against the published `latest` until the next release. → The setup skill degrades to a skipped step on failure (specced), which is the same behaviour a user who cannot answer gets. Add the command to `client-verification.md` alongside the `project_set` gap already tracked there.
- **Argument branching in `stdio.ts` risks the transport path.** → A test asserts that a no-argument invocation still connects a stdio transport and serves the full tool list. Breaking that breaks every client simultaneously, so it is the one case worth an explicit regression test rather than inference.
- **A denylist is a lower bar than a reviewer.** → It catches regression, not novelty: a newly invented client-specific instruction passes. The authoring rule in `agent-neutral-skill-prose` is the standard; the test is the ratchet. Phase 3 adds the `CONTRIBUTING.md` rule for humans.

## Migration Plan

No runtime migration — this is documentation and one test suite. Ordering that matters:

1. Baseline both eval harnesses (Decision 9) before editing prose.
2. Ship the bin's `project set` / `project get` command (Decision 6) — the setup-skill step has nothing to call until it exists.
3. Delete `MCP_CONFIG.md` and its references, then renumber (Decisions 1, 2).
4. Apply the portable phrasings and the design-skill genericization (Decisions 3, 4, 5).
5. Add the setup-skill configuration step and make Deployment conditional (Decision 7).
6. Add the enforcement suite last, so it grades finished prose (Decision 8).
7. Unwrap prose with `npx prettier --prose-wrap never --ignore-path=/dev/null --write "plugin/skills/**/*.md"`, then `pnpm test`, `pnpm lint`, `pnpm format`.
8. Re-run both harnesses and compare against the baseline.

Rollback is `git revert` of the prose commit; nothing persists outside the repository.

One release-ordering consequence: the skill prose names a command that only exists from the next `@formio/mcp` release (0.9.0), so until that publish lands `latest` does not have it — the same gap `client-verification.md` already tracks for `project_set`. It does not fail, which is the trap: an older binary ignores the `project` arguments, starts its stdio server, reads end-of-input and exits **0 with no output**. Unpinned, `project get` reports success while finding nothing and `project set` reports success while writing nothing, so an agent confirms a mapping that does not exist. A floor was considered and rejected: `@formio/mcp` is a 0.x line, so a hard-coded `>=0.9.0` in shipped prose goes stale at the next release, and the window it guards closes as soon as 0.9.0 publishes. The documented invocation stays `npx -y @formio/mcp project …`, and the silent case is handled by rule instead: empty output is never an answer. The setup skill MUST treat that failure, **and** a zero-exit run that prints nothing, the way it treats a skipped step: report it, name `project_set` as the fallback on the first tool call, and never leave the user believing setup failed or that a mapping was written.

## Resolved during implementation

- **Do the eval fixtures assert the old step numbering or `frontendDesignStatus`?** No. Neither `evals.json` nor either `grade.py` references step numbers, the design-skill variable, or `.mcp.json` — both graders assert artifact structure only (`template.md` headings, `template.json` keys, Angular routing shape). Prose changes cannot break them, which is what made deferring the baseline safe. What did need updating was a different frozen fixture: `descriptions-before-preflight.json`, which pinned `formio-application`'s description byte-identical including the retired `.mcp.json`/restart promise.
- **Is `/mcp` worth denylisting?** Yes, but not as a bare substring — `/mcp` is a substring of the package name `@formio/mcp`, which every skill legitimately names, so the naive rule flagged thirteen innocent files. The denylist entries for slash commands match them as inline code (`` `/mcp` ``) or as an explicit "run /mcp" instruction instead. The lesson generalizes: denylist entries need to match the instruction, not the characters.
- **Renumbering scope.** `BOOTSTRAP.md` runs its own independent Step 1–8 phase numbering that has nothing to do with the orchestrator, so a library-wide "no document says Step 6" rule was wrong. The numbering rule is scoped to `formio-application/*` plus any cross-reference that names `formio-application` explicitly.

## Open Questions

- **The documented prose-unwrap command corrupts skill markdown.** `pnpm format` is safe — `.prettierignore` excludes `*.md`, so it never touches these files. The hazard is the unwrap command in `CLAUDE.md`, which deliberately overrides that exclusion with `--ignore-path=/dev/null` and then rewrites `${FORMIO_PROJECT_URL}` to `${FORMIO*PROJECT_URL}` in `formio-api/references/platform-*.md` (reading the underscores as emphasis), and collapses the indented template inside the ```markdown fence in `formio-resource-planner/references/template-md.md` — the exact shape the planner emits and its grader asserts. Those files were reverted here rather than fixed, because the fix belongs to the formatter configuration (a `.prettierignore` entry, or `--embedded-language-formatting=off`) and not to this change. Anyone running the documented command today damages four files.
