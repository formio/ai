---
name: formio-angular
description: >-
  Angular framework implementor for the Form.io skill library — turns an approved `template.json` plus a target Form.io project into a working Angular application that uses `@formio/angular`. Invoked either (a) as a handoff from `formio-application` after it has captured URLs and imported the template, or (b) directly when the user explicitly names Angular. Claims ONLY Angular-explicit triggers — phrases that name Angular or `@formio/angular` verbatim. Example triggers this skill claims include "build it in Angular", "scaffold an Angular front-end for this Form.io project", "generate the Angular CRUD", "Angular front-end", "use Angular", "use `@formio/angular`", "the Angular skill", and "wire up `FormioAppConfig` in my Angular workspace". Does NOT claim framework-agnostic triggers (those go through `formio-application`). Runs a five-phase flow with an approval gate between each — (1) SETUP — capture the Form.io Project URL and Base URL via batched interview, UNLESS URLs are handed in by `formio-application` (in which case SETUP confirms and skips ahead); (2) BOOTSTRAP — when no Angular workspace is present in the working directory, install the Angular team's skill library (`npx skills add https://github.com/angular/skills --all -a claude-code -y`) and delegate to the installed `angular-new-app` skill to scaffold the workspace (with the Angular major pinned to whatever `@formio/angular`'s `peerDependencies` supports, resolved from `https://unpkg.com/@formio/angular/package.json`), then install `@formio/angular` + `@formio/js` + (unless the user opts out) Bootstrap 5 + Bootstrap Icons into it, register the Bootstrap stylesheets in `angular.json`'s build target, and ensure `zone.js` is present in `node_modules` and listed in `angular.json`'s `polyfills` entry (build + test targets) so the Form.io renderer's zone-based change detection does not crash with `Zone is not defined`; skipped when `angular.json` is already present; (3) CONFIG — generate `src/app/config.ts` exporting a typed `AppConfig` (of type `FormioAppConfig`) and wire it into `AppModule` per the `@formio/angular` demo; (4) AUTH — generate `src/app/auth/auth.module.ts` with `FormioAuthConfig` derived from the `template.json` user resource, login form, register form, and roles; (5) Resources — load the nested Resources sub-skill file at `./resources/SKILL.md` (a sub-folder of this skill, NOT a separate top-level skill) and follow its two-phase cadence for per-resource NgModule scaffolding. Does NOT scaffold the Angular workspace itself (that is `angular-new-app`'s job, invoked from the BOOTSTRAP phase), does NOT run its own planner-inference phase (planning is `formio-resource-planner`'s job, called by `formio-application`), and does NOT run its own template-import phase (template import into a Form.io project is `formio-application`'s job via the `project_import` MCP tool). Not for: generic, framework-agnostic app-construction requests — see `formio-application`. Not for: adding a single feature to an already-running Angular app when the user uses generic, framework-agnostic phrasing — that goes through `formio-application`'s modify-existing branch, which loads the nested `formio-angular-resources` sub-skill file at `./resources/SKILL.md` (a sub-folder of THIS skill, NOT a separately-registered top-level skill). Not for: Angular-explicit extension requests against an already-running Angular app — those are handled by loading the nested `formio-angular-resources` sub-skill file at `./resources/SKILL.md` under this skill. Not for: planning a data model in isolation — see `formio-resource-planner`. Not for: Form.io REST endpoint lookups — see the `formio-api` skill.
---

# Form.io + Angular — Framework Implementor

You are the Angular framework implementor for this skill library. You turn an approved `template.json` plus a target Form.io project into a working Angular application that uses `@formio/angular`. You do NOT decide what framework the user wants, you do NOT plan the data model, and you do NOT import the template into a Form.io project — those are the job of `formio-application` (the orchestrator) and `formio-resource-planner` (the planner), which run before you.

## Stance

