## Why

`formio-application` can only build Angular apps: `formio-angular` is the sole row in `FRAMEWORK.md`'s registry, so every "build me an app" request ends in an Angular workspace regardless of what the user's team actually uses. React is the most-requested second target, and the library already documents exactly how a second row is added.

The Angular path works because `@formio/angular` ships a `FormioResource` module — a per-resource state service, a route factory, a cross-resource registry, and index/create/view/edit/delete screens — that the skill imports rather than generates. **`@formio/react` ships no equivalent.** Source review of `@formio/react` 6.2.1 (`nirvana/packages/react`, identical to `github.com/formio/react` apart from formatting and `GOTCHA` comments) confirms: no router integration of any kind (no `react-router` dependency), no per-resource service, no parent/child nesting, no alert bus, and a `FormioProvider` auth context that exposes `token` / `isAuthenticated` / `logout` but no user object and no ready signal. What exists is `Form`, `FormBuilder`, `FormEdit`, `FormGrid`, `SubmissionTable`, `Report`, `usePagination`, and a legacy Redux module set that is unwired from `FormioProvider`.

So a React implementor cannot be a thin wrapper over library primitives the way `formio-angular` is. The missing runtime has to come from somewhere, and this change decides two things about it: the skill generates it into the user's application, and it is designed from React Router's data-router model rather than transliterated from the Angular module — most of which turns out to be scaffolding for capabilities React Router already provides.

## What Changes

- **New parent skill `formio-react`** at `plugin/skills/formio-react/`, structured as a **router over named branches** rather than one linear procedure. Its `SKILL.md` holds a dispatch table, the shared preflight, and the handoff contracts; each branch's steps live in a sibling document:

  | Branch | Chain |
  | --- | --- |
  | Greenfield application | `SETUP.md` → `BOOTSTRAP.md` → `CONFIG.md` → `AUTH.md` → `formio-react-resources` |
  | Existing application | `SETUP.md` → `EXISTING.md` → backfill `CONFIG.md` / `AUTH.md` as needed → `formio-react-resources` |
  | Embed a form | **Reserved** — routes to `formio-form` today; a future sub-skill claims the row |

  Claims ONLY React-explicit triggers; accepts the same handoff payload shape `formio-angular` does, plus a `branch` field and the existing-app inspection findings.

- **The existing-application branch is a first-class path, not a degenerate greenfield.** `EXISTING.md` defines an inspection that runs before anything is modified — router style, installed packages, `FormioProvider` state, existing auth and current-user source, design conventions — after which only missing prerequisites are backfilled. Where the app already provides auth, a user source, or a layout in its own idiom, generated code integrates with it rather than replacing it. `BOOTSTRAP.md` never runs here.

- **An application without a data router is caught before any file is written.** The generated resources require loaders and actions, so an app routing through `<BrowserRouter>` with `<Routes>` alone cannot host them. The skill detects this, explains it, and offers conversion to `createBrowserRouter` or stopping — in one question round. Routing is shared infrastructure; it is never migrated silently.

- **A reserved branch keeps room for React form embedding.** Rendering one form in a React page — `@formio/react`'s `Form` component and the React-specific embedding concerns — is a distinct capability, deliberately NOT specified here. The dispatch table carries it as a reserved row so adding it later is a table edit plus a sub-skill, with no restructuring. Until then such requests route to `formio-form` with an honest disclosure that its guidance covers the Vanilla JS renderer. The CRUD branches are forbidden from absorbing embedding guidance to fill the gap.
- **New nested sub-skill `formio-react-resources`** at `plugin/skills/formio-react/formio-react-resources/` with `SKILL.md` + `references/` — the per-resource generator, same two-phase plan/approve/emit cadence and same `frontend-design` obligation as `formio-angular-resources`.
- **A skill-emitted resource-CRUD kernel, designed as React Router code rather than ported from Angular.** `formio-react-resources` writes a small runtime into the user's app once (`src/formio/`), then thin per-resource files on top of it.

  Auditing `@formio/angular`'s `FormioResource` against React Router's data-router API shows most of it is scaffolding for capabilities the router already has, so most of it is **not built**: `FormioResourceService` is replaced by route `loader`s and `action`s, its `resourceLoaded` promise by `useLoaderData` / `useRouteLoaderData`, its `save` / `remove` plus imperative navigation by an action returning `redirect()`, its `refresh` emitter by post-action revalidation, its `isLoading` by `useNavigation()`, `FormioAlerts` by `errorElement`, and the string-keyed `FormioResources` registry by the route hierarchy plus ordinary module imports.

  What the kernel actually contains is the Form.io domain logic that survives that subtraction, as **pure functions** — `applyParentContext`, `parentFilters`, `resourcePermissions`, `resourceUrls`, `preserveDraftState` — plus thin loader/action factories and a `resourceRoutes()` route-array builder that wires them together. Pure functions keep the domain logic testable without a renderer and reusable if an app fetches through something other than loaders. No change to `@formio/react` is proposed; the surface is specified as a stable contract so a later extraction into a published subpath is mechanical.

- **Hierarchical resource applications are a named, first-class output.** Nesting to arbitrary depth — `/customer/:customerId/quote/:quoteId/line-item/:lineItemId`, each child list filtered to its ancestor, each child create screen pre-filled with the ancestor and the field hidden — gets its own requirement in the sub-skill and its own reference document, `hierarchy.md`. Each resource declares a param named after itself, ancestor bindings are references to the ancestor's config object, and child route arrays compose into the parent item route's children the same way at every level. Child screens render inside the parent's chrome with a breadcrumb over the declared ancestor chain, and the current user is bindable as an ancestor for author-stamping and "my records" lists.

