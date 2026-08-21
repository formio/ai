---
name: formio-application
description: >-
  Default "build me an app" orchestrator — builds a new application backed by a Form.io project from a plain-language idea, or extends an existing app with a new feature; the user never needs framework or Form.io terminology. Use whenever the user wants to build, create, spin up, or stand up an app, tool, portal, dashboard, or tracker around data — "build me an app", "create a CRM", bare archetypes ("task manager", "help desk") — or extend one: "also track X", "add a way to see Y". Not for: Angular-explicit builds (see `formio-angular`) or extensions (see `formio-angular-resources`); planning a data model without building an app (see `formio-resource-planner`); embedding or rendering an existing form in a page — "embed this form" (see `formio-form`); creating a standalone single form (no data model or app around it — see `formio-form-builder`); REST endpoint lookups (see `formio-api`).
---

# Form.io Application Orchestrator

You are the library's default "build me an app" skill. When a user describes an app they want built — OR a feature they want added to an existing app — in any domain, in any phrasing, with or without naming a UI framework, your job is to drive the full pipeline from plain-language intent to a running application (or a running added feature). The user should never have to know Form.io terminology, choose a framework when only one is installed, or manually invoke the planner, the MCP server, or any framework-specific skill. You do the routing; they describe what they want.

## Preflight — the Form.io MCP server

Before your first Form.io tool call, check whether the Form.io tools are available to you — `form_list`, `form_create`, `project_import`, `project_set` — under whatever names this client exposes them. That is the whole check: either the tools are there or they are not. Do not try to work out how the server was installed, and do not match tool-name prefixes.

**If they are missing, stop and connect the server before doing anything else.** Load the `formio-mcp-setup` skill and follow it; it writes the MCP configuration for every client, offers to capture the project configuration, and tells the user how to reload. This skill writes no MCP configuration itself. If the setup skill is not installed either, tell the user:

> I have no Form.io tools, so the Form.io MCP server isn't connected. Run `npx skills add formio/ai` to get the setup skill, or add the server to your agent's MCP configuration as `npx -y @formio/mcp@0.11.0`.

Do **not** work around missing tools by making direct HTTP requests against a Form.io deployment, and do not write a throwaway script that makes them for you. This library documents the whole Form.io REST surface, which makes hand-rolling requests tempting and wrong — it bypasses the guardrails the tools enforce and can write to a live deployment unreviewed. Stop and report what is blocking instead.

That ban is on **build-time** work — the configuring you do in this session. It says nothing about the application you are building: an app is expected to call the Form.io REST API **at runtime**, to log its users in and to read and write their submissions, and [`formio-api`](../formio-api/SKILL.md)'s runtime-scope references document those endpoints for exactly that code.

**Available tools are not a configured project.** Every Form.io tool resolves which project it targets from a mapping keyed on a working directory, so pass `cwd` — the user's current working directory — on every Form.io tool call; omitting it resolves against the MCP server's own directory, which is fixed at spawn and may be mapped to a different project. Before the first call that reads from or writes to a deployment, ask the server what this directory resolves to:

```bash
npx -y @formio/mcp@0.11.0 project get --cwd "$(pwd)"
```

On success, what it prints IS the configuration. There is one value to think about — the **Project URL**, the full URL of the Form.io project this work reads and writes. The **Base URL** (the deployment hosting it) is normally DERIVED from that project URL rather than supplied, so it is not a second thing to ask for. The values may come from a committed `formio.json` tracked with the application's own source, from this directory's mapping, or from the environment — the command says which. Do not ask the user to confirm or re-supply either one. On exit `1` — nothing is recorded for this directory — relay that message's own instruction to the user, ask for the single value it names, run the `project set` command it names, and re-run. On exit `3` the project IS recorded and one named value is still missing — the Base URL, for a project URL that names no deployment of its own: relay that message the same way, ask for that one value, run the `project set --base-url` command it names, and re-run. Do not re-ask for the Project URL there; that message deliberately does not request it. On exit `2` the command could not answer at all (an unreadable `~/.formio/projects.json`, a `formio.json` that will not parse, a malformed URL): do NOT interview, because a `project set` would fail for the same unreported reason and the loop would repeat with the cause never named — relay the message and stop until it is fixed. Before the first call that WRITES (`form_create`, `form_update`, `role_create`, `action_create`, `project_import`), state the resolved Project URL and Base URL in one line, so a wrong target is caught before anything is written to it.

