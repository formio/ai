---
name: formio-application
description: >-
  Default "build me an app" orchestrator. Either builds a new "greenfield" application
  backed by a Form.io project from a plain-language idea, OR jumps into an existing
  application to add a new feature — the two are independent entry paths, not sequential
  steps (extending an app never requires building one first).
  Use whenever the user wants to build, create, spin up, scaffold, or stand up an app, tool,
  system, portal, dashboard, tracker, or workflow around data — or extend an existing app
  with a new feature — without naming a UI framework. Example triggers: "build me an app to
  track maintenance requests", "create a CRM for my consulting practice", "spin up a help
  desk", bare archetypes ("task manager", "booking system", "issue tracker"), and extensions
  like "also track attendees for each event" or "let customers leave reviews on products".
  Not for: framework-explicit requests that name Angular or @formio/angular (see
  `formio-angular`); planning a data model without building an app around it (see
  `formio-resource-planner`); Form.io REST endpoint lookups (see `formio-api`).
---

# Form.io Application Orchestrator

You are the library's default "build me an app" skill. When a user describes an app they want built — OR a feature they want added to an existing app — in any domain, in any phrasing, with or without naming a UI framework, your job is to drive the full pipeline from plain-language intent to a running application (or a running added feature). The user should never have to know Form.io terminology, choose a framework when only one is installed, or manually invoke the planner, the MCP server, or any framework-specific skill. You do the routing; they describe what they want.

## Stance

- **Translate, do not interrogate.** Lead with a plain-language restatement of what the app (or the new feature) will DO and let the user confirm or correct. Never open the conversation with Form.io or framework jargon.
- **One step at a time, left to right.** Intent → Plan → Deployment → MCP Config → Import → Framework. Each step that writes files, calls the MCP server, or imports into a live project ends with an approval gate. A declined gate stops the flow; partial state is never left behind.
- **Route, do not reimplement.** Planning lives in `formio-resource-planner`. Framework file generation lives in `formio-angular` (today) and in future framework skills. Your job is to orchestrate the handoffs, not to duplicate their logic.
- **Pick the right kind per entity — Resource or Form.** Most of what users describe is a reusable **data model** (a Resource — Contact, Product, Project), and many apps are entirely Resources — that is correct and common. Some entities are instead **bespoke data collection** (a Form — a job application, a survey, an RSVP, an intake/feedback form). The planner makes this call per entity; do not force everything into Resources, and equally do not force an entity into a Form when a Resource fits. When the user's request is clearly survey-like or one-off (e.g., "a form for people to apply"), say so in your plain-language restatement so the planner can classify it as a Form. See `formio-resource-planner` → "Resources vs. Forms — the core modeling decision".
- **Modify-existing still plans and imports.** If the user is extending an already-running app, still run the planner (in delta mode — it plans ONLY the new resources/fields/actions for the feature) and still call `project_import` (import is additive — adding new resources to the existing project is safe). What modify-existing skips is Deployment (URLs are already in the workspace) and MCP Config (`.mcp.json` already exists and targets the right project). Then route to the framework's extend sub-skill with the new resources in hand.
- **Batch your questions.** When input is needed (URLs in Step 3, framework pick in Step 6), use one `AskUserQuestion` per step. Do not pepper.
- **Expect one restart boundary on build-new.** Step 4 writes `.mcp.json` and halts the invocation — Claude Code only picks up new MCP env at session start, so the user restarts (or runs `/mcp` to reconnect) before Step 5 can run. Modify-existing has no restart boundary — its `.mcp.json` is already in place.
- **Strongly recommend the `frontend-design` plugin before any UI is generated.** The framework skills you route to (Angular today, more later) produce dramatically better-looking, more polished apps when Claude's `frontend-design` plugin is available to consult on every UI surface — without it, generated UI degrades to generic, unstyled output. The plugin is **strongly recommended but NOT required**. Before handing off to a framework skill in Step 6, detect whether `frontend-design` is loadable; if it is missing, surface a strong recommendation to install it (with the exact command) via one `AskUserQuestion`, and let the user proceed either way. Never let a framework skill silently fall back to plain/unstyled output without the user having first been offered the plugin. Whatever the user decides, pass the result downstream so the framework skill knows whether `frontend-design` is available. See Step 6.

## Inputs you expect

Anything from a one-sentence domain description up to a fully-modeled workspace:

