## Context

The library currently has one framework-specific parent skill, `formio-angular`, that claims both:

- Generic "build me an app" triggers (plain-language, framework-agnostic).
- Angular-specific file-generation behavior (`FormioAppConfig`, `FormioModule`, NgModule scaffolding).

This worked when Angular was the only choice. The moment a second framework skill lands (`formio-react`, `formio-vue`, etc.) the generic triggers collide:

- User says "build me a CRM" → which of `formio-angular` / `formio-react` / `formio-vue` activates? Whichever the loader scores highest, and the user has no reliable control over that.
- Each framework skill would need to re-implement the same plan/import/auth pipeline, duplicating logic and diverging over time.
- Framework detection (existing workspace has `angular.json` vs. `vite.config.ts`) is a cross-cutting concern that does not belong inside any one framework skill.

The way out is a framework-agnostic orchestrator — `formio-application` — that owns everything up to the point where framework-specific files get generated. Framework skills become pure implementors: they know how to turn an approved plan + Form.io credentials + a target directory into their framework's files. They do not own triggers like "build me an app".

Constraints:

- Claude Code's skill loader scores skills by `description`. Trigger-surface split must be rigorous: `formio-application` claims generic triggers, framework skills claim framework-explicit triggers, and there must not be overlap.
- The existing MCP auth flow (`packages/mcp-server/src/ensure-auth.ts`) and `project_import` tool (`packages/mcp-server/src/tools/project_import.ts`) are already fit for purpose — no MCP server code changes.
- `formio-resource-planner` is an existing skill. Its "does not call the MCP server" stance stays; the orchestrator calls MCP on the planner's behalf.
- Today only `formio-angular` exists as a framework skill. `formio-application` must work correctly with one framework AND be forward-compatible with N frameworks without changing its code (only data — a framework registry in `FRAMEWORK.md`).

Stakeholders: end users running vibe-coding build flows; developers later adding `formio-react`/`formio-vue`; the planner and framework-skill maintainers.

## Goals / Non-Goals

**Goals:**

- One entry point for "build me an app / extend my app" regardless of framework.
- Clear, non-overlapping trigger surfaces — orchestrator claims generic, framework skills claim framework-explicit.
- Internal steps match the user's stated sequence: Intent → URLs → Auth → Import → Framework handoff.
- Build-new branch drives `formio-resource-planner` internally (user does not have to know the planner exists).
- Modify-existing branch routes straight to the correct framework's extension sub-skill (skip planner + import).
- Forward-compatible with additional frameworks via a registry; adding `formio-react` requires no changes to `formio-application`'s prose — only a new registry entry.

**Non-Goals:**

- Not building `formio-react` in this change. The orchestrator is designed to accommodate it; the React skill itself is future work.
- Not adding auto-create-project behavior. If the target Project URL does not resolve, the orchestrator surfaces the error and points at `formio-api/references/platform-projects`.
- Not building cross-framework migration (Angular → React). Each framework is its own implementor; the orchestrator does not translate between them.
- Not introducing a new MCP tool. Reuses `project_import` and lazy-auth.

## Decisions

### Where `formio-application` sits in the skill graph

```
                                formio-application
                                   (orchestrator)
                                  /              \
                   build-new branch              modify-existing branch
                          |                              |
             formio-resource-planner               framework detection
                          |                         /           \
                      URL interview         formio-angular   formio-react (future)
                          |                       |                  |
                       MCP auth            formio-angular-        formio-react-
                          |                  resources                resources
                     project_import                 (framework-specific sub-skills)
                          |
                  framework selection
                          |
                    formio-angular (or future formio-react)
                          |
               formio-angular-resources
```

Key: `formio-application` is the sole claimant of generic triggers. Framework skills activate on framework-explicit triggers OR on handoff from `formio-application`.

### Trigger-surface split

| Skill | Triggers |
|---|---|
| `formio-application` | Plain-language, framework-agnostic. Build-new: "build me a CRM", "I need a tool to track X", "spin up an app for Y", bare domain archetypes. Extend-existing: "also track X", "add a way to see Y", "each Z should have a list of W". Explicitly: does NOT require "Angular", "React", "framework", "resource", "NgModule" etc. |
| `formio-angular` | Framework-explicit initial-build only. "build it in Angular", "Angular front-end for this project", "use Angular", "the Angular skill". Also: invoked by `formio-application` via handoff context. NOT generic build-an-app triggers. |
| `formio-angular-resources` | Framework-explicit extension only. "add an Angular module for X", "regenerate the Angular X resource module", "in my Angular app, wire Y to Z". Also: invoked by `formio-angular` via handoff. NOT generic extend-an-app triggers. |
| `formio-resource-planner` | Unchanged. Still fires on planning-only triggers. Also: invoked by `formio-application` on build-new branch. |

