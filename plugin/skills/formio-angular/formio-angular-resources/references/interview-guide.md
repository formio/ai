# Interview guide — rounds 2–4, guard decisions, heuristics

> **`FormioAppConfig` renames both URLs.** `appUrl` is the **Project URL** — the project this application reads and writes, and the one value anyone supplies. `apiUrl` is the **Base URL** — the deployment hosting it, which is normally derived from the Project URL rather than supplied. Take both from `npx -y @formio/mcp@0.10.0 project get --cwd "<workspace root>"`; never compose, derive, or hand-type either one yourself.

Companion to `../SKILL.md`'s "The interview": the full question wording for round 1, the checklists for rounds 2–4, the template-pair reading guide, the Access Matrix guard-decision rules, and the heuristics for compressing or skipping rounds.

## Round 1 — Confirm workspace context (direct invocation only — skipped in handoff mode)

Ask in ONE question round, using the client's structured question mechanism (in Claude Code, `AskUserQuestion`):

1. **New or existing Angular workspace?** If existing: path to the workspace root (should contain `angular.json`). If new: the desired app name (kebab-case).
2. **Form.io project URL** (`projectUrl`) — the value that goes into `FormioAppConfig.appUrl`. Not a question to ask: resolve it with `npx -y @formio/mcp@0.10.0 project get --cwd "<workspace root>"` and reconcile against `src/app/config.ts`, asking only for whichever value that command reports missing.
3. **Design language** — what the ViewComponent templates should lean on: **Bootstrap 5** (matches angular-demo, default), **Tailwind**, **Material** (`@angular/material`), **the workspace's existing design system** (for existing workspaces, read their styles and match), or **unstyled HTML** (minimum viable, user will restyle). The routing shape is the same regardless; only the template classes and markup change. The answer also picks the vocabulary for the shell's page-layout wrapper (see the parent skill's `AUTH.md` → "Page layout contract") — the wrapper itself is required in every language.

## Reading the template pair

What to extract from each artifact of the planner's pair (SKILL.md's "Inputs you expect" keeps the contract; this is the section-by-section reading guide):

