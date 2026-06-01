## Why

The existing `formio-resource-angular` skill triggers on any "build an Angular app for Form.io" prompt and jumps straight into resource-module scaffolding. It assumes the surrounding Angular application — `FormioAppConfig`, the `auth/` module, the `AppModule` imports from `@formio/angular` — already exists and is correctly wired. For greenfield projects (the majority case after `formio-resource-planner` produces a `template.json`), that assumption is wrong: the Agent generates resource modules that silently fail at runtime because `FORMIO_TOKEN`, `FormioAuthConfig`, and the project URL were never configured. The user is then left debugging framework plumbing the skill should have generated first.

We need a parent orchestration skill that owns the full Angular+Form.io setup flow — URL interview → `AppConfig` → auth wiring → resource scaffolding — and only delegates to the resource skill once the application shell is in place.

## What Changes

- **NEW** parent skill `formio-angular` at `skills/formio-angular/` that is the single entry point for any "build an Angular app using Form.io" request. Contains:
  - `SKILL.md` — overview + orchestration order (SETUP → CONFIG → AUTH → resources)
  - `SETUP.md` — interview-style capture of `Project URL` and `Base URL`
  - `CONFIG.md` — `FormioAppConfig` / `config.ts` generation mirroring the `angular-demo` pattern
  - `AUTH.md` — `AuthModule` + `FormioAuthConfig` wiring driven by the `template.json` auth resources and roles from `formio-resource-planner`
  - `resources/` — the current `formio-resource-angular` skill moved inside, scoped to resource-module generation only
- **BREAKING** `formio-resource-angular` is no longer a top-level skill. Its directory (`skills/formio-resource-angular/`) is renamed/moved to `skills/formio-angular/resources/`. The symlink at `.claude/skills/formio-resource-angular` is removed; a new `.claude/skills/formio-angular` symlink is added pointing at `skills/formio-angular/`.
- **BREAKING** The resource skill's description is rewritten to use plain-language "extend an existing app" triggers ("also track X", "add a way to see Y", "each X should have a list of Y") that do NOT assume the user knows Form.io or Angular terminology. It triggers only (a) after the parent skill has completed SETUP/CONFIG/AUTH, or (b) when the user describes a new feature for an already-running app.
- **TRIGGER-SURFACE PHILOSOPHY** Both the parent and the sub-skill frame their triggers in plain domain language. Users are never expected to say "Form.io", "Angular", "resource", "module", or "CRUD" — the skills infer Form.io primitives from plain-language intent (via `formio-resource-planner`). Until another UI-framework skill joins this library, the parent `formio-angular` is the library's default "build me an app" skill; lack of an explicit framework in the user's request does NOT block activation, and Angular is the default framework.
- The resource skill's eval harness (`evals/`, `references/`, `assets/`) moves with it under `skills/formio-angular/resources/`. The `.eval-artifacts/formio-resource-angular/` artifact path is renamed to `.eval-artifacts/formio-angular-resources/` (or equivalent) so the grader keeps working.
- The parent skill references (by link) the two canonical sources of truth for the `angular-demo` pattern:
  - https://help.form.io/developers/introduction/application
  - https://github.com/formio/angular-demo (`src/app/config.ts`, `src/app/app-module.ts`, `src/app/auth/auth.module.ts`)
- `CLAUDE.md` updated to note the new skill location and that `formio-resource-planner` → `formio-angular` is the canonical handoff (not `formio-resource-planner` → `formio-resource-angular`).
- `packages/mcp-server/src/skills-validator.ts` updated so the schema/naming rules cover the new parent skill and its sub-documents (`SETUP.md`, `CONFIG.md`, `AUTH.md` are not SKILL.md files and must not be validated as such).

## Capabilities

### New Capabilities

- `formio-angular-skill`: Parent skill that owns the full "Angular app for Form.io" workflow — URL interview, `AppConfig` generation, auth-module wiring, and orchestrated handoff to the resource sub-skill. Defines the trigger surface, interview order, approval gates, and the contract the sub-skill consumes.

### Modified Capabilities

<!-- None. The resource-scaffolding behavior is being relocated, not re-specified;
     there is no existing `openspec/specs/` spec for it to delta against. Its new
     trigger-surface rules are captured inside the new `formio-angular-skill`
     capability as part of the parent→child delegation contract. -->

## Impact

- **Skills library:** `skills/formio-resource-angular/` moves to `skills/formio-angular/resources/`; new files `skills/formio-angular/{SKILL.md,SETUP.md,CONFIG.md,AUTH.md}` added.
- **Symlinks:** `.claude/skills/formio-resource-angular` removed; `.claude/skills/formio-angular` added (symlink to `../../skills/formio-angular`).
- **Skills validator:** `packages/mcp-server/src/skills-validator.ts` — relax/expand rules so non-`SKILL.md` sibling docs are permitted inside a skill dir, and so nested skill dirs (`resources/SKILL.md`) are discovered and validated.
- **Eval harness:** `skills/formio-angular/resources/evals/` path update; any hard-coded `formio-resource-angular` path in `evals/grade.py`, `evals/README.md`, or `.gitignore` rules for `.eval-artifacts/` renamed.
- **Docs:** `CLAUDE.md` updated to describe the new layout under "Skills Library" and "Iterating on skills".
- **Downstream callers:** anything that references the skill by name (`formio-resource-angular`) in conversation transcripts, docs, or agent prompts needs to be updated to `formio-angular` (or `formio-angular:resources` when referring to the sub-skill specifically).
- **User-facing behavior:** first-time Angular-app requests will trigger a 2-question setup interview (Project URL + Base URL) before any files are generated. Existing-app "add a resource" requests will route into the sub-skill exactly as today.
