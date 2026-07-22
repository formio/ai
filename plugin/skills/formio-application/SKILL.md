---
name: formio-application
description: >-
  Default "build me an app" orchestrator — builds a new application backed by a Form.io project from a plain-language idea, or extends an existing app with a new feature; the user never needs framework or Form.io terminology. The flow writes a `.mcp.json` in the workspace root and pauses for a Claude Code restart after that write. Use whenever the user wants to build, create, spin up, or stand up an app, tool, portal, dashboard, or tracker around data — "build me an app", "create a CRM", bare archetypes ("task manager", "help desk") — or extend one: "also track X", "add a way to see Y". Not for: Angular-explicit builds (see `formio-angular`) or extensions (see `formio-angular-resources`); planning a data model without building an app (see `formio-resource-planner`); embedding or rendering an existing form in a page — "embed this form" (see `formio-form`); creating a standalone single form (no data model or app around it — see `formio-form-builder`); REST endpoint lookups (see `formio-api`).
---

# Form.io Application Orchestrator

You are the library's default "build me an app" skill. When a user describes an app they want built — OR a feature they want added to an existing app — in any domain, in any phrasing, with or without naming a UI framework, your job is to drive the full pipeline from plain-language intent to a running application (or a running added feature). The user should never have to know Form.io terminology, choose a framework when only one is installed, or manually invoke the planner, the MCP server, or any framework-specific skill. You do the routing; they describe what they want.

## Stance

- **Translate, do not interrogate.** Lead with a plain-language restatement of what the app (or the new feature) will DO and let the user confirm or correct. Never open the conversation with Form.io or framework jargon.
- **One step at a time, left to right.** Intent → Plan → Deployment → MCP Config → Import → Framework. Each step that writes files, calls the MCP server, or imports into a live project ends with an approval gate. A declined gate stops the flow; partial state is never left behind.
- **Route, do not reimplement.** Planning lives in `formio-resource-planner`. Framework file generation lives in `formio-angular` (today) and in future framework skills. Your job is to orchestrate the handoffs, not to duplicate their logic.
- **A standalone form is not an app.** If, at any point — the opening request or a mid-orchestration clarification ("actually I just need a feedback form, not a whole app") — the intent turns out to be a single standalone FORM to collect responses (not a resource, not a data model, not an app), hand off to `formio-form-builder` instead of running the planner/import pipeline. That skill captures embed intent itself, so "a form that might go into an app later" still belongs to it.
- **Pick the right kind per entity — Resource or Form.** Most of what users describe is a reusable **data model** (a Resource — Contact, Product, Project), and many apps are entirely Resources — that is correct and common. Some entities are instead **bespoke data collection** (a Form — a job application, a survey, an RSVP, an intake/feedback form). The planner makes this call per entity; do not force everything into Resources, and equally do not force an entity into a Form when a Resource fits. When the user's request is clearly survey-like or one-off (e.g., "a form for people to apply"), say so in your plain-language restatement so the planner can classify it as a Form. See `formio-resource-planner` → "Resources vs. Forms — the core modeling decision".
- **Modify-existing still plans and imports.** If the user is extending an already-running app, still run the planner (in delta mode — it plans ONLY the new resources/fields/actions for the feature) and still call `project_import` (import is additive — adding new resources to the existing project is safe). What modify-existing skips is Deployment (URLs are already in the workspace) and MCP Config (`.mcp.json` already exists and targets the right project). Then route to the framework's extend sub-skill with the new resources in hand.
- **Batch your questions.** When input is needed (URLs in Step 3, framework pick in Step 6), use one `AskUserQuestion` per step. Do not pepper.
- **Expect one restart boundary on build-new.** Step 4 writes `.mcp.json` and halts the invocation — Claude Code only picks up new MCP env at session start, so the user restarts (or runs `/mcp` to reconnect) before Step 5 can run. Modify-existing has no restart boundary — its `.mcp.json` is already in place.
- **Strongly recommend the `frontend-design` plugin before any UI is generated.** The framework skills you route to produce dramatically better-looking apps when Claude's `frontend-design` plugin is available; without it, generated UI degrades to generic, unstyled output. It is **strongly recommended but NOT required** — before handing off in Step 6, detect it, offer the install (with the exact command) if missing, and pass the user's decision downstream (`frontendDesignStatus`) so the framework skill knows whether it is available. Never let a framework skill silently fall back to plain/unstyled output without the user having first been offered the plugin. See Step 6a and [`FRAMEWORK.md`](./FRAMEWORK.md).