**Rationale:** the user's trigger phrase determines routing. Generic ("build me a CRM") → orchestrator. Framework-named ("build this in React", "Angular module for X") → framework skill directly. The loader never has to choose between two skills claiming the same phrase.

**Alternative considered:** have framework skills continue to claim generic triggers and rely on some external routing logic. Rejected — Claude Code has no such routing; the loader picks one skill and runs it. Whichever scores highest wins, which is non-deterministic as the library grows.

### Modify-existing branch

The user's Step 1 in the proposal is "build new vs. modify existing". On modify-existing:

- Skip planner (no new data model).
- Skip URL interview + auth + import (the existing app already has URLs wired via `FormioAppConfig`; no template delta to push).
- Go directly to framework detection + route to the framework's extend-an-app sub-skill (`formio-angular-resources` today).

**Framework detection for modify-existing:** inspect the workspace for framework signals — `angular.json` or `@angular/core` in `package.json` → Angular; `vite.config.*` with React deps or `next.config.*` → React; etc. If detection finds exactly one match, route there. If ambiguous, ask the user via `AskUserQuestion`. If no framework detected (empty workspace), fall back to the "more than one framework" behavior of Step 5.

**Rationale:** matches the user's stated flow (modify branch is purely extension). The `formio-angular-resources` sub-skill already knows how to add a feature to an existing workspace; the orchestrator's job is just to route there.

### Framework registry in `FRAMEWORK.md`

The framework list is data, not code. `FRAMEWORK.md` contains a table the skill reads at run time:

```md
| Framework | Entry skill | Extend sub-skill | Detection signal |
|---|---|---|---|
| Angular | formio-angular | formio-angular-resources | `angular.json` in workspace root OR `@angular/core` in `package.json` |
| (React, Vue, etc. — add rows here when the corresponding framework skill is added.) |
```

Step 5 logic:

- Read the table.
- If exactly one non-future row, route to that row's entry skill (or extend sub-skill on modify-existing branch).
- If multiple, present them in `AskUserQuestion`.

**Rationale:** adding a new framework is literally adding a row. No edit to `SKILL.md` body, no change to `formio-application`'s reasoning. Future `formio-react` author adds the row in the same PR that adds `skills/formio-react/`.

**Alternative considered:** have `formio-application` programmatically enumerate `skills/formio-*/` directories and filter by some convention. Rejected — skill dirs that don't implement the framework contract (e.g., `formio-api`, `formio-resource-planner`) would need to be filtered out, which pushes logic into prose instead of data. A registry table is explicit and auditable.

### Phase naming and doc structure

Matches the `formio-angular` pattern of `SKILL.md` + sibling docs:

- `SKILL.md` — overview + step order + handoff contracts.
- `INTENT.md` — the build-vs-modify interview script.
- `DEPLOYMENT.md` — the Base URL + Project URL interview, including plain-language descriptions, example values, and the batched `AskUserQuestion` shape.
- `IMPORT.md` — the `project_import` invocation, pre-auth messaging, confirmation gate, and the three error branches (401/403, 404, 400).
- `FRAMEWORK.md` — the framework registry table + routing logic.

**Rationale:** same structure as `formio-angular` so contributors only have to learn one pattern. Keeps `SKILL.md` short; detail lives in the siblings.

### `formio-angular` demotion

Concrete changes to `formio-angular`:

- **Frontmatter `description`:** rewrite to claim only framework-explicit triggers ("build it in Angular", "Angular front-end for this Form.io project", "use Angular") + "invoked by `formio-application` via handoff context". Drop all generic "build me an app" phrasing.
- **Body Phase 0 (Inference):** deleted. Planner handoff moves to `formio-application`.
- **Body Phase "Import":** not added (never made it in; this change supersedes the prior proposal). Import lives in `formio-application`.
- **Body SETUP:** gains a "handoff mode" — when `formio-application` invokes the skill with URLs already captured, skip the URL interview and just confirm the URLs with the user.
- **Body intro:** rewritten to describe the skill as "called by `formio-application` when the framework is Angular" rather than "the default build-an-app skill".

Same pattern for `formio-angular-resources`:

- **Frontmatter `description`:** drop plain-language "also track X" / "add Y" triggers. Claim framework-explicit extend triggers only.
- **Body:** add a short "invoked from `formio-application`" path that accepts a handoff context.

### Planner writes `template.json` to disk

Same requirement as the superseded prior proposal. When planner is invoked by `formio-application` (or standalone), Phase B also writes `template.json` (or `template-<timestamp>.json` on collision) to the user's working directory.

