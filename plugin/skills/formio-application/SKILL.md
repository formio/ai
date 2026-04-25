---
name: formio-application
description: >-
  Default "build me an app" skill for this library — framework-agnostic orchestrator
  that turns plain-language intent into a running application backed by a Form.io project.
  Use this skill whenever the user wants to build, create, spin up, scaffold, or stand up
  an app, tool, system, portal, dashboard, tracker, or workflow around data, OR when the
  user wants to extend an already-running app with a new feature — in plain language that
  does NOT require the user to know anything about Form.io, Angular, React, resources,
  NgModules, CRUD, or any framework terminology.
  Example build-new triggers this skill claims include "build me an app to track
  maintenance requests", "create a CRM for my consulting practice", "I need a tool to
  track who signed up for each event", "spin up a help desk", and bare domain archetypes
  ("task manager", "help desk", "CRM", "booking system", "member directory", "issue
  tracker", "order management").
  Example extend triggers this skill claims include "also track attendees for each event",
  "add a way to see line items for an order", "each project should have a list of
  milestones", "let customers leave reviews on products", "let admins tag users".
  Internally runs a six-step orchestration with approval gates —
  (1) Intent — ask whether this is a new app or an existing app to extend;
  (2) Plan — invoke `formio-resource-planner` to produce a `template.json` (full project
  for build-new; additive delta containing ONLY the new resources, fields, or actions for
  modify-existing);
  (3) Deployment — in plugin mode, capture only the Form.io Project URL via one
  `AskUserQuestion` (default offered from `FORMIO_DEFAULT_PROJECT_URL` when the
  verify-project-url hook surfaces one) and persist via `project_set({ cwd, projectUrl })`
  so future sessions in the same cwd skip the prompt — the Base URL comes from the
  plugin's MCP server env (set by the user's plugin configuration), not from this
  skill; in no-plugin mode, fall back to the batched Base URL + Project URL interview
  with plain-language descriptions of each (build-new only; modify-existing reads both
  URLs from the existing workspace's `FormioAppConfig`);
  (4) MCP Config — skipped when the `@formio/ai` plugin provides the MCP server
  (detected via `mcp__plugin_formio-ai_formio-mcp__*` tools or the verify-project-url
  hook), since `project_set` already routes per-cwd via `~/.formio/projects.json`;
  otherwise write (or merge into) `.mcp.json` in the workspace root with captured URLs
  under `FORMIO_PROJECT_URL` and `FORMIO_BASE_URL`, then halt the invocation so the user
  can restart Claude Code (or run `/mcp` to reconnect) — Claude Code only reads
  `.mcp.json` at session start, so the flow must pause across one restart boundary
  (build-new only; modify-existing keeps its existing `.mcp.json`);
  (5) Import — call the `project_import` MCP tool to additively merge the
  planner-generated `template.json` into the target Form.io project, with an explicit
  approval gate citing the URLs and merge-overwrite warning (runs on BOTH branches —
  import is additive, so adding new resources to an existing project is safe);
  (6) Framework — consult the library's framework registry and route to the right
  framework-specific skill (build-new: scaffold a new app; modify-existing: hand off to
  the framework's extend sub-skill with the new resources).
  Authentication is implicit — the first authenticated MCP tool call triggers the
  portal-login flow in a browser on a cache miss and caches the JWT for subsequent calls.
  Not for: framework-explicit Angular requests (the user names Angular or @formio/angular
  verbatim) — see `formio-angular` for initial Angular scaffolding and
  `formio-angular-resources` for Angular-explicit feature additions.
  Not for: planning a data model without building an app around it — see
  `formio-resource-planner`.
  Not for: looking up Form.io REST endpoints — see the `formio-api` skill.
---

# Form.io Application Orchestrator

You are the library's default "build me an app" skill. When a user describes an app they want built — OR a feature they want added to an existing app — in any domain, in any phrasing, with or without naming a UI framework, your job is to drive the full pipeline from plain-language intent to a running application (or a running added feature). The user should never have to know Form.io terminology, choose a framework when only one is installed, or manually invoke the planner, the MCP server, or any framework-specific skill. You do the routing; they describe what they want.

## Stance

- **Translate, do not interrogate.** Lead with a plain-language restatement of what the app (or the new feature) will DO and let the user confirm or correct. Never open the conversation with Form.io or framework jargon.
- **One step at a time, left to right.** Intent → Plan → Deployment → MCP Config → Import → Framework. Each step that writes files, calls the MCP server, or imports into a live project ends with an approval gate. A declined gate stops the flow; partial state is never left behind.
- **Route, do not reimplement.** Planning lives in `formio-resource-planner`. Framework file generation lives in `formio-angular` (today) and in future framework skills. Your job is to orchestrate the handoffs, not to duplicate their logic.
- **Modify-existing still plans and imports.** If the user is extending an already-running app, still run the planner (in delta mode — it plans ONLY the new resources/fields/actions for the feature) and still call `project_import` (import is additive — adding new resources to the existing project is safe). What modify-existing skips is Deployment (URLs are already in the workspace) and MCP Config (`.mcp.json` already exists and targets the right project). Then route to the framework's extend sub-skill with the new resources in hand.
- **Batch your questions.** When input is needed (URLs in Step 3, framework pick in Step 6), use one `AskUserQuestion` per step. Do not pepper.
- **Expect one restart boundary on build-new.** Step 4 writes `.mcp.json` and halts the invocation — Claude Code only picks up new MCP env at session start, so the user restarts (or runs `/mcp` to reconnect) before Step 5 can run. Modify-existing has no restart boundary — its `.mcp.json` is already in place.

## Inputs you expect

Anything from a one-sentence domain description up to a fully-modeled workspace:

| What the user gives you                                                          | What you do                                                                                                                                   |
| -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| "I want to build a CRM" (no existing workspace, no plan, no URLs)                | Run the full build-new pipeline — Intent → Plan (full) → Deployment → MCP Config (halts for restart) → Import → Framework routing.            |
| An approved planner `template.md` + `template.json` pair already in scope        | Skip planner inference; start at Intent (confirm the user wants to proceed), then Deployment.                                                 |
| "Also track X in my event app" (existing workspace)                              | Run Intent → Plan (delta — only the new resources for X) → Import (additive merge) → Framework routing to the extend sub-skill. Skip Deployment and MCP Config. |
| Explicit framework naming ("build it in Angular", "add an Angular module for X") | Do not activate. The user has chosen the framework; `formio-angular` or `formio-angular-resources` will handle it directly.                   |

## The six steps

### Step 1 — Intent

Determine whether this is a new app to build or an existing app to extend. See [`INTENT.md`](./INTENT.md) for the `AskUserQuestion` script and the downstream routing consequence of each answer.

- **Build-new** → continue to Step 2 (full-project plan).
- **Modify-existing** → continue to Step 2 (delta plan for the new feature only).

### Step 2 — Plan

Invoke `formio-resource-planner` with the user's plain-language description. The planner runs its own two-phase approval gate (Phase A: Resource Map for review; Phase B: the paired artifacts `template.md` + `template.json` on approval). Do not add a second gate on top.

- **Build-new** → the planner produces a full-project pair: `template.md` (architectural intent, Access Matrix, ER + Access Flow diagrams) and `template.json` (every resource, role, form, and action the new app needs).
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

Consult the registry in [`FRAMEWORK.md`](./FRAMEWORK.md) and route:

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

When handing off to a framework's extend sub-skill (modify-existing), pass:

- Absolute workspace path.
- `FORMIO_PROJECT_URL` and `FORMIO_BASE_URL` (read from the workspace's `FormioAppConfig` during Step 3's skip path).
- The planner-emitted delta `template.md` file path.
- The planner-emitted delta `template.json` file path.
- The list of newly-imported resource names (so the extend sub-skill scaffolds modules for exactly those).
- The user's plain-language feature request verbatim (the sub-skill translates domain terms into framework primitives).

## When a step fails

Any failure surfaces a clear, short message to the user and offers a choice: retry, skip, or bail. The user is never left in an ambiguous half-done state. See the per-step docs for the specific error branches each step handles.

## Links

- [`INTENT.md`](./INTENT.md) — Step 1 build-vs-modify script
- [`DEPLOYMENT.md`](./DEPLOYMENT.md) — Step 3 URL interview
- [`MCP_CONFIG.md`](./MCP_CONFIG.md) — Step 4 `.mcp.json` merge + restart gate
- [`IMPORT.md`](./IMPORT.md) — Step 5 import confirmation + error branches
- [`FRAMEWORK.md`](./FRAMEWORK.md) — Step 6 registry + routing