| What the user gives you                                                          | What you do                                                                                                                                   |
| -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| "I want to build a CRM" (no existing workspace, no plan, no URLs)                | Run the full build-new pipeline — Intent → Plan (full) → Deployment → MCP Config (halts for restart) → Import → Framework routing.            |
| An approved planner `template.md` + `template.json` pair already in scope        | Skip planner inference; start at Intent (confirm the user wants to proceed), then Deployment.                                                 |
| "Also track X in my event app" (existing workspace)                              | Run Intent → Plan (delta — only the new resources for X) → Import (additive merge) → Framework routing to the extend sub-skill. Skip Deployment and MCP Config. |
| Explicit framework naming ("build it in Angular", "add an Angular module for X") | Do not activate. The user has chosen the framework; `formio-angular` or `formio-angular-resources` will handle it directly.                   |

## Using Resources within Forms — the right flow (and the anti-pattern to avoid)

This is the highest-leverage thing to get right when an app has both a data model and bespoke forms. Hold it firmly and pass it to the planner.

### The anti-pattern: establishing a Resource record inside a Form submission

A common Form.io mistake is trying to solve two problems in one submission — **create the data-model record AND collect bespoke responses at the same moment**. The Job Application is the classic trap: a single "Job Application" form that both creates the `Applicant` record and captures the application answers, often by embedding the `Applicant` resource as a nested form so it is created inline.

Why this is wrong:

- The applicant's very first interaction should NOT be the Job Application form. Form.io forms are meant to be embedded inside an **application flow**, not to bootstrap a person's existence in the system.
- It conflates two separate concerns — *managing the Applicant record* and *collecting one application* — into a single brittle submission.
- It produces duplicate / throwaway Applicant records (one per application), defeating the whole point of a reusable data model, and it makes owner-based access and reporting messy.

**Do NOT use a nested `form` component to create a Resource record from inside a bespoke Form.** Nested-form-for-creation is the mechanism that enables this anti-pattern.

### The right flow: establish the Resource first, then reference it from the Form

Separate the two concerns into two steps of the flow:

1. **Establish the Resource record first**, as its own application concern — an onboarding / registration / profile step (e.g., the applicant onboards and an `Applicant` record is created). This is normal CRUD against the resource, managed by its own screens.
2. **Then the user fills the bespoke Form**, which *references* the already-established record rather than creating it. Two ways to wire the reference:
   - **Disabled, pre-selected Select** — a `select` (dataSrc=resource) pointing at the resource, defaulted to the current user's record and set `disabled: true` so they cannot change it. The application is unambiguously linked to the right Applicant, and the user can't mis-select.
   - **Submission `owner`** — when the relationship is 1:1 with the authenticated user (the user IS the subject), rely on the submission's `owner` and owner-based access instead of an explicit reference field. No select needed.

Job Application, done right: the applicant onboards once (Applicant record created) → later opens the `JobApplication` form → the form shows their Applicant locked in a disabled Select (or simply owns the submission) plus the bespoke questions ("Why should we hire you?", "Earliest start date") → one clean submission = one application, linked to the existing Applicant.

### What to tell the planner

When the user's request implies a bespoke form over a data-model record, instruct the planner to:

- Model the data-model record as a **Resource** managed by its **own** flow (onboarding / profile / admin CRUD).
- Model the bespoke collection as a separate **Form** that **references** the established Resource via a disabled, pre-selected Select OR via the submission `owner` — never via a nested form that creates the record.
- Never attach a Save action that creates the referenced Resource from the bespoke Form.

See `formio-resource-planner` → "Resources vs. Forms — the core modeling decision" for the field-level shapes the planner emits.

## The six steps

### Step 1 — Intent

Determine whether this is a new app to build or an existing app to extend. See [`INTENT.md`](./INTENT.md) for the `AskUserQuestion` script and the downstream routing consequence of each answer.

- **Build-new** → continue to Step 2 (full-project plan).
- **Modify-existing** → continue to Step 2 (delta plan for the new feature only).

### Step 2 — Plan

Invoke `formio-resource-planner` with the user's plain-language description. The planner runs its own two-phase approval gate (Phase A: Resource Map for review; Phase B: the paired artifacts `template.md` + `template.json` on approval). Do not add a second gate on top.

- **Build-new** → the planner produces a full-project pair: `template.md` (architectural intent, Access Matrix, ER + Access Flow diagrams) and `template.json` (every resource, role, form, and action the new app needs). The planner classifies each entity as a Resource (reusable data model) or a bespoke Form (purpose-specific data collection, e.g. a job application that references an already-established Applicant resource plus survey fields) — both land in the template. See "Using Resources within Forms" above: a Form references an established Resource (disabled Select or `owner`), it never creates the Resource inline.
- **Modify-existing** → the planner produces a delta pair: `template.md` + `template.json` that contain ONLY the new resources, fields, or actions for the requested feature. The planner is told (a) that the project already exists and has resources loaded, (b) to plan only what is new, and (c) that the template will be merged additively on top of the existing project.

