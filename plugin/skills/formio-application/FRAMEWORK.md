# FRAMEWORK — Registry and routing

This document is loaded by the parent `formio-application` skill during Step 4. It is **not** a standalone skill — no frontmatter.

## The registry

Routing is driven by this table. Rows are data; adding a framework is a table edit, not a code change.

Exactly one row carries `Default: yes`. Each row's Detection signal tests **only for its own framework's presence** — a signal that excludes another framework (`react` AND no `angular.json`) collapses the multi-match case into a single match and makes the tie-break below unreachable.

| Framework | Entry skill | Extend sub-skill (nested file path under Entry skill) | Detection signal | Default |
| --- | --- | --- | --- | --- |
| Angular | `formio-angular` | `formio-angular-resources` — nested at `formio-angular/formio-angular-resources/SKILL.md` | `angular.json` in workspace root OR `@angular/core` listed in `package.json` dependencies | yes |
| React | `formio-react` | `formio-react-resources` — nested at `formio-react/formio-react-resources/SKILL.md` | `react` listed in `package.json` dependencies | no |

**Important:** the "Extend sub-skill" column names a **nested file inside the Entry skill's directory**, not a separately-registered top-level skill. Not every client resolves a nested name on its own — the Step 4 modify-existing logic below loads the file by path (e.g., `plugin/skills/formio-angular/formio-angular-resources/SKILL.md`) and follows its instructions inline, the same way the Entry skill loads its own `SETUP.md` / `CONFIG.md` / `AUTH.md` companions. The name is preserved for documentation, eval tooling, and backward compatibility.

When a future change adds a framework skill (Vue, Svelte, etc.), it adds a row to this table with the framework's entry skill, extend sub-skill, detection signal, and `Default` cell. No edit to `SKILL.md` or to the routing logic below is required.

## Step 4a — `frontend-design` pre-check (runs on BOTH branches, before routing)

Every framework skill authors user-facing UI and is dramatically better at it when the `frontend-design` skill is available — without it, generated UI tends toward generic, templated output.

**Detect it by the skill, not by one client's prefix.** `frontend-design` is a portable Agent Skill, so its registered name depends on the client that installed it: it may appear as the bare `frontend-design` or in a client-namespaced form such as `frontend-design:frontend-design`. Check your skill list for any of those forms and treat a match as available. Do not check for one form only.

- **If present** → note it ("`frontend-design` is available — the UI will be designed with it") and continue to 4b with `frontendDesignStatus: 'available'` in the handoff.
- **If missing** → it is strongly recommended but not required. Ask, in ONE question round using the client's structured question mechanism (in Claude Code, `AskUserQuestion`), whether to install it first or proceed without it. Frame it honestly: installing produces a far more polished, distinctive interface; proceeding without it is supported and every UI file will be flagged so the user can review it critically.
  - **Install it first** → `frontend-design` ships at <https://github.com/anthropics/claude-plugins-public/tree/main/plugins/frontend-design> and installs like any other Agent Skill, by whatever route this client uses to add skills. Tell the user where it lives, let them install it, and re-run 4a when they say to continue — do not prescribe one client's install command.
  - **Proceed without it** → continue to 4b with `frontendDesignStatus: 'declined'`. The framework skill applies the Bootstrap 5 brief from [`formio-angular/BOOTSTRAP.md`](../formio-angular/BOOTSTRAP.md) Step 7d inline and discloses on every UI approval gate that the file was generated without `frontend-design` consultation.

Either way the UI gets a deliberate visual direction. Do NOT silently emit plain UI — declining is a different path, never a licence to ship unstyled output.

## Step 4 logic

### Build-new branch

1. Count the active rows in the registry.
2. **If exactly one row:** route silently to that row's Entry skill. Pass the handoff context (workspace path, `projectUrl`, `baseUrl`, `template.md` path, `template.json` path, import-succeeded flag). The user is NOT asked which framework — when only one is installed, the choice is obvious.
3. **If multiple rows:** ask the user to pick, in ONE question round using the client's structured question mechanism (in Claude Code, `AskUserQuestion`). Ask "Which UI framework should I build this in?" and offer one option per active registry row, each described in terms of what it generates — for Angular, "Generate an Angular workspace using `@formio/angular`"; for React, "Generate a Vite + React Router workspace using `@formio/react`". Route based on the answer.

   **Present the `Default: yes` row first and label it the default.** The question must be a real choice, not a confirmation of a decision already taken: do not name a framework as chosen in the prompt, and start no framework work before the answer arrives.

   **The default resolves the question only when the user declines to choose** — an explicit "no preference", "you pick", "whatever you recommend", a non-answer, or a dismissed round. It is NOT a licence to skip asking. Whenever the default resolves the choice, say which framework you are proceeding with, so a user who did not mean to defer can correct it before a workspace exists.

   A user who named a framework in their original request has already answered; skip the round. (Framework-explicit phrasing usually routes to the framework skill directly and never reaches Step 4.)