## Inputs you expect

Anything from a one-sentence domain description up to a fully-modeled workspace:

| What the user gives you | What you do |
| --- | --- |
| "I want to build a CRM" (no existing workspace, no plan, no URLs) | Run the full build-new pipeline — Intent → Plan (full) → Deployment → MCP Config (halts for restart) → Import → Framework routing. |
| An approved planner `template.md` + `template.json` pair already in scope | Skip planner inference; start at Intent (confirm the user wants to proceed), then Deployment. |
| "Also track X in my event app" (existing workspace) | Run Intent → Plan (delta — only the new resources for X) → Import (additive merge) → Framework routing to the extend sub-skill. Skip Deployment and MCP Config. |
| Explicit framework naming ("build it in Angular", "add an Angular module for X") | Do not activate. The user has chosen the framework; `formio-angular` or `formio-angular-resources` will handle it directly. |

## Using Resources within Forms — the anti-pattern to avoid

The highest-leverage modeling rule when an app has both a data model and bespoke forms: **never create a Resource record from inside a bespoke Form** (nested-form-for-creation is the anti-pattern). Establish the Resource first in its own flow, then have the Form _reference_ it via a disabled, pre-selected Select or the submission `owner`. Whenever the user's request implies a bespoke form over a data-model record, read [`references/resource-vs-form-anti-pattern.md`](./references/resource-vs-form-anti-pattern.md) — it explains why, shows the right flow, and lists exactly what to tell the planner.

## The six steps

### Step 1 — Intent

Determine whether this is a new app to build or an existing app to extend. See [`INTENT.md`](./INTENT.md) for the `AskUserQuestion` script and the downstream routing consequence of each answer.

- **Build-new** → continue to Step 2 (full-project plan).
- **Modify-existing** → continue to Step 2 (delta plan for the new feature only).

### Step 2 — Plan

Invoke `formio-resource-planner` with the user's plain-language description. The planner runs its own two-phase approval gate (Phase A: Resource Map for review; Phase B: the paired artifacts `template.md` + `template.json` on approval) — do not add a second gate on top.

- **Build-new** → a full-project pair: `template.md` (architectural intent, Access Matrix, ER + Access Flow diagrams) and `template.json` (every resource, role, form, and action). The planner classifies each entity as a Resource or a bespoke Form per "Using Resources within Forms" above — a Form references an established Resource, never creates it inline.
- **Modify-existing** → a delta pair containing ONLY the new resources, fields, or actions; the planner is told the project already exists, to plan only what is new, and that the template merges additively. See [`INTENT.md`](./INTENT.md)'s "Downstream consequences" for the per-branch planner instructions.

The planner writes both files to the working directory as a paired set (same basename; same collision timestamp if either name is taken). Stash BOTH paths — Step 5 reads `template.json`; Step 6 hands both to the framework skill. On modify-existing, additionally stash the list of delta resource names for the extend sub-skill in Step 6.

### Step 3 — Deployment (build-new only)

**Plugin mode.** Capture only the Form.io Project URL in one `AskUserQuestion` — the verify-project-url hook surfaces `FORMIO_DEFAULT_PROJECT_URL` as the default option. Call `project_set({ cwd, projectUrl })` to persist per-cwd routing so future sessions skip the prompt. Do NOT ask for Base URL.

**No-plugin mode.** Capture the Form.io deployment URLs in one batched question (Base URL + Project URL); no `project_set` call.

See [`DEPLOYMENT.md`](./DEPLOYMENT.md) for plugin-mode detection, the question shapes, plain-language URL descriptions, validation, Base-URL derivation, and how the values are stashed under `FORMIO_PROJECT_URL` and `FORMIO_BASE_URL` for downstream phases.

Skipped on the modify-existing branch — read the URLs from the workspace's `FormioAppConfig` (`src/app/config.ts` or the framework equivalent) and stash them as if Deployment had just run. Also skipped when the cwd is already mapped in `~/.formio/projects.json`.