- **Two Angular-shaped requirements disappear rather than get ported.** Computing permissions in the item loader removes the "resolved versus anonymous" flag and the flash-of-hidden-controls it guarded against; referencing parents as imported config objects removes the `name` versus `form` footgun, since a wrong reference is a build-time error instead of a runtime 404.
- **Target stack is Vite + React Router data routers + TypeScript.** The data-router API is a hard requirement, not a preference — loaders, actions, `errorElement`, and post-action revalidation are precisely what let the generated code drop the service, registry, alert bus, and refresh emitter. Next.js App Router is out of scope for this change.
- **Skill-generated authentication**, covering the same ground as `formio-angular/AUTH.md` but through router primitives: login / register / logout routes whose submits are route actions, the current user loaded once in a root loader, and protection applied by wrapping a route's loader with `requireUser` so an anonymous navigation redirects before the protected screen mounts. No guard component, no mount-time user fetch.
- **A React row in `formio-application/FRAMEWORK.md`'s registry**, which makes the multi-framework routing branch (previously specified but unreachable) the live path for build-new and for ambiguous modify-existing workspaces.
- **A framework choice on every greenfield build.** `formio-application` asks which UI framework to build in — one question round, before any workspace is scaffolded — with Angular offered first and labelled the default. A user who declines to choose gets Angular, and is told so. The question is build-new only; an existing workspace's framework is detected, never asked as a preference. The registry table gains a `Default` column so the default is data, not prose.
- **Planning and import stay upstream.** `formio-react` never runs `formio-resource-planner` and never imports a template — it expects an approved `template.json` and an imported project, and asks the user to invoke `formio-application` when it has neither. This mirrors the shipped Angular requirement, and the five phases run behind a user-approval gate between each, as Angular's do.
- **A new eval harness** at `packages/skill-tests/evals/formio-react-resources/` (`evals.json`, `grade.py`, `README.md`, `fixtures/`), following the existing harness layout.

Not breaking. Nothing about the Angular path changes except that framework selection is now a question when intent is build-new.

## Capabilities

### New Capabilities

- `formio-react-skill`: the `formio-react` parent skill — directory layout, frontmatter and three-clause description, React-only trigger surface, the branch dispatch table, the greenfield phase chain, the existing-application inspect-and-backfill chain, the data-router precondition, the reserved embed branch, project-URL resolution via `project_get`, and the handoff contract with the resources sub-skill.
- `formio-react-resources-skill`: the nested `formio-react-resources` sub-skill — its trigger surface, the planner-artifact input contract, the four feature shapes (simple resource, parent→child, bidirectional N:N join, transitive group access), the Phase A plan template and approval gate, the Phase B file set, and the `frontend-design` obligation.
- `formio-resource-kernel`: the generated runtime's contract — the pure domain functions, the loader and action factories, the route shape produced by `resourceRoutes()`, the hierarchy model (per-resource params, ancestor bindings, path-resolved filters, create pre-fill versus edit verification, the current-user binding), loader-computed permissions, router-owned cache behavior, and the explicit list of Angular constructs that are NOT reproduced and why.

### Modified Capabilities

- `formio-application-skill`: `FRAMEWORK.md`'s registry gains a React row and a `Default` column, so the "exactly one row routes silently" scenario no longer describes the shipped state; the multi-framework question round becomes the live build-new path, a new requirement governs that question and its Angular default, and modify-existing detection must distinguish React from Angular workspaces (including a workspace carrying both signals).
- `shipped-surface-boundary`: the set of eval harnesses under `packages/skill-tests/evals/` gains `formio-react-resources/`, and the rule that no harness lives under `plugin/skills/` must hold for the new skill directory too.

## Impact

- **New files:** `plugin/skills/formio-react/**` (parent `SKILL.md` + four sibling documents + nested sub-skill with references), `packages/skill-tests/evals/formio-react-resources/**`, `.claude/skills/formio-react` symlink.
- **Edited files:** `plugin/skills/formio-application/FRAMEWORK.md` (registry row + detection signal), `CLAUDE.md` (skill count, framework-implementor prose), `README.md` and `plugin/README.md` (skill listings), `.claude-plugin/plugin.json` / `.cursor-plugin/plugin.json` / `plugin.json` if they enumerate skills.
- **Tests:** four hard-coded skill counts in `packages/skill-tests/src/` must be updated (`gatedSkillMd()` 11 → 13 in two suites, `allSkillMd()` 12 → 14 and `probingSkillMd()` 10 → 12), or the suites fail on arity before reading any prose. The library-wide `agent-skills-conformance`, `skill-description-budget`, and URL-terminology suites otherwise pick up the new `SKILL.md` files automatically — both descriptions must fit the 1,024-character budget, and every markdown file under the new directory is subject to the `FORMIO_PROJECT_URL` / `FORMIO_BASE_URL` terminology rule and the no-hard-wrap convention.
- **External dependencies:** none added to this repo. The generated application depends on `@formio/react`, `@formio/js`, `react-router`, and a Vite React TypeScript template.
- **Explicitly unchanged:** `@formio/react` itself (`nirvana/packages/react`). This change ships no code to that package; the kernel lives in the generated application.