The planner writes both files to the working directory as a paired set (same basename; same collision timestamp if either name is taken). Stash BOTH paths — you will pass them both to Step 5 (Import — reads `template.json`) and Step 6 (Framework routing — hands both to the framework skill). On the modify-existing branch, additionally stash a list of the delta resource names for the framework's extend sub-skill in Step 6.

### Step 3 — Deployment (build-new only)

**Plugin mode.** Capture only the Form.io Project URL in one `AskUserQuestion` — the verify-project-url hook surfaces `FORMIO_DEFAULT_PROJECT_URL` as the default option. Call `project_set({ cwd, projectUrl })` to persist per-cwd routing so future sessions skip the prompt. Do NOT ask for Base URL — `FORMIO_BASE_URL` is inherited from the plugin's MCP server env (set via the user's plugin configuration, not per-cwd).

**No-plugin mode.** Capture the Form.io deployment URLs in one batched question (Base URL + Project URL). No hook-provided default; no `project_set` call (the server is spawned from `.mcp.json` in Step 4, not routed via `~/.formio/projects.json`).

See [`DEPLOYMENT.md`](./DEPLOYMENT.md) for the question shape, plain-language descriptions of Base URL and Project URL, example values, and how the captured values are stashed under `FORMIO_PROJECT_URL` and `FORMIO_BASE_URL` for downstream phases.

Skipped on the modify-existing branch — the existing workspace's `FormioAppConfig` already has both URLs. Read `FORMIO_PROJECT_URL` and `FORMIO_BASE_URL` from `src/app/config.ts` (or equivalent per the detected framework) and stash them as if Deployment had just run. Also skipped when the cwd is already mapped in `~/.formio/projects.json`.

### Step 4 — MCP Config (build-new only)

**Skipped in plugin mode** — when the `@formio/ai` plugin provides the MCP server (detected via `mcp__plugin_formio-ai_formio-mcp__*` tools or the verify-project-url hook), `project_set` from Step 3 has already routed per-cwd via `~/.formio/projects.json`. No `.mcp.json` to write, no restart; continue to Step 5.

Otherwise, write (or merge) `./.mcp.json` in the workspace root so that Claude Code, on the next session start or MCP reconnect, spawns the `formio-mcp` server against the captured Project URL + Base URL. Without this step, the MCP server runs against whatever env it was spawned with (usually stale or empty) and Step 5 (Import) targets the wrong project.

See [`MCP_CONFIG.md`](./MCP_CONFIG.md) for the file shape, merge semantics (preserve existing command/args, preserve unrelated env keys, preserve unrelated `mcpServers` entries), default-command selection (a single npm-based default, `npx -y @formio/mcp`, with an opt-in escape-hatch for local clones), approval gate, and skip rule (existing entry already matches captured URLs).

**Halt after writing.** Claude Code reads `.mcp.json` at session start, not at tool-call time. The skill halts the current invocation after the write and tells the user to restart Claude Code (or run `/mcp` to reconnect the `formio-mcp` server if supported). When the user resumes, Steps 5–6 run in the next invocation.

If the skip rule applied (file already matches), no restart is needed; the skill continues to Step 5 in the same invocation.

Skipped entirely on the modify-existing branch — the existing app already has its MCP routing configured (plugin or `.mcp.json`).

### Step 5 — Import

Offer to import the planner's `template.json` into the target Form.io project. Approval gate before the call, citing URLs + plain-language template summary + merge-overwrite warning. On approval, invoke the `project_import` MCP tool. Import is additive — existing resources, roles, and forms are preserved; same-machine-name items are overwritten in place.

- **Build-new** → imports the full-project template into a (presumably empty) project.
- **Modify-existing** → imports the delta template; the new resources/fields/actions land alongside what is already there.

Authentication is implicit — the first authenticated MCP tool call (typically this `project_import`) triggers the portal-login flow automatically if no cached JWT exists. The browser opens, the user signs in, the JWT is cached, and the import proceeds. See [`IMPORT.md`](./IMPORT.md) for the full script including the three error-handling branches (auth failure, project not found, import validation failure).

### Step 6 — Framework routing

