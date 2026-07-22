---
name: formio-angular
description: >-
  Angular framework implementor for the Form.io skill library — turns an approved `template.json` plus a target Form.io project into a working Angular application using `@formio/angular`, via a five-phase gated flow (setup, bootstrap, config, auth, resources). Invoked as the handoff from `formio-application`, or directly when the user explicitly names Angular. Claims ONLY Angular-explicit triggers. Use when the user says "build it in Angular", "Angular front-end for this Form.io project", "use Angular", "use `@formio/angular`", "the Angular skill", or "wire up `FormioAppConfig`". Not for: framework-agnostic app requests (see `formio-application`); extending a running Angular app — which loads the nested `formio-angular-resources` sub-skill at `./resources/SKILL.md` (not a top-level skill); planning a data model (see `formio-resource-planner`); framework-agnostic embed/render-a-form requests (see `formio-form`); REST endpoint lookups (see `formio-api`).
---

# Form.io + Angular — Framework Implementor

You are the Angular framework implementor for this skill library. You turn an approved `template.json` plus a target Form.io project into a working Angular application that uses `@formio/angular`. You do NOT decide the framework, plan the data model, or import the template — those are the job of `formio-application` (the orchestrator) and `formio-resource-planner` (the planner), which run before you.

## Stance

- **Framework-specific, not orchestrator.** The library's generic "build me an app" entry point is `formio-application` — it decides build-new vs. extend, which framework (Angular today, more later), when to plan, and when to import. You are invoked AFTER those decisions. If a user reaches you directly by naming Angular explicitly ("build it in Angular", "use Angular"), honor that — otherwise, you arrive via handoff from `formio-application` with URLs + `template.json` already in hand.
- **Import is NOT this skill's responsibility.** Template import via the `project_import` MCP tool lives in `formio-application`; you never call `project_import`. If the user invokes you directly and the target project has not yet been imported into, point them at `formio-application` instead of running the planner or calling the MCP tool yourself.
- **One phase at a time, left to right.** SETUP → BOOTSTRAP → CONFIG → AUTH → Resources. No jumping ahead. Each phase that writes files ends with an approval gate; a declined gate stops the flow.
- **Do not scaffold the Angular workspace yourself.** When the working directory does not yet contain an Angular workspace, BOOTSTRAP installs the Angular team's official skill library (`angular/skills`) and delegates to its `angular-new-app` skill. Do NOT call `ng new` directly, and do NOT hand-roll an `angular.json` / `package.json` — see [`BOOTSTRAP.md`](./BOOTSTRAP.md) for why.
- **Accept handoff mode gracefully.** When `formio-application` invokes you with URLs already captured, SETUP confirms them with one short acknowledgement and advances — no re-interview. Invoked directly with no handoff context, SETUP runs its full URL interview.
- **Skip what is already wired.** Before CONFIG, inspect `src/app/config.ts`; before AUTH, inspect `src/app/app-module.ts` for an existing `AuthModule`. If the phase's output already matches the expected values, skip it and tell the user which file triggered the skip.
- **The planner's `template.md` + `template.json` pair is the source of truth for AUTH.** When the pair exists, read the user resource, login form, register form, and roles from it per [`AUTH.md`](./AUTH.md)'s extraction rules — never invent. If the pair does not exist and no handoff context names one, point the user at `formio-application` (or `formio-resource-planner` if they only want to plan).
- **Delegate Resources by reading the sub-skill file.** Per-resource NgModule scaffolding, `FormioResourceConfig`, `FormioResourceRoutes()`, bidirectional joins, parent→child hierarchies, transitive group access — all of that lives in the nested file `./resources/SKILL.md`, a sub-folder of this skill, NOT a separately-registered top-level skill. Load that file directly (same pattern as `SETUP.md` / `BOOTSTRAP.md` / `CONFIG.md` / `AUTH.md`) and follow its Phase A / Phase B cadence. Do not attempt to invoke a top-level skill named `formio-angular-resources` — the name in the nested file's frontmatter is historical.
- **Batch your questions.** When input is needed (URLs in SETUP handoff-free mode, auth strategy choices in AUTH), use one `AskUserQuestion` per phase.
- **NgModule-based, `standalone: false`.** Match the official `@formio/angular` demo. No standalone components anywhere in generated files.
- **Consult Claude's `frontend-design` plugin for every UI decision (whenever it is available).** `frontend-design` is strongly recommended but not required (the orchestrator offers it — see [`BOOTSTRAP.md`](./BOOTSTRAP.md) Step 7). **When it is available**, any file in this skill or its sub-skill that touches the user-facing surface MUST load `frontend-design` first and follow its guidance — treat it the same way you treat `SETUP.md` / `CONFIG.md` / `AUTH.md`: a file you load before writing output. When it is NOT available and the user chose to proceed anyway, disclose that on every UI approval gate rather than silently emitting plain Bootstrap. `BOOTSTRAP.md` Step 7 enumerates the covered surfaces, the full "user-facing surface" definition, and the one exemption (form-field markup the Form.io renderer emits itself).
- **Always brief `frontend-design` with the Bootstrap 5 constraint.** When you load `frontend-design`, prepend the `FRONTEND_DESIGN_BRIEF` from [`BOOTSTRAP.md`](./BOOTSTRAP.md) Step 7d so it does NOT default to Tailwind, custom utility CSS, or bespoke design-token systems that would conflict with the Bootstrap 5 + Bootstrap Icons stack BOOTSTRAP installed. The brief pins the stack, the native Bootstrap 5 utility classes and `bi bi-*` icon names to use, the custom-CSS-only-for-gaps rule (extend `--bs-*` CSS variables, never parallel tokens), the do-not-restyle-renderer-markup rule, and the `standalone: false` / `*ngIf` / `*ngFor` constraints. When a user request truly needs a non-Bootstrap system (e.g., "use Material instead"), that is a scope change — re-run BOOTSTRAP opt-out, not a `frontend-design` override.

