# INTENT — Build-new vs. Modify-existing

This document is loaded by the parent `formio-application` skill during Step 1. It is **not** a standalone skill — no frontmatter, no independent trigger.

## The question

Ask in ONE question round, using the client's structured question mechanism (in Claude Code, `AskUserQuestion`), with exactly two explicit options plus a free-text answer for anything else. Do not add a third option — if your client does not offer free text automatically, say that the user can answer in their own words instead.

Ask: **"Are we building a new app, or extending one that already exists?"**

- **Build a new app** — "Start from your description, shape the data model, create the Form.io project resources, and scaffold a new application."
- **Modify / extend an existing app** — "Add a feature to an already-running application. We will plan only the new resources, additively import them into the existing Form.io project, and hand off to the framework's extend sub-skill to wire them up."

## When to skip the question

Skip Step 1 when the user's phrasing already settles the intent:

- **Build-new implied** when the user says "build me an X", "create a Y", "I need a tool that...", "spin up a Z", "stand up a W", bare domain archetypes ("task manager", "help desk"), or they just gave a plain-language app description with no mention of an existing workspace. Confirm with a one-sentence restatement ("Got it — building a new X app from scratch.") and proceed.
- **Modify-existing implied** when the user says "also track X", "add a way to see Y", "each Z should have a list of W", "let users also do V", "fix the X page", OR when the working directory contains an existing workspace (`angular.json`, `package.json` with framework deps). Confirm with a one-sentence restatement ("Got it — adding this to your existing app.") and proceed.

When the user's phrasing is genuinely ambiguous, ask the question.

## Downstream consequences

### Build-new branch

1. **Step 2 — Plan (full)** — `formio-resource-planner` produces the approved artifact pair `template.md` (architectural intent with Access Matrix + ER and Access Flow diagrams) and `template.json` (full project export with every resource, role, form, and action for the new app). The planner classifies each entity as a Resource (reusable data model) or a bespoke Form (purpose-specific data collection) — see `formio-resource-planner` → "Resources vs. Forms" — so survey-like / one-off intakes become forms, not resources. The planner's own Phase A → Phase B gate is the only gate needed.
2. **Step 3 — Deployment** — resolve the project already mapped to this working directory, or capture `FORMIO_BASE_URL` + `FORMIO_PROJECT_URL` in one question round and persist them with `project_set`.
3. **Step 4 — Import** — `project_import` of the full template into the (empty) project, in the same invocation as Step 3.
4. **Step 5 — Framework routing** — hand off to the framework's entry skill (`formio-angular` today).

Do not ask the user "do you want to plan first?" — the planner is an internal step. The user described an app; you plan it.

### Modify-existing branch

1. **Step 2 — Plan (delta)** — `formio-resource-planner` is invoked with the user's feature description AND a clear instruction that the project already exists: plan ONLY the new resources, fields, or actions required for the feature. The planner emits a delta artifact pair — `template.md` describing only the additions, and `template.json` containing only those additions — in the workspace; do not restate the existing project. Stash BOTH paths and the list of delta resource names for Step 5.
2. **Step 3 — Deployment** — **skipped.** Instead, read `FORMIO_PROJECT_URL` and `FORMIO_BASE_URL` from the workspace's `FormioAppConfig` (Angular: `src/app/config.ts`; other frameworks: per registry). Stash them as if Deployment had run.
3. **Step 4 — Import** — `project_import` of the delta template. Import is additive; new resources land alongside the existing project content, and existing resources are untouched unless their machine names collide (rare — the planner uses new names for new features).
4. **Step 5 — Framework routing** — detect the framework from the workspace and load its extend sub-skill file by path. For Angular that file is `plugin/skills/formio-angular/formio-angular-resources/SKILL.md` — a nested sub-folder of the `formio-angular` skill whose frontmatter name is `formio-angular-resources`. The nested name is preserved for documentation and eval tooling; it is NOT a separately-registered top-level skill, so load the file directly (read + follow its instructions inline) rather than trying to invoke it by name. Pass the workspace root, URLs, delta `template.md` path, delta `template.json` path, the list of newly-imported resource names, and the user's feature request verbatim.

Modify-existing does NOT skip the planner, does NOT skip import. It skips only Deployment, because the project URLs are a workspace-wide concern already settled by the existing app.

## Edge cases

- **User chose modify-existing but the working directory is empty.** There is no existing app to extend. Bounce back with a short message: "I don't see an existing app in this directory — did you mean to build a new one?" and re-prompt Step 1.
- **User chose build-new but there IS an existing app in the directory.** This is usually intentional (e.g., they want to start over in a sibling directory). Confirm once — "Heads up: this directory already has an app. Build-new will create a fresh workspace; would you like to use a different directory, overwrite, or cancel?" — and let them choose.
- **Modify-existing, but the delta resource name collides with an existing resource.** The planner should rename the delta resource (add a qualifier), because `project_import` would otherwise overwrite the existing one. Surface the collision to the user with the proposed rename before Step 4.
- **User answered in their own words instead of picking an option.** Interpret the reply. If it sounds like build-new, proceed build-new; if modify-existing, proceed modify-existing. If it is a third case we cannot route (e.g., "I just want to see my data"), say so and suggest the right skill (`formio-api/references/runtime-reports`, etc.).

## What to stash for later steps

Stash the answer as an intent flag (`build-new` or `modify-existing`) that downstream steps read:

- Build-new → run every step 2–5.
- Modify-existing → run step 2 (planner in delta mode), skip step 3, run step 4 (additive import), run step 5 (extend sub-skill).
