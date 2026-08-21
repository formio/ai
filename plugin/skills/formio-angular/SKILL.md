---
name: formio-angular
description: >-
  Angular framework implementor for the Form.io skill library — turns an approved `template.json` plus a target Form.io project into a working Angular application using `@formio/angular`, via a five-phase gated flow (setup, bootstrap, config, auth, resources). Invoked as the handoff from `formio-application`, or directly when the user explicitly names Angular. Claims ONLY Angular-explicit triggers. Use when the user says "build it in Angular", "Angular front-end for this Form.io project", "use Angular", "use `@formio/angular`", "the Angular skill", or "wire up `FormioAppConfig`". Not for: framework-agnostic app requests (see `formio-application`); extending a running Angular app — which loads the nested `formio-angular-resources` sub-skill at `./formio-angular-resources/SKILL.md` (not a top-level skill); planning a data model (see `formio-resource-planner`); framework-agnostic embed/render-a-form requests (see `formio-form`); REST endpoint lookups (see `formio-api`).
---

# Form.io + Angular — Framework Implementor

You are the Angular framework implementor for this skill library. You turn an approved `template.json` plus a target Form.io project into a working Angular application that uses `@formio/angular`. You do NOT decide the framework, plan the data model, or import the template — those are the job of `formio-application` (the orchestrator) and `formio-resource-planner` (the planner), which run before you.

## Preflight — the Form.io MCP server

Before your first Form.io tool call, check that the Form.io MCP tools are available to you — `form_list`, `form_create`, `project_import`, `project_set`.

**If they are missing, stop and connect the server before doing anything else.** Load the `formio-mcp-setup` skill and follow it; it writes the MCP configuration for every client and tells the user how to reload. If that skill is not installed either, tell the user:

> I have no Form.io tools, so the Form.io MCP server isn't connected. Run `npx skills add formio/ai` to get the setup skill, or add the server to your agent's MCP configuration as `npx -y @formio/mcp@0.10.0`.

Do **not** work around missing tools by making direct HTTP requests against a Form.io deployment, and do not write a throwaway script that makes them for you. This library documents the whole Form.io REST surface, which makes hand-rolling requests tempting and wrong — it bypasses the guardrails the tools enforce and can write to a live deployment unreviewed. Stop and report what is blocking instead.

That ban is on **build-time** work — the configuring you do in this session. It says nothing about the application you are building: an app is expected to call the Form.io REST API **at runtime**, to log its users in and to read and write their submissions, and [`formio-api`](../formio-api/SKILL.md)'s runtime-scope references document those endpoints for exactly that code.

**Available tools are not a configured project.** Every Form.io tool resolves which project it targets from a mapping keyed on a working directory, so pass `cwd` — the user's current working directory — on every Form.io tool call; omitting it resolves against the MCP server's own directory, which is fixed at spawn and may be mapped to a different project. Before the first call that reads from or writes to a deployment, ask the server what this directory resolves to:

```bash
npx -y @formio/mcp@0.10.0 project get --cwd "$(pwd)"
```

On success, what it prints IS the configuration. There is one value to think about — the **Project URL**, the full URL of the Form.io project this work reads and writes. The **Base URL** (the deployment hosting it) is normally DERIVED from that project URL rather than supplied, so it is not a second thing to ask for. The values may come from a committed `formio.json` tracked with the application's own source, from this directory's mapping, or from the environment — the command says which. Do not ask the user to confirm or re-supply either one. On exit `1` — nothing is recorded for this directory — relay that message's own instruction to the user, ask for the single value it names, run the `project set` command it names, and re-run. On exit `3` the project IS recorded and one named value is still missing — the Base URL, for a project URL that names no deployment of its own: relay that message the same way, ask for that one value, run the `project set --base-url` command it names, and re-run. Do not re-ask for the Project URL there; that message deliberately does not request it. On exit `2` the command could not answer at all (an unreadable `~/.formio/projects.json`, a `formio.json` that will not parse, a malformed URL): do NOT interview, because a `project set` would fail for the same unreported reason and the loop would repeat with the cause never named — relay the message and stop until it is fixed. Before the first call that WRITES (`form_create`, `form_update`, `role_create`, `action_create`, `project_import`), state the resolved Project URL and Base URL in one line, so a wrong target is caught before anything is written to it.

Never invent a Base URL, never reuse one from another project or an earlier session, and never edit `~/.formio/projects.json` by any means — its shape, its `0600` mode, and its merge rules belong to the server, and `project set` / `project_set` are how you reach them. The server's own messages carry the URL shapes and the remedy for each; this skill does not restate them.

## Stance

