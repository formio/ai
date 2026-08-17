## 1. Move the eval harnesses out of the shipped tree
<!-- depends_on: none -->

Spec: `shipped-surface-boundary` — "Eval harnesses live outside the shipped tree". Design Decision 1.

### Red

- [x] 1.1 Write failing test: `packages/skill-tests/evals/formio-resource-planner/` and `packages/skill-tests/evals/formio-angular-resources/` each contain `evals.json`, `grade.py`, and `README.md`, and the Angular one contains `fixtures/existing-workspace-seed/`
- [x] 1.2 Write failing test: neither `plugin/skills/formio-resource-planner/evals/` nor `plugin/skills/formio-angular/formio-angular-resources/evals/` exists
- [x] 1.3 Write failing test: `CLAUDE.md`'s "Iterating on skills" section names `packages/skill-tests/evals/<skill>/` and does not name `skills/<skill>/evals/`

### Green

- [x] 1.4 `git mv` both eval directories to `packages/skill-tests/evals/<skill>/`, preserving history — landed at `evals/` first and was relocated under `packages/skill-tests/` after review; see design Decision 1
- [x] 1.5 Correct each `grade.py`'s repository-root resolution for its new depth (currently five parents up from `plugin/skills/<skill>/evals/grade.py`) and update the comment that documents the count
- [x] 1.6 Update both `README.md` runbooks: the `grade.py` invocation paths, the fixture copy path in the Angular runbook, and any other path that assumed the old location
- [x] 1.7 Update `CLAUDE.md`'s "Iterating on skills" section — the four convention bullets and both skill paths it names
- [x] 1.8 Verify the move did not break grading: run both graders against the existing `.eval-artifacts/` iterations and confirm scores identical to `neutralize-skills-for-multi-agent/eval-evidence.md` (planner `iteration-3` 128/131, angular `iteration-phase2` 51/54). Any difference is a path bug, not a skill change

### Refactor

- [x] 1.9 Review implementation and refactor as needed — four existing tests encoded the old location and were updated: `sub-skill-layout.test.ts` now asserts the sub-skill ships NO `evals/`, and the `evals/` exemption in `helpers.ts` was deleted rather than kept as dead code, since nothing under `plugin/` needs it any more

## 2. Delete the Claude-only hook
<!-- depends_on: none -->

Spec: `agent-plugin-packaging` — REMOVED "Hooks remain a Claude-only component". Design Decision 2. **BREAKING** for Claude Code plugin users.

### Red

- [x] 2.1 Write failing test: `plugin/hooks/` does not exist, and no file under `plugin/` references `verify-project-url`
- [x] 2.2 Write failing test: no manifest under `plugin/` declares a `hooks` component — including `.claude-plugin/plugin.json`, which previously did
- [x] 2.3 Write failing test: `plugin/package.json` `files[]` does not contain `hooks`, and every remaining entry exists in the source tree

### Green

- [x] 2.4 Delete `plugin/hooks/hooks.json` and `plugin/hooks/verify-project-url.mjs`
- [x] 2.5 Remove the `hooks` declaration from `plugin/.claude-plugin/plugin.json` and drop `hooks` from `plugin/package.json` `files[]`
- [x] 2.6 Remove the hook assertions from `packages/mcp-server/src/__tests__/plugin-manifests.test.ts` — both the "no hooks outside the Claude manifest" and "the Claude manifest still registers the hook" cases
- [x] 2.7 Confirm nothing else references the hook: grep the whole repository for `verify-project-url` and `CLAUDE_PLUGIN_ROOT`, and resolve each hit or record why it stays (the `neutralize-*` change artifacts legitimately discuss it in past tense)

### Refactor

- [x] 2.8 Review implementation and refactor as needed — **scope addition:** deleting the hook orphaned `userConfig.formio_default_project_url` in the Claude manifest, whose only reader was `FORMIO_DEFAULT_PROJECT_URL`; removed it. Also removed hook documentation from three consumer-facing READMEs (`README.md`, `packages/mcp-server/README.md`, `plugin/README.md`) that the task list had not anticipated

## 3. Correct the shipped npm metadata
<!-- depends_on: 2 -->

Spec: `claude-plugin-packaging` — ADDED "Shipped npm metadata describes a multi-client bundle".

### Red

- [x] 3.1 Write failing test: `plugin/package.json` `description` does not describe the package as a Claude Code plugin and names both the MCP server and the skills library
- [x] 3.2 Write failing test: `keywords` is not limited to Claude Code terms and covers agent skills plus MCP

### Green

- [x] 3.3 Rewrite the `description` and extend `keywords` to describe the multi-client bundle

### Refactor

- [x] 3.4 Review implementation and refactor as needed

## 4. Enforce the boundary
<!-- depends_on: 1, 2, 3 -->