- **Framework-specific, not orchestrator.** The library's generic "build me an app" entry point is `formio-application`. It decides (a) whether a new app is being built or an existing one extended, (b) which framework to use (Angular today, more later), (c) when to plan the data model, and (d) when to import. You are invoked AFTER those decisions. If a user reaches you directly by naming Angular explicitly ("build it in Angular", "use Angular"), honor that — otherwise, you arrive via handoff from `formio-application` with URLs + `template.json` already in hand.
- **Import is NOT this skill's responsibility.** Template import into a Form.io project via the `project_import` MCP tool lives in `formio-application`. You never call `project_import`. If the user invokes you directly and the target project has not yet been imported into, point them at `formio-application` instead of running the planner or calling the MCP tool yourself.
- **One phase at a time, left to right.** SETUP → BOOTSTRAP → CONFIG → AUTH → Resources. No jumping ahead. Each phase that writes files ends with an approval gate; a declined gate stops the flow.
- **Do not scaffold the Angular workspace yourself.** When the working directory does not yet contain an Angular workspace, BOOTSTRAP installs the Angular team's official skill library (`angular/skills`) and delegates to its `angular-new-app` skill. Do NOT call `ng new` directly, and do NOT hand-roll an `angular.json` / `package.json`. Leaning on the Angular team's skill keeps our scaffolding current as Angular evolves.
- **Accept handoff mode gracefully.** When `formio-application` invokes you with URLs already captured, SETUP confirms them with one short acknowledgement and advances to CONFIG — no re-interview. When you are invoked directly by a user with no handoff context, SETUP runs its full URL interview.
- **Skip what is already wired.** Before CONFIG, inspect `src/app/config.ts`; before AUTH, inspect `src/app/app.module.ts` for an existing `AuthModule`. If the phase's output already matches the expected values, skip it and tell the user which file triggered the skip.
- **The planner's `template.md` + `template.json` pair is the source of truth for AUTH.** When the pair exists, read the user resource, login form, register form, and roles from `template.md`'s `## Users & Auth` and `## Roles` sections and cross-check against the `template.json` `resources` / `forms` / `roles` keys — never invent. If the pair does not exist and no handoff context names one, point the user at `formio-application` (or `formio-resource-planner` if they only want to plan).
- **Delegate Resources by reading the sub-skill file.** Per-resource NgModule scaffolding, `FormioResourceConfig`, `FormioResourceRoutes()`, bidirectional joins, parent→child hierarchies, transitive group access — all of that lives in the nested file `./resources/SKILL.md`. This is a sub-folder of this skill, NOT a separately-registered top-level skill: load that file directly (same pattern as `SETUP.md`, `BOOTSTRAP.md`, `CONFIG.md`, `AUTH.md`) and follow its Phase A / Phase B cadence. Do not attempt to invoke a top-level skill named `formio-angular-resources` — there is no such skill; the name in the nested file's frontmatter is historical and refers to this same sub-skill.
- **Batch your questions.** When input is needed (URLs in SETUP handoff-free mode, auth strategy choices in AUTH), use one `AskUserQuestion` per phase.
- **NgModule-based, `standalone: false`.** Match the official `@formio/angular` demo. No standalone components anywhere in generated files.
- **Consult Claude's `frontend-design` skill for every UI decision.** Any file in this skill or its sub-skill that touches the user-facing surface — HTML templates, SCSS/CSS, component layout, spacing, typography, color, nav chrome, empty states, loading states, error states, list-vs-card layouts, form styling beyond `form-control` defaults, responsive behavior, accessibility (focus order, ARIA, contrast) — MUST load Claude's built-in `frontend-design` skill first and follow its guidance. Treat `frontend-design` the same way you treat `SETUP.md` / `CONFIG.md` / `AUTH.md`: a file you load before writing output. The rule applies to: Phase 5 Resources (every `resource.component.html`, `view/view.component.html`, and any per-resource SCSS), the AUTH-phase `app.component.html` nav chrome, any login/register component overrides, and any custom index / dashboard template the user asks for. Form-field styling that comes directly from the Form.io renderer's default Bootstrap 5 template is exempt — you do not override what the renderer already provides — but anything the skill itself authors outside the renderer's output is NOT exempt.
- **Always brief `frontend-design` with the Bootstrap 5 constraint.** When you load `frontend-design`, pass it an explicit context preamble so it does NOT default to Tailwind, custom utility CSS, or bespoke design-token systems — those would conflict with the Bootstrap 5 + Bootstrap Icons stack BOOTSTRAP installed. The preamble MUST state: (a) the stack is Bootstrap 5.x + Bootstrap Icons (`bi bi-*`) already wired via `angular.json` styles, (b) design recommendations must use Bootstrap 5's native utility classes (`row`, `col-*`, `d-flex`, `gap-*`, `mt-*`, `px-*`, `text-*`, `bg-*`, `rounded-*`, `shadow-*`, `border-*`, `card`, `card-body`, `card-header`, `btn`, `btn-primary`, `btn-outline-secondary`, `nav`, `nav-tabs`, `navbar`, `form-control`, `form-label`, `form-select`, `badge`, `alert`, `list-group`, `table`, etc.) and Bootstrap Icons class names, (c) custom CSS is allowed only for gaps Bootstrap cannot cover, and even then should extend Bootstrap's CSS variables (`--bs-primary`, `--bs-border-radius`, `--bs-body-color`, etc.) rather than introduce parallel tokens, (d) the Form.io renderer emits its own Bootstrap 5 markup for form fields and those must NOT be restyled, (e) NgModule components use `standalone: false` and `*ngIf` / `*ngFor` (not standalone control flow or Tailwind `@apply`). When a user request truly needs a non-Bootstrap system (e.g., "use Material instead"), that is a scope change — re-run BOOTSTRAP opt-out, not a `frontend-design` override.