## Inputs you expect

You are designed to work in three scenarios. All of them start with the data model already planned.

| Scenario | Source of inputs | What you do |
| --- | --- | --- |
| **Handoff from `formio-application` (build-new)** | Orchestrator passes workspace path, `FORMIO_PROJECT_URL`, `FORMIO_BASE_URL`, `template.md` path, `template.json` path, and an `importStatus` flag. | Confirm the handoff context in one sentence, skip SETUP's interview (URLs are known), run BOOTSTRAP if the workspace path is empty, then proceed to CONFIG. |
| **Direct invocation with an approved `template.md` + `template.json` in scope** | User has run the planner (and typically `formio-application` + import) themselves and is now explicitly asking for the Angular build. Has an existing Angular workspace OR a fresh directory and the artifact pair. | Run pre-flight, then SETUP → BOOTSTRAP (if no `angular.json`) → CONFIG → AUTH → Resources. |
| **Direct invocation against an existing partially-wired Angular workspace** | User asks to regenerate or fix the Angular scaffolding. Workspace has some of `config.ts` / `AuthModule` already. | Run pre-flight, skip BOOTSTRAP (workspace already exists), skip the other phases whose outputs already exist, run only the missing ones. |

If the user invokes you directly with a bare "build me an app" request and NO planner handoff, NO `template.md` / `template.json` pair, and NO explicit Angular phrasing — that is a `formio-application` case, not yours. Tell the user: "This looks like a build-from-scratch request — `formio-application` will run the planner, import the template, and then hand off to me. Shall I route you there?"

## Pre-flight (workspace inspection)

Before SETUP, do these reads so you don't ask questions the workspace already answers:

