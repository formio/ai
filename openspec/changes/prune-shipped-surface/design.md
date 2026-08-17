## Context

`.claude-plugin/marketplace.json` declares `source: "./plugin"`, and `scripts/build-plugin.ts` copies that tree wholesale (`copyStatic`, filtering only `__pycache__`). So `plugin/` **is** the shipped artifact, by both the plugin-build route and the `skills` CLI route — and the two do not even agree: the build filters `__pycache__`, the CLI reads the source tree directly and would carry it, saved only by `.gitignore`.

Nothing asserts what belongs in that tree, and three things drifted in: eval harnesses (12 tracked files, ~148KB), `plugin/hooks/` (Claude-Code-only, now unreferenced), and npm metadata still describing a Claude Code plugin.

The distinction this change rests on — and which earlier portability work blurred — is between **the shipped surface** and **this repository's ergonomics**. The former must serve any client. The latter may favour Claude Code freely, because its audience is a maintainer of this library, not a user of it. `CLAUDE.md`, `.claude/`, `.cursor/`, `.github/prompts/`, and `openspec/` sit on the ergonomics side and are untouched here.

A second kind of residue is public without being shipped: `docs/multi-agent-portability.md`, the roadmap that drove this initiative. It is not a portability problem — it is a public-repository problem, and it is in scope for the same reason the rest is.

## Goals / Non-Goals

**Goals:**

- `plugin/` contains only what a developer needs in their own project.
- The boundary is enforced by a test, by allowlist, so a new file must be classified deliberately.
- The eval harnesses keep working, at their new location, with no loss of capability.
- Nothing in the public tree describes intentions rather than the system.
- Removing the hook loses no behaviour that is not already carried elsewhere.

**Non-Goals:**

- Any change to this repository's own agent ergonomics. Explicitly not in scope: `CLAUDE.md` naming, the `.claude/commands` / `.cursor/commands` / `.github/prompts` triplication, the tracked `.claude/skills/formio-*` symlinks, or the size of `openspec/`.
- Any change to a skill's content. Only what travels alongside the skills.
- The missing `.codex-plugin/plugin.json`. The Phase 1 plan called for one and only `.claude-plugin` and `.cursor-plugin` exist; that is unfinished work for whichever change completes Phase 1, not cruft to prune.

## Decisions

### 1. Move the harnesses out rather than filter them at packaging

Two ways to stop shipping the evals: relocate them, or leave them in `plugin/skills/**/evals/` and exclude them at packaging time.

Exclusion was rejected because there are two shipping routes and only one is ours. `build-plugin.ts` we control — a filter there is trivial. The `skills` CLI reads `./plugin` directly, and whether it honours any exclusion mechanism is unverified; if it does not, the files keep shipping and the fix is an illusion. Relocation needs no mechanism to be trusted by anyone.

The cost is real but bounded: `grade.py` resolves the repository root by counting five parents from its own location, so each grader needs its depth corrected; both runbooks carry relative paths; and `CLAUDE.md` documents the `skills/<skill>/evals/` convention in four bullets. All mechanical, all verifiable by running the graders afterwards.

`packages/skill-tests/evals/<skill>/` keeps the `.eval-artifacts/<skill>/` output convention unchanged and puts the harnesses beside `packages/skill-tests/src/`, the repository's other maintainer-facing test tree.

**Revised after review.** They first landed at `evals/` in the repository root. Grouping them under `packages/skill-tests/` is the better home: the package is already the place a reader looks for "tests that check the skills", it is `private: true` so nothing here can reach npm, and its `tsconfig` (`include: ["src", "vitest.config.ts"]`) and Vitest glob (`src/**/*.test.ts`) both scope to `src/`, which makes a sibling `evals/` inert to type-checking and to the test run rather than something that has to be excluded.

`openspec/` was considered and rejected. The CLI tolerates extra directories there — verified — but that space is tool-owned (`openspec new change` and `openspec archive` create and move directories in it), everything under it is transient by design while a harness is permanent, and its subject is what the system should do rather than how well a skill performs.

### 2. Delete the hook rather than repair it

The hook could be kept and taught to respect `FORMIO_PROJECT_URL` from the server environment, which would fix the deny-conflict. Rejected, because the conflict is the smaller problem.

What remains after the fix is a Claude-Code-only file in the shipped tree, duplicating guidance the server already gives every client at initialize, with no skill referencing it. Phase 1's own requirement for scoping the hook to one manifest argued that "correctness for clients without hooks is carried by the server's actionable project-resolution error" — that reasoning now covers Claude Code too, so the hook's remaining value is a convenience prompt that `formio-mcp-setup` and Deployment both provide.

This is breaking for one population: Claude Code plugin users who relied on the `SessionStart` prompt offering their configured default project URL. They configure through the setup skill or the Deployment step instead, both of which resolve an existing mapping before asking. Called out as BREAKING in the proposal.

### 3. The roadmap goes; the change set is the record