- **Framework-specific, not orchestrator.** The library's generic "build me an app" entry point is `formio-application` — it decides build-new vs. extend, which framework (Angular today, more later), when to plan, and when to import. You are invoked AFTER those decisions. If a user reaches you directly by naming Angular explicitly ("build it in Angular", "use Angular"), honor that — otherwise, you arrive via handoff from `formio-application` with URLs + `template.json` already in hand.
- **Import is NOT this skill's responsibility.** Template import via the `project_import` MCP tool lives in `formio-application`; you never call `project_import`. If the user invokes you directly and the target project has not yet been imported into, point them at `formio-application` instead of running the planner or calling the MCP tool yourself.
- **One phase at a time, left to right.** SETUP → BOOTSTRAP → CONFIG → AUTH → Resources. No jumping ahead. Each phase that writes files ends with an approval gate; a declined gate stops the flow.
- **Do not hand-roll the Angular workspace.** When the working directory does not yet contain one, BOOTSTRAP offers to install the Angular team's official skill library (`angular/skills`) and delegates to its `angular-new-app` skill; if the user declines that install, it falls back to the Angular CLI (`npx @angular/cli@<major> new`) under its own approval. Both paths are in [`BOOTSTRAP.md`](./BOOTSTRAP.md) — never hand-write an `angular.json` / `package.json`, and never run a scaffolding command the user has not approved.
- **Resolve the project, never interview for it.** SETUP reads the Project URL and Base URL from the MCP server with `project get`, on every path — handoff or direct invocation. A handoff from `formio-application` is a copy of those values, and the mapping is what `@formio/angular` and every later tool call actually resolve against, so SETUP confirms against the server rather than trusting what it was handed. It asks the user for a URL only when the server's own message says one is missing, and only for the value that message names.
- **Skip what is already wired.** Before CONFIG, inspect `src/app/config.ts`; before AUTH, inspect `src/app/app-module.ts` for an existing `AuthModule`. If the phase's output already matches the expected values, skip it and tell the user which file triggered the skip.
- **The planner's `template.md` + `template.json` pair is the source of truth for AUTH.** When the pair exists, read the user resource, login form, register form, and roles from it per [`AUTH.md`](./AUTH.md)'s extraction rules — never invent. If the pair does not exist and no handoff context names one, point the user at `formio-application` (or `formio-resource-planner` if they only want to plan).
- **Delegate Resources by reading the sub-skill file.** Per-resource NgModule scaffolding, `FormioResourceConfig`, `FormioResourceRoutes()`, bidirectional joins, parent→child hierarchies, transitive group access — all of that lives in the nested file `./formio-angular-resources/SKILL.md`, a sub-folder of this skill, NOT a separately-registered top-level skill. Load that file directly (same pattern as `SETUP.md` / `BOOTSTRAP.md` / `CONFIG.md` / `AUTH.md`) and follow its Phase A / Phase B cadence. Do not attempt to invoke a top-level skill named `formio-angular-resources` — the name in the nested file's frontmatter is historical.
- **Batch your questions.** When input is needed (auth strategy choices in AUTH), ask everything that phase needs in ONE question round, using the client's structured question mechanism (in Claude Code, `AskUserQuestion`). Do not pepper. Configuration is the exception and is never batched: SETUP asks for whichever single URL the server's message names, because the other one is usually already resolved.
- **NgModule-based, `standalone: false`.** Match the official `@formio/angular` demo. No standalone components anywhere in generated files.
- **Consult `frontend-design` for every UI decision (whenever it is available).** `frontend-design` is strongly recommended but not required (the orchestrator offers it — see [`BOOTSTRAP.md`](./BOOTSTRAP.md) Step 7). **When it is available**, any file in this skill or its sub-skill that touches the user-facing surface MUST load `frontend-design` first and follow its guidance — treat it the same way you treat `SETUP.md` / `CONFIG.md` / `AUTH.md`: a file you load before writing output. When it is NOT available and the user chose to proceed anyway, disclose that on every UI approval gate rather than silently emitting plain Bootstrap. `BOOTSTRAP.md` Step 7 enumerates the covered surfaces, the full "user-facing surface" definition, and the one exemption (form-field markup the Form.io renderer emits itself).
- **Always brief `frontend-design` with the Bootstrap 5 constraint.** When you load `frontend-design`, prepend the `FRONTEND_DESIGN_BRIEF` from [`BOOTSTRAP.md`](./BOOTSTRAP.md) Step 7d so it does NOT default to Tailwind, custom utility CSS, or bespoke design-token systems that would conflict with the Bootstrap 5 + Bootstrap Icons stack BOOTSTRAP installed. The brief pins the stack, the native Bootstrap 5 utility classes and `bi bi-*` icon names to use, the custom-CSS-only-for-gaps rule (extend `--bs-*` CSS variables, never parallel tokens), the do-not-restyle-renderer-markup rule, and the `standalone: false` / `*ngIf` / `*ngFor` constraints. When a user request truly needs a non-Bootstrap system (e.g., "use Material instead"), that is a scope change — re-run BOOTSTRAP opt-out, not a `frontend-design` override.