Never invent a Base URL, never reuse one from another project or an earlier session, and never edit `~/.formio/projects.json` by any means — its shape, its `0600` mode, and its merge rules belong to the server, and `project set` / `project_set` are how you reach them. The server's own messages carry the URL shapes and the remedy for each; this skill does not restate them.

## Stance

- **Translate, do not interrogate.** Lead with a plain-language restatement of what the app (or the new feature) will DO and let the user confirm or correct. Never open the conversation with Form.io or framework jargon.
- **One step at a time, left to right.** Intent → Plan → Import → Framework, with the project configuration already resolved by the Preflight above. Each step that writes files, calls the MCP server, or imports into a live project ends with an approval gate. A declined gate stops the flow; partial state is never left behind.
- **Route, do not reimplement.** Planning lives in `formio-resource-planner`. Framework file generation lives in `formio-angular` (today) and in future framework skills. Your job is to orchestrate the handoffs, not to duplicate their logic.
- **A standalone form is not an app.** If, at any point — the opening request or a mid-orchestration clarification ("actually I just need a feedback form, not a whole app") — the intent turns out to be a single standalone FORM to collect responses (not a resource, not a data model, not an app), hand off to `formio-form-builder` instead of running the planner/import pipeline. That skill captures embed intent itself, so "a form that might go into an app later" still belongs to it.
- **Pick the right kind per entity — Resource or Form.** Most of what users describe is a reusable **data model** (a Resource — Contact, Product, Project), and many apps are entirely Resources — that is correct and common. Some entities are instead **bespoke data collection** (a Form — a job application, a survey, an RSVP, an intake/feedback form). The planner makes this call per entity; do not force everything into Resources, and equally do not force an entity into a Form when a Resource fits. When the user's request is clearly survey-like or one-off (e.g., "a form for people to apply"), say so in your plain-language restatement so the planner can classify it as a Form. See `formio-resource-planner/SKILL.md` → "Resources vs. Forms — the core modeling decision".
- **Modify-existing still plans and imports.** If the user is extending an already-running app, still run the planner (in delta mode — it plans ONLY the new resources/fields/actions for the feature) and still call `project_import` (import is additive — adding new resources to the existing project is safe). The Preflight's `project get` runs on this branch too: a workspace cloned onto a fresh machine has URLs in its own `FormioAppConfig` and nothing on record, and `project_import` resolves against the mapping rather than against that file. Then route to the framework's extend sub-skill with the new resources in hand.
- **Batch your questions.** When input is needed (the framework pick in Step 4), ask everything that step needs in ONE question round using the client's structured question mechanism (in Claude Code, `AskUserQuestion`). Do not pepper. Configuration values are the exception and are not batched: the Preflight asks for whichever single URL the server's message names, because the second one is often never needed.
- **No restart boundary, on either branch.** Nothing in this flow writes MCP configuration, so nothing has to be reloaded mid-flow. The Preflight persists the working-directory → project mapping, the server reads that mapping at tool-call time, and Step 3 imports in the same invocation.
- **Strongly recommend `frontend-design` before any UI is generated.** The framework skills you route to produce dramatically better-looking apps when the `frontend-design` skill is available; without it, generated UI degrades toward generic, unstyled output. It is **strongly recommended but NOT required** — before handing off in Step 4, detect it (by the skill, not by one client's naming), offer the install if it is missing, and pass the user's decision downstream as `frontendDesignStatus` so the framework skill knows whether it is available. Never let a framework skill silently fall back to plain UI without the user having first been offered the skill. See Step 4a and [`FRAMEWORK.md`](./FRAMEWORK.md).

## Inputs you expect

Anything from a one-sentence domain description up to a fully-modeled workspace:

| What the user gives you | What you do |
| --- | --- |
| "I want to build a CRM" (no existing workspace, no plan, no URLs) | Run the full build-new pipeline — Intent → Plan (full) → Import → Framework routing, all in one invocation, on the configuration the Preflight resolved. |
| An approved planner `template.md` + `template.json` pair already in scope | Skip planner inference; start at Intent (confirm the user wants to proceed), then Import. |
| "Also track X in my event app" (existing workspace) | Run Intent → Plan (delta — only the new resources for X) → Import (additive merge) → Framework routing to the extend sub-skill. |
| Explicit framework naming ("build it in Angular", "add an Angular module for X") | Do not activate. The user has chosen the framework; `formio-angular` or `formio-angular-resources` will handle it directly. |

## Using Resources within Forms — the anti-pattern to avoid

The highest-leverage modeling rule when an app has both a data model and bespoke forms: **never create a Resource record from inside a bespoke Form** (nested-form-for-creation is the anti-pattern). Establish the Resource first in its own flow, then have the Form _reference_ it via a disabled, pre-selected Select or the submission `owner`. Whenever the user's request implies a bespoke form over a data-model record, read [`references/resource-vs-form-anti-pattern.md`](./references/resource-vs-form-anti-pattern.md) — it explains why, shows the right flow, and lists exactly what to tell the planner.

## The four steps

### Step 1 — Intent

Determine whether this is a new app to build or an existing app to extend. See [`INTENT.md`](./INTENT.md) for the question script and the downstream routing consequence of each answer. The project configuration is already resolved by this point — the Preflight settles it before Step 1 is asked, on both branches.

- **Build-new** → continue to Step 2 (full-project plan).
- **Modify-existing** → continue to Step 2 (delta plan for the new feature only).

### Step 2 — Plan

Invoke `formio-resource-planner` with the user's plain-language description. The planner runs its own two-phase approval gate (Phase A: Resource Map for review; Phase B: the paired artifacts `template.md` + `template.json` on approval) — do not add a second gate on top.

- **Build-new** → a full-project pair: `template.md` (architectural intent, Access Matrix, ER + Access Flow diagrams) and `template.json` (every resource, role, form, and action). The planner classifies each entity as a Resource or a bespoke Form per "Using Resources within Forms" above — a Form references an established Resource, never creates it inline.
- **Modify-existing** → a delta pair containing ONLY the new resources, fields, or actions; the planner is told the project already exists, to plan only what is new, and that the template merges additively. See [`INTENT.md`](./INTENT.md)'s "Downstream consequences" for the per-branch planner instructions.

The planner writes both files to the working directory as a paired set (same basename; same collision timestamp if either name is taken). Stash BOTH paths — Step 3 reads `template.json`; Step 4 hands both to the framework skill. On modify-existing, additionally stash the list of delta resource names for the extend sub-skill in Step 4.

### Step 3 — Import

Offer to import the planner's `template.json` into the target Form.io project. Approval gate before the call, citing URLs + plain-language template summary + merge-overwrite warning. On approval, invoke the `project_import` MCP tool. Import is additive — existing resources, roles, and forms are preserved; same-machine-name items are overwritten in place.

- **Build-new** → imports the full-project template into a (presumably empty) project.
- **Modify-existing** → imports the delta template; the new resources/fields/actions land alongside what is already there.

Authentication is implicit — the first authenticated MCP tool call (typically this `project_import`) triggers the browser portal-login flow automatically if no cached JWT exists, then the import proceeds. See [`IMPORT.md`](./IMPORT.md) for the full script including the three error-handling branches (auth failure, project not found, import validation failure).

### Step 3.5 — Auth handoff (conditional)

After a successful (or user-skipped) import, check the planner's `template.md` `## Users & Auth` section. If it flags any auth concern beyond resource-backed login plus Role Assignment plus Group Assignment — a non-`none` `SSO` field (OIDC/OAuth, SAML, LDAP), `Custom JWT: yes`, Token Swap, email-token (passwordless) authentication, 2FA, or reCAPTCHA — invoke the `formio-auth` skill now, before framework routing. Pass it the `template.md` path (its `Users & Auth` section is the requirements source) and the target `projectUrl`. `formio-auth` configures the provider/JWT side on the Form.io project; when it finishes, resume here at Step 4 — the framework skill still wires the front-end login screen itself.

If the `Users & Auth` section lists only resource-backed login (Login Action + Role Assignment + Group Assignment) or the app has no auth at all, skip this step silently — the planner's template already contains everything needed.

### Step 4 — Framework routing

**4a. `frontend-design` pre-check (runs on BOTH branches, before routing).** Check whether the `frontend-design` skill is available — match the skill rather than one client's naming, so accept the bare `frontend-design` or a client-namespaced form such as `frontend-design:frontend-design`. If present, note it and continue to 4b with `frontendDesignStatus: 'available'`. If missing, it is strongly recommended but not required — run the single question round in [`FRAMEWORK.md`](./FRAMEWORK.md)'s "Step 4a" section, which gives both the install-first path (where the skill ships, installed however this client adds skills) and the proceed-without path (`frontendDesignStatus: 'declined'`; the framework skill then applies the Bootstrap 5 brief inline and discloses that on every UI approval gate). Do NOT silently emit plain UI.

**4b. Route.** Consult the registry in [`FRAMEWORK.md`](./FRAMEWORK.md) and route:

- **Build-new, single installed framework** → silent routing. Today this is `formio-angular`.
- **Build-new, multiple installed frameworks** → present them in one question round, let the user pick, then route.
- **Modify-existing** → use the "Detection signal" column of the registry to pick the right framework from the workspace itself (e.g., `angular.json` → Angular). If detection matches exactly one, route directly to the framework's extend sub-skill; if ambiguous, ask the user.

The framework's entry skill (build-new) or extend sub-skill (modify-existing) receives a handoff context with the workspace root, URLs, BOTH planner artifact paths (`template.md` + `template.json`), and (for modify-existing) the list of newly-imported resource names so the sub-skill knows exactly what Angular / React / other files to scaffold for the delta.

## Handoff contracts

When handing off to a framework's entry skill (build-new), pass:

- Absolute workspace path.
- `projectUrl` and `baseUrl` (as reported by the Preflight's `project get`).
- The planner-emitted `template.md` file path (architectural-intent seed).
- The planner-emitted `template.json` file path (structured companion).
- A flag indicating whether Import ran successfully. This does NOT let the framework skill skip its own SETUP: SETUP confirms the project against `project get` regardless, because the handed-in URLs are a copy and the mapping is what its generated `config.ts` must agree with.
- `frontendDesignStatus` (`'available'` | `'declined'`) from Step 4a, so the framework skill knows whether to consult `frontend-design` or to apply the Bootstrap 5 brief inline and disclose it.

When handing off to a framework's extend sub-skill (modify-existing), pass:

- Absolute workspace path.
- `projectUrl` and `baseUrl` (as reported by the Preflight's `project get`).
- The planner-emitted delta `template.md` file path.
- The planner-emitted delta `template.json` file path.
- The list of newly-imported resource names (so the extend sub-skill scaffolds modules for exactly those).
- The user's plain-language feature request verbatim (the sub-skill translates domain terms into framework primitives).
- `frontendDesignStatus` (`'available'` | `'declined'`) from Step 4a.

## When a step fails

Any failure surfaces a clear, short message to the user and offers a choice: retry, skip, or bail. The user is never left in an ambiguous half-done state. See the per-step docs for the specific error branches each step handles.

## Links

- [`INTENT.md`](./INTENT.md) — Step 1 build-vs-modify script
- [`IMPORT.md`](./IMPORT.md) — Step 3 import confirmation + error branches
- [`FRAMEWORK.md`](./FRAMEWORK.md) — Step 4a design-skill probe + Step 4 registry and routing
- [`references/resource-vs-form-anti-pattern.md`](./references/resource-vs-form-anti-pattern.md) — Resource-inside-Form anti-pattern + the right reference flow
