# Phase A plan template, pattern → file mapping, and the design-skill rule

> **`FormioAppConfig` renames both URLs.** `appUrl` is the **Project URL** — the project this application reads and writes, and the one value anyone supplies. `apiUrl` is the **Base URL** — the deployment hosting it, which is normally derived from the Project URL rather than supplied. Take both from `npx -y @formio/mcp@0.10.0 project get --cwd "<workspace root>"`; never compose, derive, or hand-type either one yourself.

Companion to `../SKILL.md`'s "Phase A" and "The approval gate". Contains the exact Scaffolding Plan template, the pattern → file mapping table that populates it, and the full `frontend-design` consultation rule with its disclosure-line format. The gate exists because regenerating is cheap in the plan (~50 lines) and expensive in the files (~15–40 files × 40–80 lines each).

## The Scaffolding Plan template

Emit the plan as a single fenced markdown block. Use this exact template — terse, one line per file, one row per route. This is the artifact the user reviews before a single byte is written.

```
## Scaffolding Plan — <App Name>

### Target workspace
- Mode: <new workspace `ng new <app-name>` | existing workspace at `<path>`>
- FormioAppConfig.appUrl: <URL or placeholder>
- UI framework: <Bootstrap 5 | Tailwind | Angular Material | existing design system | unstyled>
- Page shell: <VERIFIED — `src/app/app.html` wraps `<router-outlet>` in `<page-layout element + classes>` | MISSING — will add per AUTH.md's page layout contract>  (resource templates add NO page-level wrapper; the shell is the only thing that pads the library-rendered create / edit / delete / index / login / register routes)

### Files to create / modify
<tree grouped by folder — mark "NEW" or "MODIFY". Every browsable resource gets a custom ResourceComponent + ViewComponent pair, no exceptions.>

  src/app/
    app.html (or app.component.html)                    MODIFY  (nav link per resource; verify the shell page-layout wrapper)
    app-module.ts                                       MODIFY  (adds imports)
    app-routing-module.ts                               NEW
    config.ts                                           NEW or MODIFY  (FormioAppConfig + FormioAuthConfig — same file the parent CONFIG phase writes)
    home/home.{ts,html,scss}                            NEW     (legacy naming: home/home.component.*)
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

The `Guard` column records whether the route mounts `canActivate: [authGuard]` (authentication). Default `authGuard` for every route the Access Matrix marks unreachable by `anonymous`; `—` only for the public `/auth` routes.

| Path                                | Module                     | Resource (`form`)    | Parents           | Guard         |
| ----------------------------------- | -------------------------- | -------------------- | ----------------- | ------------- |
| `/login`                            | AuthModule → login         | userLogin            | —                 | —             |
| `/register`                         | AuthModule → register      | userRegister         | —                 | —             |
| `/<resource>`                       | <Resource>Module           | <resource>           | —                 | `authGuard`   |
| `/<resource>/:id/<nested>`          | <Nested>Module             | <nested>             | ['<resource>']    | `authGuard`   |
| `/<resource>/:id/<joinOther>`       | <ResourceJoinOther>Module  | <join>               | ['<resource>']    | `authGuard`   |

### N:N joins
- <JoinResource>: mounted on both sides
  - `/team/:id/users` → TeamUsersModule (parents: ['team'])
  - `/user/:id/teams` → UserTeamsModule (parents: ['user'])
  - index grid column `<otherSideKey>` rendered as link to `/<otherSide>/<id>/view`

### Auth
- Login form: `userLogin` → route `/login` (no guard — must stay reachable while anonymous)
- Register form: `userRegister` → route `/register` (no guard)
- Logout: `/logout` → FormioAuthService.logout() then `/login`
- FormioAuthConfig provided in src/app/config.ts (alongside FormioAppConfig)
- Authentication guard: `authGuard` (`src/app/auth/auth.guard.ts`, from parent AUTH phase) applied via `canActivate: [authGuard]` to every authenticated route above. Authorization (role/group narrowing) stays server-side — no client-side role guard unless explicitly requested.

### Integration points touched in an existing app
- `AppModule.imports` ← adds FormioModule, FormioGrid, and RouterModule entries for each resource
- `AppModule.providers` ← adds FormioResources, FormioAuthService, FormioAppConfig, FormioAuthConfig
- `AppRoutingModule` ← imports `authGuard` and adds `canActivate: [authGuard]` to each new authenticated resource route (leaves existing routes untouched)
- `angular.json` ← adds Bootstrap 5 + FontAwesome CSS (only if selected)
- `index.html` ← no changes unless CDN-based styling is requested
```

## Pattern → file mapping

This is the table you use when deciding what to generate for each entry in the Resource Map.

Every browsable resource ALWAYS generates a module + `resource.component.{ts,html,scss}` + `view/view.component.{ts,html,scss}` (custom ResourceComponent and ViewComponent overrides) — that's the baseline. The rows below describe the routing-shape variations on top of that baseline.