## Inputs you expect

You are designed to work in three scenarios. All of them start with the data model already planned.

| Scenario                                                                    | Source of inputs                                                                                                                                                                                                    | What you do                                                                                                                  |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| **Handoff from `formio-application` (build-new)**                           | Orchestrator passes workspace path, `FORMIO_PROJECT_URL`, `FORMIO_BASE_URL`, `template.md` path, `template.json` path, and an `importStatus` flag.                                                              | Confirm the handoff context with a one-sentence acknowledgement, skip SETUP's interview (URLs are known), run BOOTSTRAP if the workspace path is an empty directory, then proceed to CONFIG. |
| **Direct invocation with an approved `template.md` + `template.json` in scope** | User has run the planner (and typically `formio-application` + import) themselves and is now explicitly asking for the Angular build. Has an existing Angular workspace OR a fresh directory and the artifact pair. | Run pre-flight, then SETUP → BOOTSTRAP (if no `angular.json`) → CONFIG → AUTH → Resources.                                                                      |
| **Direct invocation against an existing partially-wired Angular workspace** | User asks to regenerate or fix the Angular scaffolding. Workspace has some of `config.ts` / `AuthModule` already.                                                                                                   | Run pre-flight, skip BOOTSTRAP (workspace already exists), skip the other phases whose outputs already exist, run only the missing ones.                                      |

If the user invokes you directly with a bare "build me an app" request and NO planner handoff, NO `template.md` / `template.json` pair, and NO explicit Angular phrasing — that is a `formio-application` case, not yours. Tell the user: "This looks like a build-from-scratch request — `formio-application` will run the planner, import the template, and then hand off to me. Shall I route you there?"

## Pre-flight (workspace inspection)

Before SETUP, do these reads so you don't ask questions the workspace already answers:

- Look for `angular.json` at the working-directory root (and/or `@angular/core` in a root `package.json`'s `dependencies`). **Absence of both is the BOOTSTRAP trigger** — the working folder does not yet contain an Angular workspace, so Phase 2 (BOOTSTRAP) will install the Angular skills library and delegate to `angular-new-app` to scaffold one.
- Look for `src/app/config.ts`. If it exports a symbol whose type is `FormioAppConfig` and has `appUrl` + `apiUrl`, capture those values.
- Look for `src/app/app.module.ts`. Check whether `FormioModule` and `FormioAppConfig` are imported and whether an `AuthModule` is imported.
- Look for the planner artifact pair `template.md` + `template.json` in the working directory or inside `src/` / `templates/`. Prefer `template.md` for reading the user resource, login form, register form, roles, and the access story in plain language; consult `template.json` for exact field JSON when `template.md` does not disambiguate. If only one of the two is present, proceed with what you have but call out the missing half to the user.
- If a workspace exists but doesn't contain any of the Form.io-specific wiring above, treat only those phases as missing and run them; BOOTSTRAP is still skipped because `angular.json` is present.
- If neither a workspace nor any Form.io wiring exists, run all five phases.
- Check whether Claude's `frontend-design` skill is available in the current session (listed as one of Claude's built-in skills). If yes, note that fact and remember to consult it whenever you author UI. If no, treat `frontend-design` as a hard dependency for later phases — BOOTSTRAP will install it alongside the Angular skills library (see `BOOTSTRAP.md`). Do NOT start generating UI in CONFIG / AUTH / Resources until `frontend-design` is loadable; the Stance bullet is not optional.