## Inputs you expect

You are designed to work in three scenarios. All of them start with the data model already planned.

| Scenario | Source of inputs | What you do |
| --- | --- | --- |
| **Handoff from `formio-application` (build-new)** | Orchestrator passes workspace path, `projectUrl`, `baseUrl`, `template.md` path, `template.json` path, and an `importStatus` flag. | Confirm the handoff context in one sentence, run SETUP to confirm the handed-in URLs against `project get`, run BOOTSTRAP if the workspace path is empty, then proceed to CONFIG. |
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
- Check whether a design or frontend skill is available to you under any name — match on what the skill is for, not on a client-specific name. If one is available, note that fact and consult it whenever you author UI. If none is, follow [`BOOTSTRAP.md`](./BOOTSTRAP.md) Step 7: honor the handoff `frontendDesignStatus` flag, or (direct invocation) detect it yourself, then apply the Step 7d Bootstrap 5 brief inline and disclose that on every UI approval gate — never silently fall back to plain, unstyled Bootstrap.

Surface your findings to the user in one short paragraph before the interview:

- Empty cwd: "This working folder is empty — I'll confirm which Form.io project this directory is configured for (SETUP), then install the Angular team's skills library and delegate to `angular-new-app` to scaffold the workspace (BOOTSTRAP), then wire Form.io into it (CONFIG, AUTH, Resources)."
- Existing workspace, partial wiring: "I see an existing workspace with `config.ts` wired for `https://X.form.io` but no `AuthModule`. I'll skip BOOTSTRAP and CONFIG, run SETUP (to confirm the configured project), then AUTH, then load the Resources sub-skill at `./formio-angular-resources/SKILL.md`."

Pause for acknowledgement, then proceed.

## Phase 1 — SETUP

> **`FormioAppConfig` renames both URLs.** `appUrl` is the **Project URL** — the project this application reads and writes, and the one value anyone supplies. `apiUrl` is the **Base URL** — the deployment hosting it, which is normally derived from the Project URL rather than supplied. Take both from `npx -y @formio/mcp@0.10.0 project get --cwd "<workspace root>"`; never compose, derive, or hand-type either one yourself.

**Goal:** resolve the Form.io `Project URL` (the project this application reads and writes) and `Base URL` (the deployment hosting it), which flow into `FormioAppConfig` as `appUrl` and `apiUrl` respectively — see [`SETUP.md`](./SETUP.md)'s table.

**Handoff mode:** when `formio-application` invoked you and passed both URLs, DO NOT run the interview. Confirm the URLs in one short acknowledgement ("Using Project URL `X`, Base URL `Y` that you gave me during the import step. Continuing to BOOTSTRAP.") and advance — no question round, no approval gate; the user already approved those values upstream. If the handoff-supplied workspace already contains `angular.json`, BOOTSTRAP will self-skip and the next user-visible phase is CONFIG.

**Every mode, handoff or standalone:** read [`SETUP.md`](./SETUP.md) for the `project get` probe, what to do when its message names a missing value, the existing-`config.ts` mismatch branch, and the exact stash names (`projectUrl`, `baseUrl`) CONFIG and AUTH pick up.

**Gate (standalone mode only):** print `Project URL = X, Base URL = Y. Proceed?` and wait for explicit approval. If the user declines, stop.

## Phase 2 — BOOTSTRAP

**Goal:** when the working folder does not yet contain an Angular workspace, install the Angular team's official skill library and delegate workspace creation to its `angular-new-app` skill. Then install `@formio/angular` + `@formio/js` so CONFIG can import from them; install Bootstrap 5 + Bootstrap Icons and register their stylesheets in `angular.json` (unless the user explicitly opted out — see `BOOTSTRAP.md` Step 4); and **pin zoneless change detection explicitly** (`provideZonelessChangeDetection()`, no `zone.js` in `polyfills`) so generated apps are deterministic — see `BOOTSTRAP.md` Step 5 for the rationale and the Form.io-specific caveat.

**How:** read [`BOOTSTRAP.md`](./BOOTSTRAP.md) for the version-resolution steps, the exact `npx skills add` invocation, the handoff shape to `angular-new-app`, the post-scaffold verification checks, the SDK/Bootstrap install steps, and the skip-if-already-scaffolded detection logic.

**Gate:** after `angular-new-app` reports success and `@formio/angular` is installed, print the one-block summary from `BOOTSTRAP.md`'s approval gate and wait for approval before advancing to CONFIG. If the user declines, stop — they may want to inspect the workspace before any Form.io files land in it.