**Rationale:** `formio-application`'s Import step passes a real file path to `project_import`. A real artifact on disk is also useful to standalone planner users.

### Authentication trigger

Same as superseded prior proposal. `formio-application`'s Step 3 is a messaging step: tell the user a browser window may open, then make an authenticated tool call (Step 4's `project_import`). MCP server's lazy-auth handles the rest. Cached-JWT case: no browser window, silent progression.

**Headless fallback:** `DEPLOYMENT.md` / `IMPORT.md` document how the orchestrator detects `DISPLAY=""` or equivalent and prints the portal-login URL for manual open.

### Change directory name: `add-formio-application-orchestrator`

The prior change (same scope, different design — Import baked into `formio-angular`) was named `integrate-planner-import-angular`. That name no longer describes the work. Renamed the directory in place before rewriting artifacts; no prior artifacts were shipped from the old name.

## Risks / Trade-offs

- **Trigger-surface regression between orchestrator and framework skill** → if both `formio-application` and `formio-angular` claim the phrase "build an Angular app", the loader has to pick one and may pick wrong. Mitigation: the trigger-surface split is explicit in both descriptions with literal `Not for:` clauses pointing at each other; tests assert that each description does NOT contain the forbidden phrases of the other. Also: whenever the user's phrase contains "Angular" verbatim, they have explicitly chosen the framework — routing to `formio-angular` is correct and the orchestrator's generic triggers do not claim Angular-explicit phrases.
- **Single-framework edge case feels verbose** → with only Angular in the registry, Step 5 is a no-op that still runs. Users may wonder "why did it ask me about framework?" Mitigation: Step 5's logic explicitly skips the `AskUserQuestion` when there is exactly one entry in the registry; it silently routes. The user sees nothing.
- **Modify-existing detection fails on a workspace without framework signals** → e.g., empty directory, or a workspace whose `package.json` doesn't have framework deps yet. Mitigation: fall back to asking the user, same as the multi-framework branch of Step 5. If the workspace is genuinely empty, the modify-existing branch was the wrong choice; re-prompt the intent step.
- **Planner coupling is implicit** → `formio-application` assumes the planner writes `template.json` to cwd. If a future planner change drops that behavior, Import silently breaks. Mitigation: planner's SKILL.md has an explicit requirement; the layout test asserts the documentation is present.
- **Description length ceiling** → `formio-application`'s description has to cover build-new + modify-existing + framework-agnostic + Not-for clauses pointing at multiple framework skills. The YAML folded-scalar trick already used for `formio-angular` handles this; the description just has to stay focused and not turn into a tutorial.

## Migration Plan

1. Author `skills/formio-application/` — `SKILL.md`, `INTENT.md`, `DEPLOYMENT.md`, `IMPORT.md`, `FRAMEWORK.md`.
2. Add `.claude/skills/formio-application` symlink.
3. Rewrite `skills/formio-angular/SKILL.md` frontmatter + body (drop generic triggers, remove Inference phase, add handoff-mode SETUP).
4. Rewrite `skills/formio-angular/resources/SKILL.md` frontmatter (drop plain-language extend triggers).
5. Update `skills/formio-resource-planner/SKILL.md` (Phase B writes `template.json` to cwd).
6. Update `CLAUDE.md` "Skills Library" section — name `formio-application` as the build-an-app entry point.
7. Extend `packages/mcp-server/src/__tests__/formio-angular-layout.test.ts` (or author a new `formio-application-layout.test.ts` alongside) with assertions for the new skill + demoted triggers.
8. Run `pnpm test && pnpm lint && pnpm format`.

Rollback: revert the PR. No DB / infra / runtime state.

## Open Questions

- Does `formio-application` need its own eval harness, or do we rely on the user seeing outcomes end-to-end? Recommendation: defer eval harness until `formio-react` lands — eval is most valuable when there are multiple routing branches to verify. Short-term, rely on manual end-to-end testing.
- Should `CLAUDE.md`'s "Iterating on skills" paragraph name `formio-application` as a candidate for eval harness, or leave it until an eval exists? Recommendation: mention it aspirationally with a "no eval harness yet" note, so contributors know where one would live.
- Does the single-framework branch of Step 5 need user-visible messaging ("routing to Angular — the only framework available") or is silent routing OK? Design currently says silent. Easy to flip to "say a one-sentence status update" if beta feedback wants it.
- When the user hits modify-existing on an empty workspace, do we bounce to build-new, or re-prompt Step 1? Current design: re-prompt Step 1 with "no existing app detected — did you mean to build new?". Keeps the user in control.