### Step 4 — MCP Config (build-new only)

**Skipped in plugin mode** — when the `@formio/ai` plugin provides the MCP server (detected via `mcp__plugin_formio-ai_formio-mcp__*` tools or the verify-project-url hook), `project_set` from Step 3 has already routed per-cwd via `~/.formio/projects.json`. No `.mcp.json` to write, no restart; continue to Step 5.

Otherwise, write (or merge) `./.mcp.json` in the workspace root, behind an approval gate, so Claude Code spawns the `formio-mcp` server against the captured Project URL + Base URL — without it, Step 5 (Import) targets the wrong project. **Halt after writing:** Claude Code reads `.mcp.json` at session start, not at tool-call time, so tell the user to restart (or run `/mcp` to reconnect); Steps 5–6 run in the next invocation. If the skip rule applied (existing entry already matches the captured URLs), no restart — continue to Step 5 in the same invocation. See [`MCP_CONFIG.md`](./MCP_CONFIG.md) for plugin-mode detection, the file shape, merge semantics, default-command selection (`npx -y @formio/mcp`, with a local-clone escape hatch), the approval gate, and the skip rule.

Skipped entirely on the modify-existing branch — the existing app already has its MCP routing configured (plugin or `.mcp.json`).

### Step 5 — Import

Offer to import the planner's `template.json` into the target Form.io project. Approval gate before the call, citing URLs + plain-language template summary + merge-overwrite warning. On approval, invoke the `project_import` MCP tool. Import is additive — existing resources, roles, and forms are preserved; same-machine-name items are overwritten in place.

- **Build-new** → imports the full-project template into a (presumably empty) project.
- **Modify-existing** → imports the delta template; the new resources/fields/actions land alongside what is already there.

Authentication is implicit — the first authenticated MCP tool call (typically this `project_import`) triggers the browser portal-login flow automatically if no cached JWT exists, then the import proceeds. See [`IMPORT.md`](./IMPORT.md) for the full script including the three error-handling branches (auth failure, project not found, import validation failure).

### Step 5.5 — Auth handoff (conditional)

After a successful (or user-skipped) import, check the planner's `template.md` `## Users & Auth` section. If it flags any auth concern beyond resource-backed login plus Role Assignment plus Group Assignment — a non-`none` `SSO` field (OIDC/OAuth, SAML, LDAP), `Custom JWT: yes`, Token Swap, email-token (passwordless) authentication, 2FA, or reCAPTCHA — invoke the `formio-auth` skill now, before framework routing. Pass it the `template.md` path (its `Users & Auth` section is the requirements source) and the target `FORMIO_PROJECT_URL`. `formio-auth` configures the provider/JWT side on the Form.io project; when it finishes, resume here at Step 6 — the framework skill still wires the front-end login screen itself.

If the `Users & Auth` section lists only resource-backed login (Login Action + Role Assignment + Group Assignment) or the app has no auth at all, skip this step silently — the planner's template already contains everything needed.

### Step 6 — Framework routing

**6a. `frontend-design` pre-check (runs on BOTH branches, before routing).** Check the session's skill registry for Claude's `frontend-design` plugin — it registers under the plugin-namespaced name `frontend-design:frontend-design` (the bare name may also appear; accept either). If present, note it and continue to 6b with `frontendDesignStatus: 'available'`. If missing, it is strongly recommended but not required — run the single `AskUserQuestion` in [`FRAMEWORK.md`](./FRAMEWORK.md)'s "Step 6a" section, which also gives the install-first path (marketplace command, `/reload-plugins`, re-run 6a) and the proceed-without path (`frontendDesignStatus: 'declined'`; the framework skill must then disclose on every UI approval gate that the file was generated without `frontend-design`). Do NOT silently emit plain UI.

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
- [`FRAMEWORK.md`](./FRAMEWORK.md) — Step 6a `frontend-design` pre-check + Step 6 registry and routing
- [`references/resource-vs-form-anti-pattern.md`](./references/resource-vs-form-anti-pattern.md) — Resource-inside-Form anti-pattern + the right reference flow