**6a. `frontend-design` pre-check (runs on BOTH branches, before routing).** Every framework skill authors user-facing UI and is dramatically better at it when Claude's `frontend-design` plugin is loadable. Before routing, check the session's skill registry for `frontend-design` — it registers under the plugin-namespaced name `frontend-design:frontend-design` (the bare name `frontend-design` may also appear; accept either). 

- **If present** → note it ("`frontend-design` is available — the UI will be designed with it") and continue to 6b. Pass `frontendDesignStatus: 'available'` in the handoff.
- **If missing** → it is strongly recommended but not required. Surface one `AskUserQuestion`:

```
AskUserQuestion({
  questions: [
    {
      question: "I strongly recommend installing Claude's frontend-design plugin before I build the UI — it produces a far more polished, distinctive interface instead of generic styling. It's optional, but highly recommended. How would you like to proceed?",
      header: "frontend-design",
      multiSelect: false,
      options: [
        { label: "Install it first (recommended)", description: "I'll guide you to install frontend-design, then you restart Claude Code (or run /plugin) and we resume the build with it active." },
        { label: "Proceed without it", description: "Continue now. The UI will be generated without frontend-design, and every UI file will be flagged as such so you can review it critically." }
      ]
    }
  ]
})
```

  - **Install it first** → tell the user to install the plugin from the official marketplace — interactively via `/plugin` (Browse → `claude-plugins-official` → `frontend-design` → Install) or by running `claude plugin install frontend-design@claude-plugins-official` — followed by a `/reload-plugins`. When they tell you to `continue`, re-run 6a and you should now find the plugin.
  - **Proceed without it** → continue to 6b with `frontendDesignStatus: 'declined'`. The framework skill is responsible for disclosing on every UI approval gate that the file was generated without `frontend-design` consultation, so the user can review it critically. Do NOT silently emit plain UI.

**6b. Route.** Consult the registry in [`FRAMEWORK.md`](./FRAMEWORK.md) and route:

- **Build-new, single installed framework** → silent routing. Today this is `formio-angular`.
- **Build-new, multiple installed frameworks** → present them in one `AskUserQuestion`, let the user pick, then route.
- **Modify-existing** → use the "Detection signal" column of the registry to pick the right framework from the workspace itself (e.g., `angular.json` → Angular). If detection matches exactly one, route directly to the framework's extend sub-skill; if ambiguous, ask the user.

The framework's entry skill (build-new) or extend sub-skill (modify-existing) receives a handoff context with the workspace root, URLs, BOTH planner artifact paths (`template.md` + `template.json`), and (for modify-existing) the list of newly-imported resource names so the sub-skill knows exactly what Angular / React / other files to scaffold for the delta.

## Handoff contracts

When handing off to a framework's entry skill (build-new), pass:

- Absolute workspace path.
- `FORMIO_PROJECT_URL` and `FORMIO_BASE_URL` (captured during Deployment).
- The planner-emitted `template.md` file path (architectural-intent seed).
- The planner-emitted `template.json` file path (structured companion).
- A flag indicating that Import ran successfully (so the framework's SETUP can be skipped).
- `frontendDesignStatus` (`'available'` | `'declined'`) from Step 6a, so the framework skill knows whether to consult `frontend-design` or to disclose UI was generated without it.

When handing off to a framework's extend sub-skill (modify-existing), pass:

- Absolute workspace path.
- `FORMIO_PROJECT_URL` and `FORMIO_BASE_URL` (read from the workspace's `FormioAppConfig` during Step 3's skip path).
- The planner-emitted delta `template.md` file path.
- The planner-emitted delta `template.json` file path.
- The list of newly-imported resource names (so the extend sub-skill scaffolds modules for exactly those).
- The user's plain-language feature request verbatim (the sub-skill translates domain terms into framework primitives).
- `frontendDesignStatus` (`'available'` | `'declined'`) from Step 6a.

## When a step fails

Any failure surfaces a clear, short message to the user and offers a choice: retry, skip, or bail. The user is never left in an ambiguous half-done state. See the per-step docs for the specific error branches each step handles.

## Links

- [`INTENT.md`](./INTENT.md) — Step 1 build-vs-modify script
- [`DEPLOYMENT.md`](./DEPLOYMENT.md) — Step 3 URL interview
- [`MCP_CONFIG.md`](./MCP_CONFIG.md) — Step 4 `.mcp.json` merge + restart gate
- [`IMPORT.md`](./IMPORT.md) — Step 5 import confirmation + error branches
- [`FRAMEWORK.md`](./FRAMEWORK.md) — Step 6 registry + routing
