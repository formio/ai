---
name: formio-angular-resources
description: >-
  Angular-explicit extension sub-skill for the Form.io skill library — adds, regenerates, or repairs one resource NgModule in an Angular workspace whose `AppModule` already has `FormioAppConfig` wired. Invoked by user phrasing that names Angular verbatim, or by handoff from `formio-angular` (itself possibly invoked by `formio-application`). Claims ONLY triggers naming Angular or `@formio/angular`: "add an Angular module for X", "regenerate the Angular `Participant` resource module", "in my Angular app, wire `X`'s children to `Y`", "add a bidirectional Angular join between `Team` and `User`". Does NOT claim framework-agnostic extension phrasing. Not for: initial Angular-app creation, or a workspace where `FormioAppConfig` is not yet wired into `AppModule` — see `formio-angular`; extension requests that never name Angular — see `formio-application`, which routes here when the framework is Angular; shaping a data model in isolation — see `formio-resource-planner`; REST endpoint lookups — see `formio-api`.
---

# Form.io Resource → Angular CRUD

> **Nested sub-skill.** This file lives at `plugin/skills/formio-angular/formio-angular-resources/SKILL.md` — a sub-folder of the `formio-angular` skill. The `name: formio-angular-resources` frontmatter is preserved for documentation and eval tooling, but this is NOT a separately-registered top-level skill: callers (the `formio-angular` parent, or `formio-application` Step 5) load this file directly by path, the same way `formio-angular` loads `SETUP.md` / `BOOTSTRAP.md` / `CONFIG.md` / `AUTH.md`. Do not invoke it by frontmatter name — load the file.

Turn a Form.io Resource Map into a working Angular application whose CRUD screens are wired through `@formio/angular`'s `FormioResource` module — one module per resource, nested parent/child routing, and bidirectional N:N joins generated from the map.

## Preflight — the Form.io MCP server

Before your first Form.io tool call, check that the Form.io MCP tools are available to you — `form_list`, `form_create`, `project_import`, `project_set`.

**If they are missing, stop and connect the server before doing anything else.** Load the `formio-mcp-setup` skill and follow it; it writes the MCP configuration for every client and tells the user how to reload. If that skill is not installed either, tell the user:

> I have no Form.io tools, so the Form.io MCP server isn't connected. Run `npx skills add formio/ai` to get the setup skill, or add the server to your agent's MCP configuration as `npx -y @formio/mcp@0.10.0`.

Do **not** work around missing tools by making direct HTTP requests against a Form.io deployment, and do not write a throwaway script that makes them for you. This library documents the whole Form.io REST surface, which makes hand-rolling requests tempting and wrong — it bypasses the guardrails the tools enforce and can write to a live deployment unreviewed. Stop and report what is blocking instead.

That ban is on **build-time** work — the configuring you do in this session. It says nothing about the application you are building: an app is expected to call the Form.io REST API **at runtime**, to log its users in and to read and write their submissions, and [`formio-api`](../../formio-api/SKILL.md)'s runtime-scope references document those endpoints for exactly that code.

## Feature shapes this skill handles

Four shapes, all driven from the planner's Resource Map — every one of them ends in resource NgModules wired through `FormioResourceRoutes()`:

1. **Simple new resource** — one browsable resource, one module, one route.
2. **Parent → child hierarchy** (e.g., `Event → Participant`) — the child module mounts as a child route under the parent's `:id/` view, filtered by the parent id.
3. **Bidirectional many-to-many join** around a join resource (e.g., `Team ↔ User` via a `TeamUser` join) — two sibling modules, each mounted under the opposite side's `:id/` view.
4. **Transitive group-access hierarchy** — a resource whose access is inherited through a parent's group reference; the narrowing stays server-side in field-based `submissionAccess`, and the module only carries the authentication guard.

Two-phase cadence, with a hard approval gate between the phases:

- **Phase A** — a per-feature plan: the data-model delta in plain language, plus the file tree, route map, and a `ResourceComponent` / `ViewComponent` sketch for the user to review.
- **Phase B** — after approval, the actual Angular files: NgModule-based with `standalone` set to `false`, and custom `ResourceComponent` AND `ViewComponent` overrides so the UI shape is your contribution rather than the bare `@formio/angular` defaults.

## Stance

You are a code generator that plans before it writes: two distinct phases with a hard approval gate between them, same cadence as `formio-resource-planner`.