`docs/multi-agent-portability.md` is planning scaffolding for one initiative. Keeping it has a specific cost: a reader cannot tell a finished plan from a live one, so a public repository accumulates documents that describe intentions rather than the system. The OpenSpec change set already carries the durable version — motivation in each proposal, decisions and rejected alternatives in each design, preserved on archive — and it carries it per change rather than as one file that has to be edited to stay true.

Phases 3 through 5 were described there and are not done. They do not become undiscoverable: they get proposed as changes when someone picks them up, which is how every change in this repository starts. The audit and gap list are the part with genuinely no future use — they described a state of the world in August 2026 that Phases 0 through 2 have already changed.

The one thing worth keeping is the marketplace-submission checklist, because it tracks live third-party review queues rather than describing past work. It is handed to the maintainers rather than relocated inside the repository: Phase 1 had made recording it a *requirement*, which turned a status that moves between releases into a committed file that goes stale. The release behaviour that requirement protected is real and is kept; the filing location is not something a spec should fix.

References are cleaned by restating rather than redirecting. Ten tracked files cite the roadmap; each citation is replaced with the fact it was fetching, so no artifact depends on a file that no longer exists.

### 4. Allowlist, not denylist

A denylist test ("no `evals/` under `plugin/`") catches today's drift and nothing else. An allowlist of `plugin/`'s top-level entries fails whenever anything new appears, forcing a deliberate decision about whether it ships. That is the property worth having, since all three findings here entered by nobody deciding.

The test asserts only on `plugin/`. It reads nothing under `.claude/`, `.cursor/`, `.github/`, `openspec/`, or `docs/`, which keeps the ergonomics boundary explicit in code rather than only in prose.

## Risks / Trade-offs

- **A relocated grader silently mis-resolves its paths and every future eval run is wrong.** → Run both graders against the existing `.eval-artifacts/` iterations after the move and confirm identical scores to the runs recorded in `neutralize-skills-for-multi-agent`'s `eval-evidence.md`. Same artifacts, same grader logic, different file location: any difference is a path bug.
- **Deleting the hook removes a prompt some users depend on.** → Documented as BREAKING with the four replacements named. The replacements are already shipped, not planned.
- **This change removes a requirement introduced by an unarchived sibling change.** `agent-plugin-packaging`'s "Hooks remain a Claude-only component" lives in `package-as-agent-plugin`, which is still open on PR #47. → The delta is filed against that capability and this change depends on that one; the two must archive in order, and this branch is cut from the Phase 2 work rather than from `main`.
- **Deleting the roadmap loses the Phase 3-5 plan.** → Accepted deliberately. Those phases become proposals when they are picked up. The submission checklist, the only operationally live section, is preserved and handed over before deletion.
- **A restated reference drifts from what the roadmap actually said.** → The restatements are facts already asserted elsewhere in the same artifacts (gap identifiers, risk numbers, phase names), so each can be checked against the change it belongs to rather than against the deleted file.
- **The allowlist becomes a nuisance that people edit reflexively.** → Keep it short and comment each entry with who consumes it, so extending it requires stating an audience.

## Migration Plan

1. Hand over the preserved submission checklist, then delete `docs/multi-agent-portability.md` and restate its ten references.
2. Move both eval directories; correct `grade.py` depth, both runbooks, and `CLAUDE.md`.
3. Run both graders against existing artifacts and compare against `eval-evidence.md`.
4. Delete `plugin/hooks/`, drop `hooks` from `files[]`, and remove the hook assertions from `plugin-manifests.test.ts`.
5. Correct the npm description and keywords.
6. Add the boundary test last, so it grades a finished tree.
7. `pnpm test`, `pnpm lint`, `pnpm format`, and `pnpm build:plugin` + `pnpm test:plugin` to confirm the bundle still assembles and answers `tools/list`.

Rollback is a revert; nothing persists outside the repository.

## Resolved during implementation

- **The `skills` CLI copies skill directories, not `plugin/` verbatim.** Probed by installing this repository into a scratch directory: 117 files landed, all inside skill directories, with no `evals/`, no `grade.py`, and no other non-skill file from `plugin/`. So the eval harnesses shipped through **npm and the plugin bundle**, not through `npx skills add`. That lowers the severity of the finding — a `skills`-only consumer never received them — and changes nothing about the fix, since the npm bundle is the route most marketplace installs use.
- **The probe also surfaced a false alarm worth recording.** It installed 18 skills, including this repository's own `openspec-*` and `tdd-*` tooling, which appears to contradict `skills-cli-distribution`'s assertion that no such skill is offered. It does not: those directories have zero tracked files and exist only in a working copy where the OpenSpec CLI has regenerated them. A clean clone has none, so a real install is unaffected. Anyone re-running this probe should do it from a fresh clone, or they will re-discover the same non-issue.

## Open Questions

- Should `userConfig.formio_base_url` stay **required** in the Claude manifest? Deleting the hook removed the only reader of `formio_default_project_url`, so that field is gone. `formio_base_url` still feeds `env.FORMIO_BASE_URL`, but a required install-time prompt is now redundant with `project set --base-url` and with the per-directory mapping, which carries its own base URL and wins over the environment value. Left required here because relaxing it is a separate install-UX decision.
