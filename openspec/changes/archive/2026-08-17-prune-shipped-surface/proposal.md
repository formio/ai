## Why

Two kinds of residue accumulated in this repository, and neither serves anyone reading it.

The first ships. `npx skills add formio/ai` copies `plugin/` into the developer's own project. Everything in that tree is therefore shipped product, and three things in it are not: they are this repository's own tooling, or they are Claude-Code-only machinery that no longer has a purpose.

This is a different concern from multi-agent portability, and the two have been conflated. **This repository's ergonomics may be as Claude-opinionated as its maintainers like** — `CLAUDE.md`, `.claude/`, `.cursor/`, `.github/prompts/`, and `openspec/` are all out of scope here, and a contributor who forks the repo and opens it in a different agent is not a case this change cares about. What matters is only what lands in a consumer's folder.

Against that line:

- **The eval harnesses ship.** 12 tracked files, ~148KB: two `grade.py` graders, two `evals.json`, two `evals/README.md` runbooks, and fixtures including a complete seeded Angular workspace (`angular.json`, `package.json`, `app.module.ts`, `app-routing.module.ts`) plus planner `template.md` / `template.json`. These exist to measure whether a change to a skill improved it. They have no meaning in the project of someone who asked for a form. The READMEs also reference `~/.claude/plugins/cache/.../skill-creator/` paths and instruct spawning subagents — Claude-specific prose that, unlike the repo's own files, is on the shipped side of the line.
- **`plugin/hooks/` is orphaned and structurally Claude-only.** Its `PreToolUse` matcher is `mcp__plugin_formio-ai_formio-mcp__.*`, so it can only fire in Claude Code with a plugin install; it is inert in every other client and in every skills-only install. It expands `${user_config.*}`, which the Agent Plugins specification does not permit (only `${PLUGIN_ROOT}` / `${PLUGIN_DATA}`). No shipped document references it any more — the `neutralize-skills-for-multi-agent` change deleted the plugin-mode branch in `DEPLOYMENT.md` that keyed on it, and the enforcement suite added there now bans `verify-project-url` from live skill documents. It duplicates guidance the server already gives natively, and it can actively deny tool calls the server would have resolved.
- **The npm metadata still describes a Claude Code plugin.** `plugin/package.json` reads `"description": "Form.io Claude Code plugin — MCP server and skills library"` with keywords `claude` / `claude-code` and nothing else. That is the description consumers see on npm for a bundle that now targets four clients.

Nothing enforces the boundary, which is why all three drifted in.

The second kind does not ship, but it is public. `docs/multi-agent-portability.md` was written to drive the portability initiative: an audit, eleven gap items, a five-phase plan, a risk list, and a marketplace-submission checklist. Phases 0 through 2 are done and each is recorded as its own OpenSpec change, with its motivation in the proposal and its decisions in the design. What remains in the roadmap is either duplicated there or describes work not yet started — and to anyone browsing a public repository it reads as current planning. It is the only file in `docs/`.

One requirement depends on it. Phase 1's `claude-plugin-release` spec obliges the repository to track review-gated submission status *in that file*. The useful half of that requirement was never the location — it was the release behaviour: never automate a third-party review queue, never fail a release on a pending one. That half is kept; the filing mandate goes, because where maintainers track a moving operational status is not something a specification should fix to a path in a public tree.

## What Changes