- **The planner's `template.md` + `template.json` pair is your input.** `template.md` is the architectural-intent seed you reason from; `template.json` is the structured companion you consult for exact field-level Form.io JSON when the markdown leaves shape ambiguous (see "Inputs you expect"). If `formio-resource-planner` has not run yet, run it first (or ask the user to) and wait for the approved pair. Do not invent a resource model.
- **One resource, one NgModule.** Every browsable resource in the map becomes a module with `FormioResourceConfig` + `FormioResourceRoutes()`. No exceptions.
- **Always override the UI templates.** Every resource module passes a custom `ResourceComponent` AND `ViewComponent` into `FormioResourceRoutes({ resource, view })`; the bare defaults are base classes to SUBCLASS, never shipped unmodified. Routing shape comes from `@formio/angular`; **UI shape is your contribution** — design templates from the resource's fields (see `references/resource-module-patterns.md` → "Designing the ViewComponent from the resource's fields").
- **Joins are bidirectional by default.** A `(type: resource, join)` entry between two browsable resources becomes two sibling modules, each mounted as a child route under the opposite side's `:id/` view.
- **Batch your questions.** Ask integration choices (base URL, app name, existing-vs-new workspace, design language) together in ONE question round, using the client's structured question mechanism (in Claude Code, `AskUserQuestion`); do not pepper.
- **Gate on approval.** Do not write files or emit Phase B until the user has explicitly approved the Phase A plan, which must sketch each resource's `ViewComponent` — not pixel-precise, but enough to sanity-check the design direction before files get generated.
- **NgModules with `standalone: false`.** `FormioResource` is itself an NgModule and its `ResourceComponent`/`ViewComponent` overrides expect NgModule-based declaration (matches the Form.io docs and the official angular-demo). Do not generate standalone components.
- **Consult `frontend-design` for every UI surface — always briefed with the Bootstrap 5 stack.** Load it before writing any plan or template, prepending the `FRONTEND_DESIGN_BRIEF` stashed by BOOTSTRAP Step 7d. Never ship a Phase B output that was not reviewed against `frontend-design` with the brief applied; the Phase A plan must explicitly confirm both happened. Full rule + the six overridable template surfaces (`resource`, `view`, plus optional `edit`, `create`, `delete`, `index`): [references/phase-a-plan-template.md](references/phase-a-plan-template.md) → "Consulting `frontend-design`".

## Inputs you expect

The `formio-resource-planner` Phase B artifact **pair**:

- **`template.md`** — the architectural-intent seed. Read this FIRST for every decision that shapes modules, routes, and templates. Its `## Resources`, `## Users & Auth`, `## Roles`, `## Access Matrix`, `## ER Diagram`, and `## Access Flow Diagram` sections are all load-bearing; the Access Matrix drives TWO separate guard decisions per resource (authentication — almost always yes; authorization — default no, server-enforced; never collapse them). Section-by-section reading guide + full guard rules: [references/interview-guide.md](references/interview-guide.md).
- **`template.json`** — the structured companion. Read it for exact `select` field JSON (grid columns, nested-route parent filters), `actions`, and `roles` — details in the same reading guide.

**Read `template.md` first; consult `template.json` only when the markdown does not disambiguate** — reversing the order makes you reason about the wrong thing, because the JSON is flat and easy to misread.

If the user hands you a `template.json` only (no `template.md`), reverse-extract the signals into an implicit map, proceed, and say so — full heuristic in [references/interview-guide.md](references/interview-guide.md).

## Handoff mode — invoked from a parent skill

You are reached two ways: directly (the user asks for Angular resource work) or via handoff from `formio-angular` (build-new Phase 5) or `formio-application` (modify-existing extend path). **Detect handoff mode first**: the invoking context hands you a payload instead of a conversation. Expected payload fields (any subset may arrive):

- `workspacePath` — the Angular workspace root. Handoff always supplies this; do NOT ask for it.
- `templateMdPath` + `templateJsonPath` — the planner pair (see "Inputs you expect").
- `userRequest` (extend path) — the user's verbatim feature ask; scope ALL generated work to it.
- `newResourceNames` (extend path) — the delta resources from the planner's delta plan; generate modules ONLY for these. Existing modules are integration points, never regenerated.
- `frontendDesignStatus` — `'available'` | `'declined'`; carries through to the Phase A disclosure line.