- **`template.md`** sections:
  - `## Resources` — resource definitions (name, type, purpose, fields, access, actions) in the planner's terse block form.
  - `## Users & Auth` — user resource, login/register form names, SSO.
  - `## Roles` — role machine names + capability summaries.
  - `## Access Matrix` — truth table per (resource, actor). Use this to make TWO separate guard decisions per resource — see "Guard decisions from the Access Matrix" below.
  - `## ER Diagram` — Mermaid `erDiagram`; gives you the hierarchy and join topology at a glance, with explicit cardinality semantics (`||--o{`, `}o--o{`). Parse this to discover parent/child pairs and join resources.
  - `## Access Flow Diagram` — Mermaid `flowchart TD`; shows how ACL propagates at runtime. Critical for deciding whether a field is a real parent reference or a hidden calculated mirror (Angular does NOT touch mirror fields — the planner's form JSON handles them). Hidden calculated mirrors are annotated on the edges: `"hidden calculated mirror<br/>value = data.account.data.team"`.
- **`template.json`** — read this when you need:
  - Exact field JSON for a `select` component (reference resource, `valueProperty`, `multiple`) to generate grid columns or nested-route parent filters.
  - `template.json.actions` for action names referenced in `template.md` (e.g., verifying `Group Assignment` settings).
  - `template.json.roles` for role machine names the role-guard code needs.

## Guard decisions from the Access Matrix

The `## Access Matrix` in `template.md` is a truth table per (resource, actor) with tokens `all` / `own` / `group` / `group(<join>)` / `role(<r>)` / `—`. Use this to make TWO separate guard decisions per resource. **(1) Authentication guard — almost always yes.** If the `anonymous` actor's row is `—` (no access — the normal case for any logged-in app), the route MUST carry `canActivate: [authGuard]` so an anonymous visitor is redirected to `/auth/login` instead of landing on a page that 401/403s and renders broken/empty. **(2) Authorization guard (role/group) — default no.** Distinguishing _which_ authenticated actor (a role or group) is left to the server; authenticated routes stay open among logged-in users and the backend 403s. Do NOT collapse these two: "server enforces access" is true for authorization but is NOT a reason to skip the authentication guard.

## Round 2 — Confirm the resource set

Re-read `template.md`'s `## Resources` section and list:

- **Browsable resources** — every entry whose `type` is `resource` and which is NOT tagged `join` in the map.
- **Join resources** — entries tagged `(type: resource, join)`. These do NOT become root modules; they become nested N:N modules under each side.
- **The user resource** — `user` by default, or whatever `## Users & Auth` names.

If the map has grey areas (e.g., a 1:N that the user might want mounted as a nested child route rather than at root), confirm in one batch. When the ER Diagram and Access Flow Diagram conflict with the Resources block (rare, but possible after an iteration), trust the Resources block and flag the inconsistency.

## Round 3 — Confirm N:N mounting

For each join resource, pin down how both sides should be named in the URL:

- Default path name on each side: the **pluralized name of the opposite side** (lowercase).
  - `UserTeam` join → on `User.view`: child route `teams`; on `Team.view`: child route `users`.
  - `ProjectUser` join → on `Project.view`: child route `users`; on `User.view`: omit (you are always yourself, so `/user/:id/projects` through an access-granting join is an admin-only operation — offer it opt-in).
- Ask only when the map is ambiguous (e.g., self-referential joins, joins whose two sides have the same word).

## Round 4 — Confirm auth

`template.md`'s `## Users & Auth` section names the `Login form` and `Registration form` explicitly. Default: generate `AuthModule` wired to those exact form names via `@formio/angular/auth`'s `FormioAuthConfig`. Confirm:

- Should `/login` and `/register` be public top-level routes? (default yes — these stay unguarded so anonymous users can reach them)
- Is there a `/logout` convenience route? (default yes, via `FormioAuthService.logout()`)
- **Authentication guard — default YES for every non-public resource route.** Any resource whose Access Matrix gives the `anonymous` actor no access (`—`) MUST mount `canActivate: [authGuard]` so an anonymous visitor is redirected to `/auth/login` rather than navigating into a page that 401/403s and shows broken/empty content. The `authGuard` file is produced by the parent skill's AUTH phase (`auth.guard.ts`); this sub-skill attaches it to each protected route. Only routes the matrix marks reachable by `anonymous` stay unguarded.
- **Authorization guard (role/group) — default no.** Gating _which_ authenticated role or group sees a route is left to the server: authenticated routes stay open among logged-in users and the backend 403s. Add a role guard only if the user explicitly asks for client-side role gating. Keep this separate from the authentication guard above — server-side authorization is not a reason to drop the authentication guard.

## Interview heuristics

- **When the map has no `(type: resource, join)` entries**, skip the N:N mounting round. Go straight to auth confirmation.
- **When the join's "user" field maps to the `user` resource AND the join has a Group Assignment**, default to mounting the join only on the non-user side (`/project/:id/users`, not `/user/:id/projects`). It is an admin operation — viewing "my projects" is a `Project` list filtered by membership, not a join-table walk.
- **When the user provides a `template.json` but no `template.md`**, extract the same signals from the template: iterate `template.resources`, flag the ones whose `tags` include `"join"` as join resources, and infer parents from each resource's `select` components whose `data.resource` points at another resource in the template. Call out to the user that you are working from the JSON alone — the narrative context from `template.md` would normally guide Access Matrix / route-guard decisions and its absence may force more clarifying questions than usual.
- **When the workspace already has a `FormioAuthService` provider**, do not re-add it. Before writing `AppModule`, read the existing file and merge — do not overwrite.
- **When the user asks for a feature inside an existing app** (e.g., "add an Event Management feature"), scope the generation: create a single feature folder (`src/app/event/`) with all resources under it. Do not touch resources unrelated to this feature.