| Map entry | Generates |
| --- | --- |
| `(type: resource)` at top level | `<resource>/<resource>.module.ts` calling `FormioResourceRoutes({ resource: ResourceComponent, view: ViewComponent })`, no `parents` |
| `(type: resource)` whose access is group-inherited | Same module. The route STILL gets `canActivate: [authGuard]` (anonymous has no access). Add a Phase A note that the per-group _authorization_ narrowing is enforced server-side by field-based `submissionAccess` (already in the template) — so no role/group guard, but the authentication guard still applies. |
| `(type: resource)` with a 1:N parent | Child module with `parents: ['<parent>']`; parent module's routes get a child route pushed in; both parent and child get their own designated ViewComponent. |
| `(type: resource, join)` between A and B | TWO sibling modules — `a/<bs>/<a-bs>.module.ts` (parents: ['a']) and `b/<as>/<b-as>.module.ts` (parents: ['b']). Parent routes get child routes pushed in. No root module. Each side gets its own designed index grid (linking rows to the opposite entity). |
| One resource nested under multiple different parents (e.g., Activity under both Account and Deal) | Same two-sibling-modules technique as the join. One module per mount: distinct `name` (e.g., `accountActivities` vs `dealActivities`), same `form`, different `parents`. Each parent module pushes its own child route. |
| Transitive group mirror (hidden `team` select) | No Angular change — the hidden field is server-side plumbing baked into the form JSON by the planner's `template.json`. |
| `User resource: default user` + `Login form: userLogin` | AuthModule using `@formio/angular/auth`'s `FormioAuthConfig` pointing at `userLogin` + `userRegister`, PLUS `src/app/auth/auth.guard.ts` (`authGuard`) applied via `canActivate: [authGuard]` on every authenticated route |
| `SSO: OIDC` / `SSO: SAML` | AuthModule links to the Form.io SSO redirect URL (see `app-integration.md` → "SSO") |

## Consulting `frontend-design` — the full Stance rule

**Consult `frontend-design` for every UI surface — always briefed with the Bootstrap 5 stack.** This is the UI-heavy phase of the `formio-angular` pipeline: Resource templates are fully extendable and can be easily customized to meet any UI requirements. Extended resource components can provide their own `html` templates, and optional per-resource SCSS. ALL of that must be shaped by loading `frontend-design` first and following its guidance — same rule as the parent `formio-angular` skill's Stance. When invoking `frontend-design`, always prepend the `FRONTEND_DESIGN_BRIEF` that BOOTSTRAP Step 7d stashed so the skill knows the stack is Bootstrap 5 + Bootstrap Icons (pre-wired through `angular.json`), uses Bootstrap utility classes instead of Tailwind, and extends Bootstrap's CSS variables instead of introducing parallel design tokens. The patterns in `resource-module-patterns.md` give you the Angular plumbing (route shape, component base class, override pairs); `frontend-design` (briefed with BOOTSTRAP's preamble) gives you the visual-design decisions (layout, hierarchy, spacing, color, typography, affordances) — all expressed in Bootstrap 5 vocabulary. Do not ship a Phase B output that was not reviewed against `frontend-design` with the brief applied. The Phase A plan must explicitly confirm both happened — see "Plan must cite `frontend-design`" below. Extended resource components can provide the following to fully customize UI experience.

- A `resource.component.html`: Nav chrome around `:id/*` children)
- A `view/view.component.html`: The resource detail page — the biggest design surface in the skill)
- A `edit/edit.component.html`: (optional) The resource edit page - must include the same `<formio>` and options found in the `FormioResourceEditComponent` base component template.
- A `create/create.component.html`: (optional) Page used to create a new resource - must include the same `<formio>` and options found in the `FormioResourceCreateComponent` base component template.
- A `delete/delete.component.html`: (optional) Delete a component page - Confirm must call `onDelete()` and Cancel must call `onCancel()`
- A `index/index.component.html`: (optional) The resource "list" page - Any "grid" UI can be used, but refer to the `FormioResourceIndexComponent` base class for API fetch logic for Resource index data

## Plan must cite `frontend-design` AND the Bootstrap 5 brief

Per the Stance rule, the Scaffolding Plan block MUST contain an explicit `frontend-design consulted:` line declaring (a) that `frontend-design` was loaded before the plan was written, (b) that the `FRONTEND_DESIGN_BRIEF` from BOOTSTRAP Step 7d was passed in as the stack preamble (so recommendations came back in Bootstrap 5 vocabulary, not Tailwind / Material / custom tokens), and (c) which of its recommendations shaped the `ViewComponent` sketches in the plan. Example:

```
frontend-design consulted: YES — briefed with the Bootstrap 5 preamble from
BOOTSTRAP Step 7d. Applied its guidance on Bootstrap 5 card-based information
hierarchy (primary `card` with `card-header` stat rail + secondary `card`s in a
`row g-3`), Bootstrap spacing rhythm (`p-3`, `gap-3`, `mb-4`), `bi bi-*` icon
choices per resource, and `alert alert-info` empty-state treatment for zero-row
lists.
```

If `frontend-design` was not loaded (e.g., BOOTSTRAP Step 7 detected it was unavailable and the user waived the requirement), the line must still appear but read `frontend-design consulted: NO — user waived the requirement; emitted UI is best-effort Bootstrap 5 from memory`. The user sees the disclosure during approval and can reject. Do not emit Phase B until a real consultation has happened (with the brief) or the user has knowingly waived.