### Modify-existing branch

Detection path — inspect the workspace to find out which framework is already installed:

1. For each row in the registry, check whether the Detection signal matches the workspace (file exists, dependency present, etc.).
2. **Exactly one match:** load the file at that row's "Extend sub-skill" path (e.g., `plugin/skills/formio-angular/formio-angular-resources/SKILL.md` for Angular) and follow its instructions inline — do NOT attempt to invoke it by its frontmatter name as if it were a separate top-level skill. Pass the handoff context (workspace path, the user's plain-language request, delta `template.md` path, delta `template.json` path, list of newly-imported resource names from Step 2's stash). The Extend sub-skill reads URLs from the workspace's own generated config — `FormioAppConfig` in `src/app/config.ts` for Angular, `src/config.ts` for React — so URLs are NOT in the handoff. The delta template pair IS — the sub-skill needs `template.md` for intent and `template.json` for structured field shapes when scaffolding the new resources.
3. **Multiple matches** (a workspace carrying both `angular.json` and a `react` dependency): ask the user to pick in one question round, same shape as the build-new multi-framework case. Never resolve a multi-match by the table's row order — signal order must not decide which framework a user's existing application is treated as.

   The framework-preference question belongs to build-new only. On this branch the framework is a fact about the workspace, detected rather than asked; the multi-match tie-break is a different question with a different cause.
4. **Zero matches:** the workspace does not have a recognized framework installed. Two sub-cases:
   - Workspace is empty — the user probably meant build-new. Bounce back to Step 1: "I don't see an existing app in this directory — did you mean to build a new one?"
   - Workspace has non-framework code — tell the user we couldn't detect a supported framework, list the ones in the registry, and ask them to pick. Accept their pick but warn that the extend sub-skill may fail if the workspace does not meet its expectations.

## How to add a new framework

When a future change adds a new framework skill (e.g., `formio-vue`):

1. The new framework skill's PR authors its own `skills/formio-vue/SKILL.md` + sub-skills + sibling docs, independent of this registry.
2. In the same PR, add one row to the table above, with all five cells — the `Default` cell included, and set to `no`. Exactly one row carries `Default: yes`, and changing which one is a separate decision from adding a framework:
   ```
   | Vue | formio-vue | formio-vue-resources | `vue` listed in `package.json` dependencies | no |
   ```
3. Verify that the new row's Entry skill and Extend sub-skill accept the same handoff context shape as Angular does (workspace path, URLs, `template.md` path, `template.json` path, import flag for Entry; workspace path, plain-language request, delta `template.md` path, delta `template.json` path, newly-imported resource names for Extend). If they don't, update the new framework skill — the orchestrator does not adapt.
4. Run `npm test` — the framework-registry tests should now cover the new row.

That is the entire integration point. No edit to `SKILL.md`, no edit to `INTENT.md` / `IMPORT.md`, no new routing logic. Adding a framework is a row.

## Handoff context reference

What each row's target skill receives when called by Step 4:

### Build-new → Entry skill

```
{
  workspacePath: string,               // absolute
  formioProjectUrl: string,            // no trailing slash
  formioBaseUrl: string,               // no trailing slash
  templateMdPath: string,              // absolute, planner's template.md (architectural-intent seed)
  templateJsonPath: string,            // absolute, planner's template.json (structured companion)
  importStatus: 'succeeded' | 'skipped' | 'failed-user-chose-continue',
  frontendDesignStatus: 'available' | 'declined'  // from Step 4a's frontend-design pre-check
}
```

The Entry skill uses this to load the template pair (both files on disk — `template.md` for intent, `template.json` for shape) and move quickly through its own phases. It does NOT skip SETUP: SETUP confirms the project against `project_get`, because the handed-in URLs are a copy and the mapping is what the generated `config.ts` has to agree with.

### Modify-existing → Extend sub-skill

```
{
  workspacePath: string,               // absolute
  userRequest: string,                 // verbatim plain-language request
  templateMdPath: string,              // absolute, planner's delta template.md
  templateJsonPath: string,            // absolute, planner's delta template.json
  newResourceNames: string[],          // machine names of the resources added by this delta
  frontendDesignStatus: 'available' | 'declined'  // from Step 4a's frontend-design pre-check
}
```

The Extend sub-skill reads URLs from the workspace's own generated config — `src/app/config.ts` for Angular, `src/config.ts` for React, and each framework skill names its own — and interprets the user's request in framework-native terms, using the delta template pair to scaffold exactly the newly-added resources.