- **Move the eval harnesses out of the shipped tree.** `plugin/skills/formio-resource-planner/evals/` → `packages/skill-tests/evals/formio-resource-planner/`, and `plugin/skills/formio-angular/formio-angular-resources/evals/` → `packages/skill-tests/evals/formio-angular-resources/`. Update `grade.py`'s repo-root resolution (it currently counts five parents up from its own location), both `README.md` runbooks' relative paths, and the `skills/<skill>/evals/` convention documented in `CLAUDE.md`.
- **BREAKING** — **Delete `plugin/hooks/`.** Remove `hooks.json` and `verify-project-url.mjs`, drop `"hooks"` from `plugin/package.json`'s `files[]`, and remove the hook from any manifest that declares it. Claude Code plugin users lose the `SessionStart` default-project-URL prompt; `formio-mcp-setup`'s configuration step and `formio-application`'s resolve-then-ask Deployment step now cover that ground, and the server states the same requirement in its own `instructions` and in the error it raises when no project resolves.
- **Correct the shipped npm metadata.** `plugin/package.json`'s description and keywords describe a multi-client bundle rather than a Claude Code plugin.
- **Delete `docs/multi-agent-portability.md`** and clean the ten tracked files that reference it. Where a change artifact cited a fact from it — a gap identifier, a risk number, a phase boundary — the artifact states the fact inline instead of pointing at a deleted file. The preserved submission tables are handed to the maintainers to put wherever they track operational work.
- **Amend Phase 1's submission requirement** to keep the release behaviour and drop the mandate that status live in a repository file.
- **Add a test that enforces the boundary.** Assert that `plugin/` contains only consumer-facing files: an allowlist of the top-level entries, no `evals/` anywhere beneath it, and no hook declarations. Without this the tree drifts again.

Out of scope, deliberately: `CLAUDE.md`, `.claude/`, `.cursor/`, `.github/`, `openspec/`, and the repository's tracked `.claude/skills/formio-*` symlinks. All of that is repository ergonomics — it may favour any client its maintainers prefer. `docs/` is in scope only because deleting its single file empties it. Also out of scope: the missing `.codex-plugin/plugin.json` — the Phase 1 plan called for one and only `.claude-plugin` and `.cursor-plugin` exist, which is unfinished work rather than cruft, and belongs to whichever change finishes Phase 1.

## Capabilities

### New Capabilities

- `shipped-surface-boundary`: the rule that `plugin/` contains only what a consumer needs in their own project, the allowlist that defines it, and the test that enforces it — plus the rule that a finished initiative leaves no roadmap behind, since the OpenSpec change set is the durable record.

### Modified Capabilities

- `claude-plugin-packaging`: `plugin/hooks/` is removed from the bundle and from `files[]`, and the shipped npm metadata stops describing the bundle as a Claude Code plugin.
- `claude-plugin-release`: the obligation to record submission status in `docs/multi-agent-portability.md` is dropped; the release behaviour it protected — never automate a review-gated channel, never fail on a pending one — is restated without a filing location.

## Impact

- **Moves:** 12 tracked files from two `plugin/skills/**/evals/` directories to `packages/skill-tests/evals/<skill>/`.
- **Deletes:** `plugin/hooks/hooks.json`, `plugin/hooks/verify-project-url.mjs`, and their tests. Any test asserting the hook is declared in a manifest changes with them.
- **Edits:** `plugin/package.json` (`files[]`, description, keywords); `CLAUDE.md`'s "Iterating on skills" section (the `skills/<skill>/evals/` convention and the two paths it names); both `grade.py` files' `REPO_ROOT` resolution; both `evals/README.md` runbooks' paths.
- **Behavioural, for Claude Code plugin users only:** no `SessionStart` / `CwdChanged` project-mapping prompt, and no `PreToolUse` gate denying Form.io calls in an unmapped directory. The server's own error and instructions replace it. Users who set `FORMIO_PROJECT_URL` in the server environment stop being denied calls the server would have resolved — the conflict the hook created.
- **No change to any skill's content.** The skills themselves are untouched; only what travels alongside them.
- **Deletes:** `docs/multi-agent-portability.md` (~32KB), emptying `docs/`. Ten tracked files lose a reference: `prompt-multi-agent.md`, and change artifacts under `package-as-agent-plugin/`, `neutralize-core-for-multi-agent/`, and `neutralize-skills-for-multi-agent/`.
- **Depends on `neutralize-skills-for-multi-agent`.** The hook removal is only safe because that change deleted every reference to it and added the server-side guidance that replaces it.