Spec: `shipped-surface-boundary` — "The shipped tree contains only what a consumer needs". Design Decision 3. Added last so it grades a finished tree.

### Red

- [x] 4.1 Write failing test: the immediate children of `plugin/` all appear in a declared allowlist, and an entry outside it fails by name
- [x] 4.2 Write failing test: no `evals` directory, `grade.py`, or `evals.json` exists anywhere beneath `plugin/`
- [x] 4.3 Write failing test: the suite reads nothing outside `plugin/` — repository ergonomics are out of scope by construction, not by convention

### Green

- [x] 4.4 Add the boundary suite with the allowlist, each entry commented with who consumes it
- [x] 4.5 Run `pnpm test`, `pnpm lint`, `pnpm format`
- [x] 4.6 Run `pnpm build:plugin` and `pnpm test:plugin` to confirm the bundle still assembles and answers `tools/list` with the hook gone

### Refactor

- [x] 4.7 Review implementation and refactor as needed — the boundary suite passed on arrival because groups 1–3 had already cleaned the tree, so it was verified by violation instead: adding `plugin/STRAY.md` and re-adding `plugin/skills/formio-api/evals/` made it fail by name, then both were removed. Also corrected one over-strict rule — `${user_config.*}` inside `.claude-plugin/plugin.json` is that manifest's purpose, so the client-only-variable ban is scoped to shared files

## 5. Confirm what the skills CLI actually copies
<!-- depends_on: 1 -->

Design open question. Determines whether the eval finding affected the `npx skills add` route or only the npm/plugin-build route.

### Red

- [x] 5.1 Write failing test or scripted check: install this repository's plugin into a scratch directory via the `skills` CLI and record which files land — specifically whether non-skill files under `plugin/` travel

### Green

- [x] 5.2 Record the answer in `design.md`'s open question, and if the CLI copies only skill directories, note that the evals shipped through npm and the plugin bundle rather than through `npx skills add` — the fix stands either way

### Refactor

- [x] 5.3 Review implementation and refactor as needed — answered by a scratch-directory install rather than a committed test, since the probe depends on the `skills` CLI and on clone cleanliness; the finding and its false alarm are recorded in `design.md`

## 6. Untrack the initiative artifacts
<!-- depends_on: none -->

Spec: `shipped-surface-boundary` — "Initiative artifacts stay local, not committed"; `claude-plugin-release` — REMOVED "Marketplace submission state is recorded, not implied", ADDED "Review-gated submissions are never automated". Design Decision 3.

**Revised during apply:** the original tasks deleted the roadmap outright. Corrected to *untrack* it — it stays on disk, `.gitignore` keeps it out of the tree — and the marketplace checklist became a local `MARKETPLACE.md` rather than a hand-off, so it has a real home instead of living in a scratch directory. Tests assert what git tracks, never what exists on disk.

### Red

- [x] 6.1 Write failing test: `docs/multi-agent-portability.md` and `MARKETPLACE.md` are untracked and both are covered by `.gitignore`, while remaining present on disk
- [x] 6.2 Write failing test: no tracked file contains the string `multi-agent-portability` — searched with `git grep --cached` so the working-tree copy is deliberately not matched
- [x] 6.3 Write failing test: `.gitignore` states why each artifact is local rather than listing bare paths

### Green

- [x] 6.4 Write the preserved submission checklist to `MARKETPLACE.md` — the P1–P8 plugin channels and M1–M6 MCP channels with owner and status, plus the per-channel gate list — untracked, with a header explaining why it is local
- [x] 6.5 `git rm --cached docs/multi-agent-portability.md` and add both artifacts to `.gitignore` with the reasoning inline
- [x] 6.6 Restate the reference in each of the ten citing files rather than redirecting it: `prompt-multi-agent.md`, `package-as-agent-plugin/{proposal,tasks}.md` and its `claude-plugin-release` spec, `neutralize-core-for-multi-agent/{proposal,design,tasks}.md` and its `formio-angular-skill` spec, and `neutralize-skills-for-multi-agent/{proposal,design}.md`. Each becomes the fact it was fetching — a gap identifier, a risk, a phase name — stated inline
- [x] 6.7 ~~Confirm `docs/` is empty and remove the directory~~ — not applicable: the file stays on disk, so `docs/` stays too, with zero tracked files in it
- [x] 6.8 Re-ran `openspec validate` on all four changes — `neutralize-core-for-multi-agent`, `package-as-agent-plugin`, `neutralize-skills-for-multi-agent`, `prune-shipped-surface` — all valid

### Refactor

- [x] 6.9 Review implementation and refactor as needed — Phase 1's `claude-plugin-release` requirement was also edited in place (it named the file as the tracking location), so the in-flight artifact no longer points at something the repo does not ship