**Skip condition:** if pre-flight detected an existing `angular.json` (or a root `package.json` with `@angular/core`), skip BOOTSTRAP entirely, tell the user once, and advance to CONFIG — per `BOOTSTRAP.md`'s skip rules, do not re-run `npx skills add` on an already-scaffolded workspace.

## Phase 3 — CONFIG

**Goal:** generate `src/app/config.ts` exporting `AppConfig: FormioAppConfig` with `appUrl` = project URL and `apiUrl` = base URL, then wire it into `AppModule` via `{ provide: FormioAppConfig, useValue: AppConfig }` and import `FormioModule` from `@formio/angular`.

**How:** read [`CONFIG.md`](./CONFIG.md) for the `config.ts` code template, the `AppModule` edit shape, the preview-then-approve gate wording, and the skip-if-already-wired detection logic; the file shape matches the canonical `angular-demo` reference.

**Gate:** print a diff-style preview of the `config.ts` you are about to write and the additions to `AppModule`, then wait for approval. If the user declines, stop.

## Phase 4 — AUTH

**Goal:** generate `src/app/auth/auth.module.ts` configuring `FormioAuthConfig` from the `template.json` auth resources (user resource name, login form, register form) and roles, import `AuthModule` into `AppModule`, and write the app shell — the REQUIRED page-layout wrapper around `<router-outlet>` (the only layout boundary that reaches the library-rendered create / edit / delete / index / login / register routes) plus recommended auth-aware nav chrome.

**How:** read [`AUTH.md`](./AUTH.md) for the `template.json` extraction rules, the `auth.module.ts` code template, the `AppModule` / routing / root-component edits, the shell's page layout contract, the auth guard, the "no `template.json`" fallback (run the planner, or skip AUTH with a TODO), and the skip-if-already-wired detection logic.

**Gate:** print a preview of `auth.module.ts` citing the exact `template.json` values used (per `AUTH.md`'s gate template), then wait for approval. If the user declines, stop.

## Phase 5 — Resources

**Goal:** per-resource NgModule scaffolding. One browsable resource, one NgModule, mounted with `FormioResourceConfig` + `FormioResourceRoutes()` from `@formio/angular`. Parent→child hierarchies are nested routes. Bidirectional N:N joins produce two sibling modules, each mounted under the opposite side's `:id/` view.

**How:** this phase is handled by the nested sub-skill file at [`formio-angular-resources/SKILL.md`](./formio-angular-resources/SKILL.md) — read the file and follow its instructions inline, per the "Delegate Resources" Stance rule above. Hand off the context you have accumulated — workspace path, `AppConfig` values, auth-module contents, planner `template.json` and Resource Map — and follow the sub-skill's Phase A / Phase B cadence. Do not re-plan resources yourself; that is the sub-skill's job.

## Handoff contract with the Resources sub-skill (`./formio-angular-resources/SKILL.md`)

When you delegate, pass:

- The absolute workspace path.
- The `FormioAppConfig` values you wrote (or detected) — `appUrl`, `apiUrl`.
- The contents (or path) of the generated `AuthModule`, if any.
- **Both** planner artifact paths: `template.md` (architectural-intent seed) AND `template.json` (structured companion). The sub-skill reads `template.md` first to understand the resources, access story, ER and Access Flow diagrams, then consults `template.json` for field-level component JSON.
- If the approved Resource Map is still in conversation scope (not yet persisted to a file), pass it too — but in the standard orchestrated flow the planner has already written `template.md`, so the map and the file are the same content.

The sub-skill expects `FormioAppConfig` to already be wired into `AppModule`. If you skipped CONFIG because the workspace already had it wired, say so explicitly in the handoff so the sub-skill doesn't second-guess.

## When to reset to an earlier phase

If the user realizes mid-AUTH that the resolved project was wrong, stop AUTH, rewind to SETUP, re-run CONFIG with the corrected URLs, then re-run AUTH. Do not try to patch `config.ts` in place from inside AUTH — restart the affected phases cleanly so the approval gates give the user another chance to sanity-check.

## Links

- [`SETUP.md`](./SETUP.md) — resolving the configured project
- [`BOOTSTRAP.md`](./BOOTSTRAP.md) — offering `angular/skills`, delegating to `angular-new-app`, and the Angular CLI fallback
- [`CONFIG.md`](./CONFIG.md) — `FormioAppConfig` / `config.ts` generation
- [`AUTH.md`](./AUTH.md) — `AuthModule` / `FormioAuthConfig` generation
- [`formio-angular-resources/SKILL.md`](./formio-angular-resources/SKILL.md) — per-resource NgModule scaffolding (nested sub-skill; load the file directly, never invoke it as a top-level skill).

External references:

- https://help.form.io/developers/introduction/application
- https://github.com/formio/angular-demo
- https://github.com/angular/skills — Angular team's official skill library (BOOTSTRAP offers to install it; the user decides)