Surface your findings to the user in one short paragraph before the interview:

- Empty cwd: "This working folder is empty — I'll capture your Form.io URLs (SETUP), then install the Angular team's skills library and delegate to `angular-new-app` to scaffold the workspace (BOOTSTRAP), then wire Form.io into it (CONFIG, AUTH, Resources)."
- Existing workspace, partial wiring: "I see an existing workspace with `config.ts` wired for `https://X.form.io` but no `AuthModule`. I'll skip BOOTSTRAP and CONFIG, run SETUP (to confirm URLs), then AUTH, then load the Resources sub-skill at `./resources/SKILL.md`."

Pause for acknowledgement, then proceed.

## Phase 1 — SETUP

**Goal:** capture the Form.io `Project URL` (your project's API root, e.g., `https://abc.form.io`) and the `Base URL` (the Form.io platform deployment, e.g., `https://api.form.io`). These flow into `FormioAppConfig` as `appUrl` and `apiUrl` respectively.

**Handoff mode:** when `formio-application` invoked you and passed both URLs in the handoff context, DO NOT run the interview. Confirm the URLs with the user in one short acknowledgement ("Using Project URL `X`, Base URL `Y` that you gave me during the import step. Continuing to BOOTSTRAP.") and advance. No `AskUserQuestion`, no approval gate — the user already approved those values when they entered them upstream. If the handoff-supplied workspace already contains `angular.json`, BOOTSTRAP will self-skip and the next user-visible phase is CONFIG.

**Standalone mode:** when there is no handoff context (user invoked you directly), read [`SETUP.md`](./SETUP.md) for the full interview script, batched `AskUserQuestion` shape, URL validation rules, and the exact variable names these values are stored under (`FORMIO_PROJECT_URL`, `FORMIO_BASE_URL`) so CONFIG and AUTH can pick them up.

**Gate (standalone mode only):** print `Project URL = X, Base URL = Y. Proceed?` and wait for explicit approval. If the user declines, stop.

## Phase 2 — BOOTSTRAP

**Goal:** when the working folder does not yet contain an Angular workspace, install the Angular team's official skill library and delegate workspace creation to its `angular-new-app` skill. Then install `@formio/angular` + `@formio/js` into the freshly-scaffolded workspace so CONFIG can import from them, and — unless the user explicitly opted out — install Bootstrap 5 + Bootstrap Icons and register their stylesheets in `angular.json`'s build `styles` array so the Form.io renderer's default Bootstrap 5 template renders correctly. Finally, ensure `zone.js` is installed and listed in `angular.json`'s `polyfills` entry (on both `build` and `test` targets) — `@formio/angular` depends on Angular's zone-based change detection, and a workspace without the Zone.js polyfill boots with `Zone is not defined`.

**How:** read [`BOOTSTRAP.md`](./BOOTSTRAP.md) for the exact `npx skills add https://github.com/angular/skills --all -a claude-code -y` invocation, the handoff shape to `angular-new-app` (working directory, suggested project name derived from the Form.io Project URL, intent note), the post-scaffold verification checks (`angular.json`, `src/app/app.module.ts`, `package.json` with `@angular/core`), the `npm install --save @formio/angular` step, and the skip-if-already-scaffolded detection logic.

**Gate:** after `angular-new-app` reports success and `@formio/angular` is installed, print a one-block summary of what was scaffolded (workspace path, key files present, `@formio/angular` version installed) and wait for approval before advancing to CONFIG. If the user declines, stop — they may want to inspect the workspace before any Form.io files land in it.

**Skip condition:** if pre-flight detected an existing `angular.json` (or a root `package.json` with `@angular/core`), skip BOOTSTRAP entirely. Tell the user once ("Angular workspace already present — skipping BOOTSTRAP, continuing to CONFIG.") and advance. Do not re-run `npx skills add` on an already-scaffolded workspace.

## Phase 3 — CONFIG

**Goal:** generate `src/app/config.ts` exporting `AppConfig: FormioAppConfig` with `appUrl` = project URL and `apiUrl` = base URL, then wire it into `AppModule` via `{ provide: FormioAppConfig, useValue: AppConfig }` and import `FormioModule` from `@formio/angular`.

**How:** read [`CONFIG.md`](./CONFIG.md) for the `config.ts` code template, the `AppModule` edit shape, the preview-then-approve gate wording, and the skip-if-already-wired detection logic. `CONFIG.md` also links to the canonical `@formio/angular` documentation and the `angular-demo` reference files.

**Gate:** print a diff-style preview of the `config.ts` you are about to write and the additions to `AppModule`, then wait for approval. If the user declines, stop.

## Phase 4 — AUTH

**Goal:** generate `src/app/auth/auth.module.ts` configuring `FormioAuthConfig` from the `template.json` auth resources (user resource name, login form, register form) and roles, then import `AuthModule` into `AppModule`.

**How:** read [`AUTH.md`](./AUTH.md) for the `template.json` extraction rules, the `auth.module.ts` code template, the `AppModule` edit for the `AuthModule` import, the "no `template.json`" fallback (offer to run `formio-resource-planner`, or skip AUTH with a TODO pointing at `formio-api/references/runtime-auth` and `formio-api/references/platform-auth`), and the skip-if-already-wired detection logic.

**Gate:** print a preview of `auth.module.ts` citing the exact `template.json` values used (user resource name, login form, register form, roles), then wait for approval. If the user declines, stop.

## Phase 5 — Resources

**Goal:** per-resource NgModule scaffolding. One browsable resource, one NgModule, mounted with `FormioResourceConfig` + `FormioResourceRoutes()` from `@formio/angular`. Parent→child hierarchies are nested routes. Bidirectional N:N joins produce two sibling modules, each mounted under the opposite side's `:id/` view.

**How:** this phase is handled by the nested sub-skill file at [`resources/SKILL.md`](./resources/SKILL.md). The sub-skill lives as a sub-folder of THIS skill — it is NOT a separate top-level skill and must NOT be invoked by the name in its own frontmatter. Load `./resources/SKILL.md` the same way you loaded `SETUP.md`, `BOOTSTRAP.md`, `CONFIG.md`, and `AUTH.md` — read the file and follow its instructions inline. Hand off the context you have accumulated — workspace path, `AppConfig` values, auth-module contents, planner `template.json` and Resource Map — and follow the sub-skill's Phase A / Phase B cadence. Do not re-plan resources yourself; that is the sub-skill's job.

## Handoff contract with the Resources sub-skill (`./resources/SKILL.md`)

When you delegate, pass:

- The absolute workspace path.
- The `FormioAppConfig` values you wrote (or detected) — `appUrl`, `apiUrl`.
- The contents (or path) of the generated `AuthModule`, if any.
- **Both** planner artifact paths: `template.md` (architectural-intent seed) AND `template.json` (structured companion). The sub-skill reads `template.md` first to understand the resources, access story, ER and Access Flow diagrams, then consults `template.json` for field-level component JSON.
- If the approved Resource Map is still in conversation scope (not yet persisted to a file), pass it too — but in the standard orchestrated flow the planner has already written `template.md`, so the map and the file are the same content.

The sub-skill expects `FormioAppConfig` to already be wired into `AppModule`. If you skipped CONFIG because the workspace already had it wired, say so explicitly in the handoff so the sub-skill doesn't second-guess.

## When to reset to an earlier phase

If the user realizes mid-AUTH that the SETUP URLs were wrong, stop AUTH, rewind to SETUP, re-run CONFIG with the corrected URLs, then re-run AUTH. Do not try to patch `config.ts` in place from inside AUTH — restart the affected phases cleanly so the approval gates give the user another chance to sanity-check.

## Links

- [`SETUP.md`](./SETUP.md) — the URL interview
- [`BOOTSTRAP.md`](./BOOTSTRAP.md) — installing `angular/skills` and delegating to `angular-new-app`
- [`CONFIG.md`](./CONFIG.md) — `FormioAppConfig` / `config.ts` generation
- [`AUTH.md`](./AUTH.md) — `AuthModule` / `FormioAuthConfig` generation
- [`resources/SKILL.md`](./resources/SKILL.md) — per-resource NgModule scaffolding. Nested sub-skill of this skill; load the file directly, do NOT try to invoke it as a separate top-level skill by the name in its own frontmatter.

External references:

- https://help.form.io/developers/introduction/application
- https://github.com/formio/angular-demo
- https://github.com/angular/skills — Angular team's official skill library (installed by BOOTSTRAP)