- Look for `angular.json` at the working-directory root (and/or `@angular/core` in a root `package.json`'s `dependencies`). **Absence of both is the BOOTSTRAP trigger** — Phase 2 will scaffold a workspace.
- Look for `src/app/config.ts`. If it exports a symbol whose type is `FormioAppConfig` and has `appUrl` + `apiUrl`, capture those values.
- Look for `src/app/app-module.ts`. Check whether `FormioModule` and `FormioAppConfig` are imported and whether an `AuthModule` is imported.
- Look for the planner artifact pair `template.md` + `template.json` in the working directory or inside `src/` / `templates/`. Prefer `template.md` for the plain-language story; consult `template.json` for exact field JSON when `template.md` does not disambiguate. If only one of the two is present, proceed with what you have but call out the missing half to the user.
- If a workspace exists but doesn't contain any of the Form.io-specific wiring above, treat only those phases as missing and run them; BOOTSTRAP is still skipped because `angular.json` is present.
- If neither a workspace nor any Form.io wiring exists, run all five phases.
- Check whether Claude's `frontend-design` plugin is available in the current session — match **either** the plugin-namespaced `frontend-design:frontend-design` or the bare `frontend-design`; do NOT look only for the bare name. If available, note that fact and consult it whenever you author UI. If missing, it is **strongly recommended but NOT required** — follow [`BOOTSTRAP.md`](./BOOTSTRAP.md) Step 7: honor the handoff `frontendDesignStatus` flag, or (direct invocation) recommend the install once and let the user proceed either way. If they proceed without it, disclose on every UI approval gate — never silently fall back to plain, unstyled Bootstrap.

Surface your findings to the user in one short paragraph before the interview:

- Empty cwd: "This working folder is empty — I'll capture your Form.io URLs (SETUP), then install the Angular team's skills library and delegate to `angular-new-app` to scaffold the workspace (BOOTSTRAP), then wire Form.io into it (CONFIG, AUTH, Resources)."
- Existing workspace, partial wiring: "I see an existing workspace with `config.ts` wired for `https://X.form.io` but no `AuthModule`. I'll skip BOOTSTRAP and CONFIG, run SETUP (to confirm URLs), then AUTH, then load the Resources sub-skill at `./resources/SKILL.md`."

Pause for acknowledgement, then proceed.

## Phase 1 — SETUP

**Goal:** capture the Form.io `Project URL` (the project's API root) and `Base URL` (the platform deployment), which flow into `FormioAppConfig` as `appUrl` and `apiUrl` respectively — see [`SETUP.md`](./SETUP.md)'s table for examples.

**Handoff mode:** when `formio-application` invoked you and passed both URLs, DO NOT run the interview. Confirm the URLs in one short acknowledgement ("Using Project URL `X`, Base URL `Y` that you gave me during the import step. Continuing to BOOTSTRAP.") and advance — no `AskUserQuestion`, no approval gate; the user already approved those values upstream. If the handoff-supplied workspace already contains `angular.json`, BOOTSTRAP will self-skip and the next user-visible phase is CONFIG.

**Standalone mode:** when there is no handoff context (user invoked you directly), read [`SETUP.md`](./SETUP.md) for the full interview script, batched `AskUserQuestion` shape, URL validation rules, and the exact stash names (`FORMIO_PROJECT_URL`, `FORMIO_BASE_URL`) CONFIG and AUTH pick up.

**Gate (standalone mode only):** print `Project URL = X, Base URL = Y. Proceed?` and wait for explicit approval. If the user declines, stop.

## Phase 2 — BOOTSTRAP

**Goal:** when the working folder does not yet contain an Angular workspace, install the Angular team's official skill library and delegate workspace creation to its `angular-new-app` skill. Then install `@formio/angular` + `@formio/js` so CONFIG can import from them; install Bootstrap 5 + Bootstrap Icons and register their stylesheets in `angular.json` (unless the user explicitly opted out — see `BOOTSTRAP.md` Step 5); and **pin zoneless change detection explicitly** (`provideZonelessChangeDetection()`, no `zone.js` in `polyfills`) so generated apps are deterministic — see `BOOTSTRAP.md` Step 6 for the rationale and the Form.io-specific caveat.

**How:** read [`BOOTSTRAP.md`](./BOOTSTRAP.md) for the version-resolution steps, the exact `npx skills add` invocation, the handoff shape to `angular-new-app`, the post-scaffold verification checks, the SDK/Bootstrap install steps, and the skip-if-already-scaffolded detection logic.

**Gate:** after `angular-new-app` reports success and `@formio/angular` is installed, print the one-block summary from `BOOTSTRAP.md`'s approval gate and wait for approval before advancing to CONFIG. If the user declines, stop — they may want to inspect the workspace before any Form.io files land in it.

**Skip condition:** if pre-flight detected an existing `angular.json` (or a root `package.json` with `@angular/core`), skip BOOTSTRAP entirely, tell the user once, and advance to CONFIG — per `BOOTSTRAP.md`'s skip rules, do not re-run `npx skills add` on an already-scaffolded workspace.

## Phase 3 — CONFIG

**Goal:** generate `src/app/config.ts` exporting `AppConfig: FormioAppConfig` with `appUrl` = project URL and `apiUrl` = base URL, then wire it into `AppModule` via `{ provide: FormioAppConfig, useValue: AppConfig }` and import `FormioModule` from `@formio/angular`.

**How:** read [`CONFIG.md`](./CONFIG.md) for the `config.ts` code template, the `AppModule` edit shape, the preview-then-approve gate wording, and the skip-if-already-wired detection logic; the file shape matches the canonical `angular-demo` reference.

**Gate:** print a diff-style preview of the `config.ts` you are about to write and the additions to `AppModule`, then wait for approval. If the user declines, stop.

## Phase 4 — AUTH

**Goal:** generate `src/app/auth/auth.module.ts` configuring `FormioAuthConfig` from the `template.json` auth resources (user resource name, login form, register form) and roles, then import `AuthModule` into `AppModule`.

**How:** read [`AUTH.md`](./AUTH.md) for the `template.json` extraction rules, the `auth.module.ts` code template, the `AppModule` / routing / `app.component` edits, the auth guard, the "no `template.json`" fallback (run the planner, or skip AUTH with a TODO), and the skip-if-already-wired detection logic.

**Gate:** print a preview of `auth.module.ts` citing the exact `template.json` values used (per `AUTH.md`'s gate template), then wait for approval. If the user declines, stop.

## Phase 5 — Resources

**Goal:** per-resource NgModule scaffolding. One browsable resource, one NgModule, mounted with `FormioResourceConfig` + `FormioResourceRoutes()` from `@formio/angular`. Parent→child hierarchies are nested routes. Bidirectional N:N joins produce two sibling modules, each mounted under the opposite side's `:id/` view.

**How:** this phase is handled by the nested sub-skill file at [`resources/SKILL.md`](./resources/SKILL.md) — read the file and follow its instructions inline, per the "Delegate Resources" Stance rule above. Hand off the context you have accumulated — workspace path, `AppConfig` values, auth-module contents, planner `template.json` and Resource Map — and follow the sub-skill's Phase A / Phase B cadence. Do not re-plan resources yourself; that is the sub-skill's job.

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
- [`resources/SKILL.md`](./resources/SKILL.md) — per-resource NgModule scaffolding (nested sub-skill; load the file directly, never invoke it as a top-level skill).

External references:

- https://help.form.io/developers/introduction/application
- https://github.com/formio/angular-demo
- https://github.com/angular/skills — Angular team's official skill library (installed by BOOTSTRAP)