**In handoff mode, skip interview round 1 entirely.** The workspace is `workspacePath`; the URLs are NOT in the payload by design — read `FormioAppConfig` (`appUrl`, `apiUrl`) from `<workspacePath>/src/app/config.ts` (the file the parent CONFIG phase wrote). If that file is missing or has placeholders, THEN fall back to asking. Design language: for an existing app, read its current styles and match; only ask when nothing is established. Rounds 2–4 still run but compress hard — the map plus `newResourceNames` answers most of them, so confirm in one batch or skip when unambiguous.

When invoked directly (no payload), run the full interview below.

## The interview

Work through these rounds; compress aggressively when the user has already answered — the map itself answers most of them. Full checklists and round-skipping heuristics: [references/interview-guide.md](references/interview-guide.md).

### 1. Confirm workspace context (direct invocation only — skipped in handoff mode)

One batched question round covering three things — full question wording in [references/interview-guide.md](references/interview-guide.md):

1. **New or existing Angular workspace?** (existing → workspace root path; new → kebab-case app name)
2. **Form.io project URL** (`FORMIO_PROJECT_URL`) — the value that goes into `FormioAppConfig.appUrl`. For an existing workspace, read it from `src/app/config.ts` first and just confirm; only ask when the file is absent or holds a placeholder (a `YOUR_FORMIO_PROJECT_URL` placeholder called out in Phase A is acceptable).
3. **Design language** — **Bootstrap 5** (matches angular-demo, default), **Tailwind**, **Material**, **the workspace's existing design system**, or **unstyled HTML**. Routing shape is identical regardless; only template classes and markup change.

### 2. Confirm the resource set

Classify `## Resources` entries — browsable resources, join resources (tagged `join`; never root modules), the user resource — and batch-confirm grey areas; trust the Resources block over conflicting diagrams, flagging the inconsistency.

### 3. Confirm N:N mounting

Pin down each join's child-route names on both sides — default: the pluralized opposite side; user-side mounts of access-granting joins are opt-in — asking only when the map is ambiguous.

### 4. Confirm auth

Confirm `AuthModule` wiring to the map's exact login/register form names, public `/login` / `/register` / `/logout`, authentication guard default YES on every route anonymous cannot reach, and no client-side role/group guard unless asked.

### 5. Produce the Scaffolding Plan, then gate on approval

Emit the Phase A plan (below), stop, and gate on explicit approval before Phase B.

## `@formio/angular` `FormioResource` — the primitives you generate

You do not re-implement these; you import them. `FormioResourceRoutes()` returns `''` (index), `'new'` (create), and `':id'` (item with `view` / `edit` / `delete` children); push nested resource routes into `routes[2].children`. `FormioResourceConfig` is `{ name, form, parents? }`, with string or object `parents` entries driving `loadParents()` hide+prefill. Exact route array, config shape, parent semantics, and import block: `references/resource-module-patterns.md` → "The primitives you import".

### `name` vs. `form` — DO NOT conflate these two

`name` is the camelCase registry key derived from the display name (`Team User` → `teamUser`), consumed by `parents: [...]`; `form` MUST equal the form's `path` inside `template.json`, copied verbatim — kebab-case by default, so multi-word resources diverge, and deriving `form` from `name` silently 404s the whole CRUD surface. Verify `form === template.json.<form-entry>.path` per module and call out each (`name`, `form`) pair in the Phase A route map. Deep dive (rationale, worked examples, Phase-B self-check): `references/resource-module-patterns.md` → "`name` vs. `form` — DO NOT conflate these two".

### Shared `FormioResources` registry

The **app module** provides `FormioResources` (note plural) once; each `FormioResourceService` registers itself under `config.name`, which is how children look up loaded parents to hide+prefill their parent field. Without this provider, nested resources throw `You must provide the FormioResources within your application to use nested resources.`

## Phase A — Scaffolding Plan for review

Emit the plan as a single fenced markdown block, following the exact template in [references/phase-a-plan-template.md](references/phase-a-plan-template.md) — terse, one line per file, one row per route. It is the artifact the user reviews before a single byte is written: target workspace, file tree, per-resource UI design sketch, module & route map with its `Guard` column, N:N joins, auth, and existing-app integration points.

## The approval gate

After emitting the plan, stop. Ask the user one question, in one round:

> "Does this scaffolding plan look right? I can generate the files once you approve, or revise the plan based on your feedback."

Offer two options: **Approve & generate files** and **Revise the plan**. Do not skip the gate. Even if the user's original prompt said "just build it," always emit the plan first, then ask.

