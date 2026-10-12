# FRAMEWORK — Registry and routing

This document is loaded by the parent `formio-application` skill during Step 4. It is **not** a standalone skill — no frontmatter.

## The registry

Routing is driven by this table. Rows are data; adding a framework is a table edit, not a code change.

Exactly one row carries `Default: yes`. Each row's Detection signal tests **only for its own framework's presence** — a signal that excludes another framework (`react` AND no `angular.json`) collapses the multi-match case into a single match and makes the tie-break below unreachable.

| Framework | Entry skill | Extend sub-skill (nested file path under Entry skill) | Detection signal | Default |
| --- | --- | --- | --- | --- |
| Angular | `formio-angular` | `formio-angular-resources` — nested at `formio-angular/formio-angular-resources/SKILL.md` | `angular.json` in workspace root OR `@angular/core` listed in `package.json` dependencies | yes |
| React | `formio-react` | `formio-react-resources` — nested at `formio-react/formio-react-resources/SKILL.md` | `react` listed in `package.json` dependencies | no |

**Important:** the "Extend sub-skill" column names a **nested file inside the Entry skill's directory**, not a separately-registered top-level skill. Not every client resolves a nested name on its own — the Step 4 modify-existing logic below loads the file by path (e.g., `../formio-angular/formio-angular-resources/SKILL.md`, relative to this file) and follows its instructions inline, the same way the Entry skill loads its own `SETUP.md` / `CONFIG.md` / `AUTH.md` companions. The name is preserved for documentation.

Routing reads only this table; every row is handled by the logic below.

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
2. **If exactly one row:** route silently to that row's Entry skill. Pass the build-new payload in "Handoff context reference" below. The user is NOT asked which framework — when only one is installed, the choice is obvious.
3. **If multiple rows:** ask the user to pick, in ONE question round using the client's structured question mechanism (in Claude Code, `AskUserQuestion`). Ask "Which UI framework should I build this in?" and offer one option per active registry row, each described in terms of what it generates — for Angular, "Generate an Angular workspace using `@formio/angular`"; for React, "Generate a Vite + React Router workspace using `@formio/react`". Route based on the answer.

   **Present the `Default: yes` row first and label it the default.** The question must be a real choice, not a confirmation of a decision already taken: do not name a framework as chosen in the prompt, and start no framework work before the answer arrives.

   **The default resolves the question only when the user declines to choose** — an explicit "no preference", "you pick", "whatever you recommend", a non-answer, or a dismissed round. It is NOT a licence to skip asking. Whenever the default resolves the choice, say which framework you are proceeding with, so a user who did not mean to defer can correct it before a workspace exists.

   A user who named a framework — in the original request, or because a framework skill routed the request here for planning — has already answered; skip the round and route to that row. (Framework-named work on an already-planned project goes to the framework skill directly and never reaches Step 4.)

### Modify-existing branch

Detection path — inspect the workspace to find out which framework is already installed:

1. For each row in the registry, check whether the Detection signal matches the workspace (file exists, dependency present, etc.).
2. **Exactly one match:** load the file at that row's "Extend sub-skill" path (e.g., `../formio-angular/formio-angular-resources/SKILL.md` for Angular, relative to this file) and follow its instructions inline — do NOT attempt to invoke it by its frontmatter name as if it were a separate top-level skill. Pass the modify-existing payload in "Handoff context reference" below. The Extend sub-skill resolves the project with `project_get` and reconciles it against the workspace's own generated config — `FormioAppConfig` in `src/app/config.ts` for Angular, `src/config.ts` for React — so URLs are NOT in the handoff. The delta template pair IS — the sub-skill needs `template.md` for intent and `template.json` for structured field shapes when scaffolding the new resources.
3. **Multiple matches** (a workspace carrying both `angular.json` and a `react` dependency): ask the user to pick in one question round, same shape as the build-new multi-framework case. Never resolve a multi-match by the table's row order — signal order must not decide which framework a user's existing application is treated as.

   The framework-preference question belongs to build-new only. On this branch the framework is a fact about the workspace, detected rather than asked; the multi-match tie-break is a different question with a different cause.

4. **Zero matches:** the workspace does not have a recognized framework installed. Two sub-cases:
   - Workspace is empty — the user probably meant build-new. Bounce back to Step 1: "I don't see an existing app in this directory — did you mean to build a new one?"
   - Workspace has non-framework code — tell the user we couldn't detect a supported framework, list the ones in the registry, and ask them to pick. Accept their pick but warn that the extend sub-skill may fail if the workspace does not meet its expectations.

## Handoff context reference

The one contract for what Step 3.5 and Step 4 hand on; every other file links here rather than restating it. **No payload carries a URL.** `workspacePath` is the `cwd` the Step 3 Preflight's `project_get` reported — the directory the import ran for, and on the build-new branch the directory the application is built in. Every receiver calls `project_get` with `cwd` set to that same directory, so it reads the same record rather than a copy of it — a copy would give the receiver two authorities and no way to tell which was stale.

| | Build-new → Entry skill | Modify-existing → Extend sub-skill | Step 3.5 → `formio-auth` |
| --- | --- | --- | --- |
| Fields | `workspacePath`, `templateMdPath`, `templateJsonPath`, `importStatus`, `frontendDesignStatus` | `workspacePath`, `userRequest`, `templateMdPath` (delta), `templateJsonPath` (delta), `newResourceNames`, `frontendDesignStatus` | `templateMdPath` (its `Users & Auth` section is the requirements source), `workspacePath` |
| URLs | none | none | none |
| Resolves the project | the Entry skill's SETUP: `project_get` with `cwd` = `workspacePath` | the Extend sub-skill: `project_get` with `cwd` = `workspacePath`, reconciled against the workspace's own config | `formio-auth`'s preflight: `project_get` with `cwd` = `workspacePath` |

### Build-new → Entry skill

```
{
  workspacePath: string,               // absolute
  templateMdPath: string,              // absolute, planner's template.md (architectural-intent seed)
  templateJsonPath: string,            // absolute, planner's template.json (structured companion)
  importStatus: 'succeeded' | 'skipped' | 'failed-user-chose-continue',
  frontendDesignStatus: 'available' | 'declined'  // from Step 4a's frontend-design pre-check
}
```

The Entry skill uses this to load the template pair (both files on disk — `template.md` for intent, `template.json` for shape) and move quickly through its own phases. It does NOT skip SETUP: SETUP is where the project is resolved, with `project_get` for `workspacePath`, on every path.

### Modify-existing → Extend sub-skill

```
{
  workspacePath: string,               // absolute
  userRequest: string,                 // the plain-language request, quoted as a requirements block
  templateMdPath: string,              // absolute, planner's delta template.md
  templateJsonPath: string,            // absolute, planner's delta template.json
  newResourceNames: string[],          // machine names of the resources added by this delta
  frontendDesignStatus: 'available' | 'declined'  // from Step 4a's frontend-design pre-check
}
```

The Extend sub-skill resolves the project with `project_get` for `workspacePath` and reconciles it against the workspace's own generated config — `src/app/config.ts` for Angular, `src/config.ts` for React, and each framework skill names its own — and interprets the user's request in framework-native terms, using the delta template pair to scaffold exactly the newly-added resources.
