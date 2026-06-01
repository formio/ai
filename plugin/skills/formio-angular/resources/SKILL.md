---
name: formio-angular-resources
description: >-
  Angular-explicit extension sub-skill for the Form.io skill library — adds, regenerates, or repairs one resource NgModule in an Angular workspace that already has `FormioAppConfig` wired into `AppModule`. Invoked either (a) via framework-explicit user phrasing that names Angular, or (b) via handoff from the parent `formio-angular` skill (which itself may have been invoked by `formio-application`). Claims ONLY Angular-explicit triggers — phrases that name Angular or `@formio/angular` verbatim. Example triggers this skill claims include "add an Angular module for X", "regenerate the Angular `Participant` resource module", "in my Angular app, wire `X`'s children to `Y`", "fix the Angular `ViewComponent` for `Orders`", "the Angular `Event` module is missing a route", "add a bidirectional Angular join between `Team` and `User`", and "regenerate the `FormioResourceRoutes()` for the Angular CRM app". Does NOT claim framework-agnostic extension phrasing (those route through `formio-application`, which decides whether to delegate to this skill or to a future framework's extension sub-skill). Handles simple new resources, parent→child hierarchies (e.g., `Event → Participant`), bidirectional many-to-many joins around a join resource (e.g., `Team ↔ User` via a `TeamUser` join), and transitive group-access hierarchies — but the description of the feature to add is Angular-explicit when this skill is invoked directly. Two-phase cadence — (Phase A) a per-feature plan showing the data-model delta in plain language plus the file tree, route map, and `ResourceComponent` / `ViewComponent` sketch — for the user to review; (Phase B) after approval, the actual Angular files (NgModule-based with `standalone` set to `false`, with custom `ResourceComponent` AND `ViewComponent` overrides so the UI shape is your contribution, not the bare `@formio/angular` defaults). Not for: initial Angular-app creation or any case where `FormioAppConfig` is not yet wired into `AppModule` — see parent `formio-angular`. Not for: framework-agnostic extension requests (the user does not name Angular) — see `formio-application`, which routes to this skill when the framework turns out to be Angular. Not for: shaping a data model in isolation — see `formio-resource-planner`. Not for: Form.io REST endpoint lookups — see the `formio-api` skill.
---

# Form.io Resource → Angular CRUD

> **Nested sub-skill.** This file lives at `plugin/skills/formio-angular/resources/SKILL.md` — a sub-folder of the `formio-angular` skill. The `name: formio-angular-resources` field in the frontmatter is preserved for documentation and eval tooling, but this file is NOT a separately-registered top-level skill. Callers (the `formio-angular` parent skill, or the `formio-application` orchestrator's Step 6) reach this file by loading it directly by path, the same way `formio-angular` loads `SETUP.md` / `BOOTSTRAP.md` / `CONFIG.md` / `AUTH.md`. Do not attempt to invoke this skill by its frontmatter name from a top-level prompt — load the file.

Turn a Form.io Resource Map into a working Angular application whose CRUD screens are wired through `@formio/angular`'s `FormioResource` module. One module per resource, with nested parent/child routing and bidirectional N:N joins generated from the map.

## Stance

You are a code generator that plans before it writes. Two distinct phases with a hard approval gate between them — same cadence as `formio-resource-planner`.

- **The planner's `template.md` + `template.json` pair is your input.** `template.md` is the architectural-intent seed you reason from — its `## Resources`, `## Users & Auth`, `## Roles`, `## Access Matrix`, `## ER Diagram`, and `## Access Flow Diagram` sections are load-bearing. `template.json` is the structured companion you consult for exact field-level Form.io JSON when the markdown leaves shape ambiguous. If the user has not yet run `formio-resource-planner`, run it first (or ask the user to run it) and wait for the approved pair. Do not invent a resource model.
- **One resource, one NgModule.** Every browsable resource in the map becomes a module with `FormioResourceConfig` + `FormioResourceRoutes()`. No exceptions.
- **Always override the UI templates.** Every resource module passes a custom `ResourceComponent` AND a custom `ViewComponent` into `FormioResourceRoutes({ resource, view })`. The bare defaults (`FormioResourceComponent`, `FormioResourceViewComponent`) are base classes to SUBCLASS — do not ship them unmodified. This is where the skill earns its keep: routing shape comes from `@formio/angular`; **UI shape is your contribution.** Design the templates from the resource's fields (title headers, date ranges, status badges, action cards for nested children, summary stats for numeric fields — whatever the map implies). See `references/resource-module-patterns.md` → "Designing the ViewComponent from the resource's fields."
- **Joins are bidirectional by default.** A `(type: resource, join)` entry between two browsable resources becomes two sibling modules, each mounted as a child route under the opposite side's `:id/` view.
- **Batch your questions.** When integration choices come up (base URL, app name, existing-vs-new workspace, design language), ask them together in one `AskUserQuestion`. Do not pepper.
- **Gate on approval.** Phase A (Scaffolding Plan) is for review. Do not write files or emit Phase B until the user has explicitly approved the plan. The plan must sketch what the `ViewComponent` looks like for each resource — not pixel-precise, but enough that the user can sanity-check the design direction before files get generated.
- **NgModules with `standalone: false`.** `FormioResource` is itself an NgModule and its `ResourceComponent`/`ViewComponent` overrides expect NgModule-based declaration. Matches the Form.io docs and the official angular-demo. Do not generate standalone components.
- **Consult Claude's `frontend-design` skill for every UI surface — always briefed with the Bootstrap 5 stack.** This is the UI-heavy phase of the `formio-angular` pipeline: every resource produces a `resource.component.html` (nav chrome around `:id/*` children), a `view/view.component.html` (the detail page — the biggest design surface in the skill), optional per-resource SCSS, and sometimes custom index components for joins. ALL of that must be shaped by loading Claude's built-in `frontend-design` skill first and following its guidance — same rule as the parent `formio-angular` skill's Stance. When invoking `frontend-design`, always prepend the `FRONTEND_DESIGN_BRIEF` that BOOTSTRAP Step 7d stashed so the skill knows the stack is Bootstrap 5 + Bootstrap Icons (pre-wired through `angular.json`), uses Bootstrap utility classes instead of Tailwind, and extends Bootstrap's CSS variables instead of introducing parallel design tokens. The patterns in `references/resource-module-patterns.md` give you the Angular plumbing (route shape, component base class, signal plumbing); `frontend-design` (briefed with BOOTSTRAP's preamble) gives you the visual-design decisions (layout, hierarchy, spacing, color, typography, affordances) — all expressed in Bootstrap 5 vocabulary. Do not ship a Phase B output that was not reviewed against `frontend-design` with the brief applied. The Phase A plan must explicitly confirm both happened — see "Phase A" below.

## Inputs you expect

The `formio-resource-planner` Phase B artifact **pair**:

- **`template.md`** — the architectural-intent seed. Read this FIRST for every decision that shapes modules, routes, and templates. Sections:
  - `## Resources` — resource definitions (name, type, purpose, fields, access, actions) in the planner's terse block form.
  - `## Users & Auth` — user resource, login/register form names, SSO.
  - `## Roles` — role machine names + capability summaries.
  - `## Access Matrix` — truth table per (resource, actor) with tokens `all` / `own` / `group` / `group(<join>)` / `role(<r>)` / `—`. Use this to decide whether a module needs a route guard vs. relying on server-side enforcement.
  - `## ER Diagram` — Mermaid `erDiagram`; gives you the hierarchy and join topology at a glance, with explicit cardinality semantics (`||--o{`, `}o--o{`). Parse this to discover parent/child pairs and join resources.
  - `## Access Flow Diagram` — Mermaid `flowchart TD`; shows how ACL propagates at runtime. Critical for deciding whether a field is a real parent reference or a hidden calculated mirror (Angular does NOT touch mirror fields — the planner's form JSON handles them). Hidden calculated mirrors are annotated on the edges: `"hidden calculated mirror<br/>value = data.account.data.team"`.
- **`template.json`** — the structured companion. Read this when you need:
  - Exact field JSON for a `select` component (reference resource, `valueProperty`, `multiple`) to generate grid columns or nested-route parent filters.
  - `template.json.actions` for action names referenced in `template.md` (e.g., verifying `Group Assignment` settings).
  - `template.json.roles` for role machine names the role-guard code needs.

**Read `template.md` first; consult `template.json` only when `template.md` does not disambiguate.** Reversing this order makes you reason about the wrong thing — the JSON is flat and easy to misread.

If the user hands you a `template.json` only (no `template.md`), reverse-extract the same signals (resource names, reference/select components, join tags, role list) into an implicit map, then proceed — but say so: the narrative context the markdown provides will be missing, and ambiguous cases should get a clarifying question instead of a guess.

## The interview

Work through these rounds. Compress aggressively when the user has already answered — the map itself answers most of them.

### 1. Confirm workspace context

Ask (one batched `AskUserQuestion`):

1. **New or existing Angular workspace?** If existing: path to the workspace root (should contain `angular.json`). If new: the desired app name (kebab-case).
2. **Form.io project URL** (`FORMIO_PROJECT_URL`) — the value that goes into `FormioAppConfig.appUrl`. Same value as the one the `formio-api` skill use. It is acceptable for the user to fill this in later; if so, emit a placeholder `YOUR_FORMIO_PROJECT_URL` and call it out in Phase A.
3. **Design language** — what the ViewComponent templates should lean on: **Bootstrap 5** (matches angular-demo, default), **Tailwind**, **Material** (`@angular/material`), **the workspace's existing design system** (for existing workspaces, read their styles and match), or **unstyled HTML** (minimum viable, user will restyle). The routing shape is the same regardless; only the template classes and markup change.

### 2. Confirm the resource set

Re-read `template.md`'s `## Resources` section and list:

- **Browsable resources** — every entry whose `type` is `resource` and which is NOT tagged `join` in the map.
- **Join resources** — entries tagged `(type: resource, join)`. These do NOT become root modules; they become nested N:N modules under each side.
- **The user resource** — `user` by default, or whatever `## Users & Auth` names.

If the map has grey areas (e.g., a 1:N that the user might want mounted as a nested child route rather than at root), confirm in one batch. When the ER Diagram and Access Flow Diagram conflict with the Resources block (rare, but possible after an iteration), trust the Resources block and flag the inconsistency.

### 3. Confirm N:N mounting

For each join resource, pin down how both sides should be named in the URL:

- Default path name on each side: the **pluralized name of the opposite side** (lowercase).
  - `UserTeam` join → on `User.view`: child route `teams`; on `Team.view`: child route `users`.
  - `ProjectUser` join → on `Project.view`: child route `users`; on `User.view`: omit (you are always yourself, so `/user/:id/projects` through an access-granting join is an admin-only operation — offer it opt-in).
- Ask only when the map is ambiguous (e.g., self-referential joins, joins whose two sides have the same word).

### 4. Confirm auth

`template.md`'s `## Users & Auth` section names the `Login form` and `Registration form` explicitly. Default: generate `AuthModule` wired to those exact form names via `@formio/angular/auth`'s `FormioAuthConfig`. Confirm:

- Should `/login` and `/register` be public top-level routes? (default yes)
- Is there a `/logout` convenience route? (default yes, via `FormioAuthService.logout()`)
- Is any resource gated by a role guard? (default no — Form.io handles access server-side; Angular routes stay open and let the backend 403)

### 5. Produce the Scaffolding Plan, then gate on approval

Emit the Phase A Scaffolding Plan (see "Phase A" below). Stop. Ask the user to approve or revise via `AskUserQuestion`. Only after explicit approval, produce Phase B.

## `@formio/angular` `FormioResource` — the primitives you generate

You do not re-implement these; you import them.

### Module imports every resource module uses

```typescript
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormioModule } from '@formio/angular';
import {
  FormioResource,
  FormioResourceRoutes,
  FormioResourceConfig,
  FormioResourceService,
} from '@formio/angular/resource';
```

### Route shape from `FormioResourceRoutes()`

`FormioResourceRoutes()` returns:

```
[
  { path: '',    component: FormioResourceIndexComponent  },   // [0] list
  { path: 'new', component: FormioResourceCreateComponent },   // [1] create
  { path: ':id', component: FormioResourceComponent, children: [
      { path: '',     redirectTo: 'view', pathMatch: 'full' },
      { path: 'view',   component: FormioResourceViewComponent   },
      { path: 'edit',   component: FormioResourceEditComponent   },
      { path: 'delete', component: FormioResourceDeleteComponent }
    ]
  }                                                            // [2] item
]
```

`routes[2].children` is where you push nested resource routes (children, N:N joins, etc.). See `references/resource-module-patterns.md` for exact code.

### `FormioResourceConfig` shape

```typescript
{
  name:    string;               // the resource's key in FormioResources registry — property-style camelCase
  form:    string;               // MUST equal the form's `path` in template.json — usually kebab-case
  parents?: Array<string | { field: string; resource: string; filter?: boolean }>;
}
```

- Plain-string parent (`parents: ['event']`) tells `FormioResourceService.loadParents()` to find a select component whose `key === 'event'` and auto-fill it with the parent submission.
- Object parent (`{ field: 'user', resource: 'currentUser', filter: false }`) is used by `@formio/angular/auth`'s `currentUser` resource to pre-fill a `user` field with the logged-in user without using it as a list filter.

### `name` vs. `form` — DO NOT conflate these two

This trips up every first pass on multi-word resources (`Team User`, `Line Item`, `Account Contact`, etc.). The two fields serve different layers and almost always have different casing:

- **`name`** is an in-memory registry key used by the Angular side only. It is the symbol every child/join module references when it declares `parents: ['teamUser']`, and it is how `FormioResources` distinguishes sibling modules (e.g., a bidirectional join has two sibling modules with distinct `name` values — `teamUsers` vs `userTeams` — pointing at the same form). Because it flows through TypeScript identifiers and is consumed as a JS property, it is **camelCase** derived from the resource's display name: `Team User` → `teamUser`, `Line Item` → `lineItem`, `Account Contact` → `accountContact`.

- **`form`** is a URL-path segment. `FormioResourceService` concatenates `appUrl + '/' + config.form` to build every REST call (`/teamUser/submission`, `/teamUser/submission/:id`, etc.). It therefore MUST equal the `path` property of the corresponding form inside `template.json` — no exceptions, no heuristics, no casing transforms. Form.io's project-import step creates each resource's form at exactly the `path` recorded in `template.json`; if the `form` value you write into `FormioResourceConfig` does not match that `path` byte-for-byte, every request 404s and the CRUD surface is dead on arrival.

  The planner emits `path` in **kebab-case by default** (`team-user`, `line-item`, `account-contact`), so on multi-word resources the two fields diverge — `name` is camelCase, `form` is kebab-case, and that is correct. Copy the `path` value from `template.json` verbatim; do NOT derive `form` from `name` by lowercasing or inserting hyphens, because single-word resources where the planner chose a non-obvious path will silently break.

**How to populate both in Phase B.** For every module you generate, read the corresponding resource's form out of `template.json` (look under `template.json.resources` or `template.json.forms` for the entry whose `name` or `machineName` matches the resource in the plan) and copy its `path` string into the `form` field. Derive `name` from the plan's resource display name via camelCase. If the planner's artifact pair is missing the resource's `path`, stop and surface the gap — do not guess.

**Worked example — `Team User` resource, whose `template.json` form entry is `{ name: 'teamUser', path: 'team-user', ... }`:**

```ts
providers: [
  FormioResourceService,
  {
    provide: FormioResourceConfig,
    useValue: {
      name: 'teamUser',    // camelCase registry key, consumed by parents: ['teamUser']
      form: 'team-user',   // MUST equal template.json form's `path` — the URL segment
    },
  },
]
```

**Worked example — single-word `Event` resource, whose `template.json` form entry is `{ name: 'event', path: 'event', ... }`:** `name` and `form` happen to coincide, but that is because `path` and camelCase both collapse to `event` for a single lowercase word — NOT because they are computed from each other. Still copy `form` from `template.json.path`.

**Phase-B self-check.** Before writing each resource module, quickly verify `providers[].useValue.form === template.json.<form-entry>.path`. Phase-A plan output should call out the (`name`, `form`) pair per resource in the route map block so the user can sanity-check the divergence before any file is written, especially on multi-word resources and on bidirectional joins where two sibling modules both have to pin `form` to the same `path`.

### Shared `FormioResources` registry

The **app module** provides `FormioResources` (note plural) once. Each `FormioResourceService` in the tree registers itself under `config.name`, which is how children look up loaded parents to hide+prefill their parent field. Without this provider, nested resources throw `You must provide the FormioResources within your application to use nested resources.`

## Phase A — Scaffolding Plan for review

Emit the plan as a single fenced markdown block. Use this exact template — terse, one line per file, one row per route. This is the artifact the user reviews before a single byte is written.

```
## Scaffolding Plan — <App Name>

### Target workspace
- Mode: <new workspace `ng new <app-name>` | existing workspace at `<path>`>
- FormioAppConfig.appUrl: <URL or placeholder>
- UI framework: <Bootstrap 5 | none>

### Files to create / modify
<tree grouped by folder — mark "NEW" or "MODIFY". Every browsable resource gets a custom ResourceComponent + ViewComponent pair, no exceptions.>

  src/app/
    app-module.ts                                       MODIFY  (adds imports)
    app-routing-module.ts                               NEW
    app.config.ts                                       NEW     (FormioAppConfig + FormioAuthConfig)
    home/home.component.{ts,html,scss}                  NEW
    auth/auth.module.ts                                 NEW
    <resource>/<resource>.module.ts                     NEW     (one per browsable resource)
    <resource>/resource.component.{ts,html,scss}        NEW     (designed nav — tabs / breadcrumb / sidebar)
    <resource>/view/view.component.{ts,html,scss}       NEW     (designed view — cards / stats / field layout)
    <parent>/<nested>/<nested>.module.ts                NEW     (per 1:N nested child, own resource+view)
    <parent>/<joinOther>/<joinOther>.module.ts          NEW     (per N:N nested side, own resource+view)

### UI design sketch per resource
(One paragraph per browsable resource — what the ViewComponent will show. Example:
  - "Event.view: top card with the event's title, description, and a formatted start→end date range in the header. Beside it, a Registration card with a 'Register Now' button linking to ./participant/new. Below, a grid of registered participants."
  - "Task.view: status badge (color-coded by open/in-progress/done), due-date pill, assignee with avatar placeholder, description section."
Use the map's field list to pick summary fields. Ask the user to flag anything that should be demoted to Edit instead of View.)

### Module & route map

| Path                                | Module                     | Resource (`form`)    | Parents           |
| ----------------------------------- | -------------------------- | -------------------- | ----------------- |
| `/login`                            | AuthModule → login         | userLogin            | —                 |
| `/register`                         | AuthModule → register      | userRegister         | —                 |
| `/<resource>`                       | <Resource>Module           | <resource>           | —                 |
| `/<resource>/:id/<nested>`          | <Nested>Module             | <nested>             | ['<resource>']    |
| `/<resource>/:id/<joinOther>`       | <ResourceJoinOther>Module  | <join>               | ['<resource>']    |

### N:N joins
- <JoinResource>: mounted on both sides
  - `/team/:id/users` → TeamUsersModule (parents: ['team'])
  - `/user/:id/teams` → UserTeamsModule (parents: ['user'])
  - index grid column `<otherSideKey>` rendered as link to `/<otherSide>/<id>/view`

### Auth
- Login form: `userLogin` → route `/login`
- Register form: `userRegister` → route `/register`
- Logout: `/logout` → FormioAuthService.logout() then `/login`
- FormioAuthConfig provided in app.config.ts

### Integration points touched in an existing app
- `AppModule.imports` ← adds FormioModule, FormioGrid, and RouterModule entries for each resource
- `AppModule.providers` ← adds FormioResources, FormioAuthService, FormioAppConfig, FormioAuthConfig
- `angular.json` ← adds Bootstrap 5 + FontAwesome CSS (only if selected)
- `index.html` ← no changes unless CDN-based styling is requested
```

## The approval gate

After emitting the plan, stop. Ask the user one question with `AskUserQuestion`:

> "Does this scaffolding plan look right? I can generate the files once you approve, or revise the plan based on your feedback."

Offer two options: **Approve & generate files** and **Revise the plan**. Do not skip the gate. Even if the user's original prompt said "just build it," always emit the plan first, then ask. The gate exists because regenerating is cheap in the plan (~50 lines) and expensive in the files (~15–40 files × 40–80 lines each).

### Plan must cite `frontend-design` AND the Bootstrap 5 brief

Per the Stance rule, the Scaffolding Plan block MUST contain an explicit `frontend-design consulted:` line declaring (a) that Claude's `frontend-design` skill was loaded before the plan was written, (b) that the `FRONTEND_DESIGN_BRIEF` from BOOTSTRAP Step 7d was passed in as the stack preamble (so recommendations came back in Bootstrap 5 vocabulary, not Tailwind / Material / custom tokens), and (c) which of its recommendations shaped the `ViewComponent` sketches in the plan. Example:

```
frontend-design consulted: YES — briefed with the Bootstrap 5 preamble from
BOOTSTRAP Step 7d. Applied its guidance on Bootstrap 5 card-based information
hierarchy (primary `card` with `card-header` stat rail + secondary `card`s in a
`row g-3`), Bootstrap spacing rhythm (`p-3`, `gap-3`, `mb-4`), `bi bi-*` icon
choices per resource, and `alert alert-info` empty-state treatment for zero-row
lists.
```

If `frontend-design` was not loaded (e.g., BOOTSTRAP Step 7 detected it was unavailable and the user waived the requirement), the line must still appear but read `frontend-design consulted: NO — user waived the requirement; emitted UI is best-effort Bootstrap 5 from memory`. The user sees the disclosure during approval and can reject. Do not emit Phase B until a real consultation has happened (with the brief) or the user has knowingly waived.

If the user says revise, incorporate the feedback, re-emit the plan, re-ask. Iterate until they approve.

## Phase B — emit the Angular files

Only when the user has approved the plan:

1. **If mode = new workspace**: print the exact `ng new` / `ng add` commands, then write the files into the created workspace. If you cannot run `ng new` for the user, print the command and pause — the user runs it themselves and confirms before you continue.
2. **If mode = existing workspace**: write the new files under `src/app/`, modify `app-module.ts` and `app-routing-module.ts` in place.
3. Announce each file path as you write it. Short lines; no file-by-file paragraphs.

Use `references/resource-module-patterns.md` for the exact code for every pattern. Use `references/app-integration.md` for `AppModule`, `AppRoutingModule`, `AppConfig`, and the home / auth module shapes. Do not improvise structure.

After all files are emitted, finish with a short "Next steps" section:

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

This is the table you use when deciding what to generate for each entry in the Resource Map.

Every browsable resource ALWAYS generates a module + `resource.component.{ts,html,scss}` + `view/view.component.{ts,html,scss}` (custom ResourceComponent and ViewComponent overrides) — that's the baseline. The rows below describe the routing-shape variations on top of that baseline.

| Map entry                                                                                         | Generates                                                                                                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `(type: resource)` at top level                                                                   | `<resource>/<resource>.module.ts` calling `FormioResourceRoutes({ resource: ResourceComponent, view: ViewComponent })`, no `parents`                                                                                                                         |
| `(type: resource)` whose access is group-inherited                                                | Same module, plus a note in Phase A that access is enforced server-side by field-based `submissionAccess` (already in the template). No Angular change needed.                                                                                               |
| `(type: resource)` with a 1:N parent                                                              | Child module with `parents: ['<parent>']`; parent module's routes get a child route pushed in; both parent and child get their own designed ViewComponent.                                                                                                   |
| `(type: resource, join)` between A and B                                                          | TWO sibling modules — `a/<bs>/<a-bs>.module.ts` (parents: ['a']) and `b/<as>/<b-as>.module.ts` (parents: ['b']). Parent routes get child routes pushed in. No root module. Each side gets its own designed index grid (linking rows to the opposite entity). |
| One resource nested under multiple different parents (e.g., Activity under both Account and Deal) | Same two-sibling-modules technique as the join. One module per mount: distinct `name` (e.g., `accountActivities` vs `dealActivities`), same `form`, different `parents`. Each parent module pushes its own child route.                                      |
| Transitive group mirror (hidden `team` select)                                                    | No Angular change — the hidden field is server-side plumbing baked into the form JSON by the planner's `template.json`.                                                                                                                                      |
| `User resource: default user` + `Login form: userLogin`                                           | AuthModule using `@formio/angular/auth`'s `FormioAuthConfig` pointing at `userLogin` + `userRegister`                                                                                                                                                        |
| `SSO: OIDC` / `SSO: SAML`                                                                         | AuthModule links to the Form.io SSO redirect URL (see `references/app-integration.md` → "SSO")                                                                                                                                                               |

## Worked example

**Input** (`template.md` from the planner — Task Manager; accompanying `template.json` not shown inline):

```
- Project (type: resource)
  Fields: name, description
- Task (type: resource)
  Fields: title, description, project (select Project), assignee (select User), status, dueDate
- ProjectUser (type: resource, join)
  Fields: project (select Project), user (select User)
  Actions: Group Permissions (group=project, user=user)
- User resource: default `user`
- Login form: userLogin
- Registration: userRegister
```

**Phase A plan** (emitted for approval):

```
## Scaffolding Plan — Task Manager

### Target workspace
- Mode: new workspace `ng new task-manager`
- FormioAppConfig.appUrl: https://taskmanager.form.io
- UI framework: Bootstrap 5

### Files to create / modify

  src/app/
    app-module.ts                                       NEW
    app-routing-module.ts                               NEW
    app.config.ts                                       NEW
    home/home.component.{ts,html,scss}                  NEW
    auth/auth.module.ts                                 NEW
    project/project.module.ts                           NEW
    project/resource.component.{ts,html,scss}           NEW  (tabs: View / Tasks / Members / Edit / Delete)
    project/view/view.component.{ts,html,scss}          NEW  (header card: name + description; side card: task count + member count + "New Task" button)
    project/tasks/project-tasks.module.ts               NEW   (1:N, parents: ['project'])
    project/tasks/resource.component.{ts,html,scss}     NEW  (breadcrumb back to project + task tabs)
    project/tasks/view/view.component.{ts,html,scss}    NEW  (status badge, due-date pill, assignee, description)
    project/users/project-users.module.ts               NEW   (N:N via ProjectUser — admin-only)
    project/users/index/project-users-index.component.{ts,html}  NEW  (grid — user column renders as link to that user)
    task/task.module.ts                                 NEW
    task/resource.component.{ts,html,scss}              NEW  (tabs: View / Edit / Delete)
    task/view/view.component.{ts,html,scss}             NEW  (same view layout as project/tasks — shared view template pattern)

### Module & route map

| Path                           | Module                   | Resource form | Parents       |
| ------------------------------ | ------------------------ | ------------- | ------------- |
| `/login`                       | AuthModule               | userLogin     | —             |
| `/register`                    | AuthModule               | userRegister  | —             |
| `/project`                     | ProjectModule            | project       | —             |
| `/project/:id/tasks`           | ProjectTasksModule       | task          | ['project']   |
| `/project/:id/users`           | ProjectUsersModule       | projectUser   | ['project']   |
| `/task`                        | TaskModule               | task          | —             |

### UI design sketch per resource (for review)
- **Project.view**: 2-col Bootstrap grid. Left card — `<h3>{{ service.resource?.data.name }}</h3>` header, description body. Right card — "Team & Work" header, with count badges for tasks and members and a prominent "New Task" button linking to `./tasks/new`.
- **Task.view**: Header shows status as a color-coded badge (`status === 'done'` → green, `'in-progress'` → yellow, `'open'` → gray). Subheader: due-date formatted with Angular date pipe and relative-time indicator. Body: full description. Footer: assignee line.
- **ProjectUsers.index** (admin grid): override the index template so the `user` column renders as a link to `/user/:id/view` when the user resource is browsable; otherwise render the user's `data.email` inline.

### N:N joins
- ProjectUser: mounted on Project only (User side omitted — admin operation on the join, not a normal user view). Index grid column `user` → link to that user's profile (or omitted if no User CRUD).

### Auth
- `/login` → userLogin, `/register` → userRegister, `/logout` → FormioAuthService.logout().
```

**After approval, Phase B** writes the full file set. The module file is only part of the story — every resource also gets `resource.component.{ts,html,scss}` and `view/view.component.{ts,html,scss}` with designed templates. Here's `project.module.ts` wiring in the custom overrides:

```typescript
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormioModule } from '@formio/angular';
import {
  FormioResource,
  FormioResourceRoutes,
  FormioResourceConfig,
  FormioResourceService,
} from '@formio/angular/resource';
import { ResourceComponent } from './resource.component';
import { ViewComponent } from './view/view.component';

const projectRoutes = FormioResourceRoutes({
  resource: ResourceComponent,
  view: ViewComponent,
});
projectRoutes[2].children.push({
  path: 'tasks',
  loadChildren: () => import('./tasks/project-tasks.module').then((m) => m.ProjectTasksModule),
});
projectRoutes[2].children.push({
  path: 'users',
  loadChildren: () => import('./users/project-users.module').then((m) => m.ProjectUsersModule),
});

@NgModule({
  imports: [CommonModule, FormioModule, FormioResource, RouterModule.forChild(projectRoutes)],
  declarations: [ResourceComponent, ViewComponent],
  providers: [
    FormioResourceService,
    {
      provide: FormioResourceConfig,
      useValue: {
        name: 'project', // camelCase registry key (single-word, so no divergence)
        form: 'project', // === template.json form.path — coincides with `name` here only because the resource is single-word
      },
    },
  ],
})
export class ProjectModule {}
```

And here's the designed `view/view.component.html` that makes this resource feel like a Project page, not a generic form render:

```html
<div class="row g-3">
  <div class="col-md-8">
    <div class="card h-100">
      <div class="card-body">
        <h3 class="card-title mb-2">{{ service.resource?.data?.name }}</h3>
        <p class="card-text text-muted" *ngIf="service.resource?.data?.description">
          {{ service.resource?.data?.description }}
        </p>
      </div>
    </div>
  </div>
  <div class="col-md-4">
    <div class="card h-100">
      <div class="card-header">Team &amp; Work</div>
      <div class="card-body d-flex flex-column gap-2">
        <a [routerLink]="['../tasks']" class="btn btn-outline-primary">View Tasks</a>
        <a [routerLink]="['../tasks/new']" class="btn btn-primary">+ New Task</a>
        <a [routerLink]="['../users']" class="btn btn-outline-secondary">Manage Members</a>
      </div>
    </div>
  </div>
</div>
```

See `references/resource-module-patterns.md` for the complete worked set (every override template, nested Task module, N:N ProjectUsersIndexComponent, AppModule wiring, and the "Designing the ViewComponent from the resource's fields" recipe).

## Interview heuristics

- **When the map has no `(type: resource, join)` entries**, skip the N:N mounting round. Go straight to auth confirmation.
- **When the join's "user" field maps to the `user` resource AND the join has a Group Assignment**, default to mounting the join only on the non-user side (`/project/:id/users`, not `/user/:id/projects`). It is an admin operation — viewing "my projects" is a `Project` list filtered by membership, not a join-table walk.
- **When the user provides a `template.json` but no `template.md`**, extract the same signals from the template: iterate `template.resources`, flag the ones whose `tags` include `"join"` as join resources, and infer parents from each resource's `select` components whose `data.resource` points at another resource in the template. Call out to the user that you are working from the JSON alone — the narrative context from `template.md` would normally guide Access Matrix / route-guard decisions and its absence may force more clarifying questions than usual.
- **When the workspace already has a `FormioAuthService` provider**, do not re-add it. Before writing `AppModule`, read the existing file and merge — do not overwrite.
- **When the user asks for a feature inside an existing app** (e.g., "add an Event Management feature"), scope the generation: create a single feature folder (`src/app/event/`) with all resources under it. Do not touch resources unrelated to this feature.

## When to look up more

- `references/resource-module-patterns.md` — every concrete code pattern (simple, nested, N:N, transitive, custom view, SSO)
- `references/app-integration.md` — AppModule, AppRoutingModule, AppConfig, AuthModule, index.html, angular.json

## What this skill does NOT do

- **Does not design the resource model.** That is `formio-resource-planner`. If the user has not run it, run it first (or ask the user to).
- **Does not call the Form.io API.** The template.json is imported by the user or by the `formio-api` skill. This skill only generates the Angular front-end.
- **Does not generate standalone components.** `FormioResource` is NgModule-based and its custom component overrides require NgModule declaration.
- **Does not skip the approval gate.** Always emit the Scaffolding Plan first, get approval, then write files.
- **Does not reimplement CRUD.** The whole point is that `FormioResourceRoutes()` + `FormioResourceConfig` give you index / create / view / edit / delete for free from the underlying form JSON. Custom per-resource logic goes in overrides of `FormioResourceComponent` or `FormioResourceViewComponent`, not new hand-rolled CRUD components.
- **Does not ship default chrome.** Every resource module overrides `ResourceComponent` and `ViewComponent` with designed templates. `FormioResourceRoutes()` with no options (bare defaults) is a red flag — that's the no-UI configuration and this skill never emits it. If you catch yourself calling `FormioResourceRoutes()` without `{ resource, view }` options, stop and generate the override pair.