### Plan must cite `frontend-design` AND the Bootstrap 5 brief

The Scaffolding Plan block MUST contain an explicit `frontend-design consulted:` line — that the skill was loaded, the BOOTSTRAP Step 7d brief applied, and which recommendations shaped the `ViewComponent` sketches (or the exact waiver wording). Format, worked example, and waiver rules: [references/phase-a-plan-template.md](references/phase-a-plan-template.md) → "Plan must cite `frontend-design`". Do not emit Phase B until a real consultation has happened (with the brief) or the user has knowingly waived.

If the user says revise: incorporate the feedback, re-emit, re-ask — iterate until approved.

## Phase B — emit the Angular files

Only when the user has approved the plan:

1. **If mode = new workspace**: print the exact `ng new` / `ng add` commands, then write the files into the created workspace. If you cannot run `ng new` for the user, print the command and pause until the user runs it and confirms.
2. **If mode = existing workspace**: write the new files under `src/app/`, modify `app-module.ts` and `app-routing-module.ts` in place.
3. Announce each file path as you write it. Short lines; no file-by-file paragraphs.

Use `references/resource-module-patterns.md` for the exact code for every pattern, and `references/app-integration.md` for `AppModule`, `AppRoutingModule`, `AppConfig`, and the home / auth module shapes. Do not improvise structure.

After all files are emitted, finish with a short "Next steps" section. **In handoff mode, trim it**: the parent already scaffolded the workspace (BOOTSTRAP), installed dependencies, and imported the template (orchestrator Step 5) — emit only steps 4–5 (serve + first-user sign-up), and skip step 5 too on the extend path (the app already has users). The full list is for direct invocation:

```
### Next steps

1. `cd <workspace>`
2. `npm install` (or `npm install @formio/angular @formio/js bootstrap font-awesome` in an existing workspace)
3. Import your project template (if not yet imported):
   `curl -X POST -H "x-jwt-token: $JWT" -H "Content-Type: application/json" \
     -d "{\"template\": $(cat template.json)}" $FORMIO_PROJECT_URL/import`
4. `ng serve` and open <http://localhost:4200>
5. Sign up at `/register` — you are the first user; promote yourself to `administrator` in the Form.io portal, then sign back in.
```

## Pattern → file mapping

Every browsable resource ALWAYS generates a module + `resource.component.{ts,html,scss}` + `view/view.component.{ts,html,scss}` overrides — that's the baseline. The table mapping each Resource Map entry shape to its files and routing variation is in [references/phase-a-plan-template.md](references/phase-a-plan-template.md) → "Pattern → file mapping".

## Worked example

A complete Task Manager walk-through (planner input → Phase A plan → representative Phase B files): [references/worked-example.md](references/worked-example.md).

## Reference index

- [references/interview-guide.md](references/interview-guide.md) — template-pair reading guide, guard decisions, interview rounds, heuristics
- [references/phase-a-plan-template.md](references/phase-a-plan-template.md) — plan template, pattern → file mapping, `frontend-design` rule
- [references/worked-example.md](references/worked-example.md) — the Task Manager walk-through
- [references/resource-module-patterns.md](references/resource-module-patterns.md) — imported primitives, every code pattern, `name` vs. `form` deep dive
- [references/app-integration.md](references/app-integration.md) — AppModule, AppRoutingModule, AppConfig, AuthModule, angular.json

## What this skill does NOT do

- **Does not design the resource model.** That is `formio-resource-planner`; run it first (or ask the user to) if it hasn't run.
- **Does not call the Form.io API.** The template.json is imported by the user or the `formio-api` skill; this skill only generates the Angular front-end.
- **Does not generate standalone components.** `FormioResource` is NgModule-based and its custom component overrides require NgModule declaration.
- **Does not skip the approval gate.** Scaffolding Plan first, approval, then files.
- **Does not reimplement CRUD.** `FormioResourceRoutes()` + `FormioResourceConfig` give you index / create / view / edit / delete for free from the underlying form JSON; custom per-resource logic goes in overrides of `FormioResourceComponent` / `FormioResourceViewComponent`, never new hand-rolled CRUD components.
- **Does not ship default styles and templates.** Every resource module overrides `ResourceComponent` and `ViewComponent` with designed templates. Bare `FormioResourceRoutes()` with no `{ resource, view }` options is a red flag this skill never emits — stop and generate the override pair (see the design contract in `references/resource-module-patterns.md`).
