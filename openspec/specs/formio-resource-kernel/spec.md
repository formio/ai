## Purpose

Defines the resource-CRUD kernel that `formio-react-resources` generates into a user's application: the pure domain functions, the loader and action factories, the route shape `resourceRoutes()` produces, the hierarchy and ancestor-binding model, the auth and cache behavior it delegates to React Router, and the Angular `FormioResource` constructs it deliberately does not reproduce.
## Requirements
### Requirement: The kernel is a React Router data layer, not a port of the Angular service

The generated runtime SHALL be designed from React Router's data-router model, NOT transliterated from `@formio/angular`'s `FormioResource` module. `FormioResourceService`, `FormioResources`, `FormioAlerts`, and the `refresh` emitter exist because Angular has no data router and needs a DI-scoped object for sibling route components to share. React Router owns every one of those responsibilities natively, so none of them SHALL be reproduced:

| Angular construct | Why it exists there | What replaces it |
| --- | --- | --- |
| `FormioResourceService.loadForm/loadResource` | components cannot fetch before render | route `loader` |
| `resourceLoaded` promise awaited by siblings | share loaded state across sibling routes | `useLoaderData()` / `useRouteLoaderData(id)` |
| `FormioResources` string-keyed registry | DI lookup of another resource's loaded data | the route hierarchy, `params`, and ordinary module imports |
| `save()` / `remove()` plus imperative `router.navigate` | no mutation primitive in Angular routing | route `action` returning `redirect()` |
| `refresh: EventEmitter<FormioRefreshValue>` | manual push to re-render | automatic revalidation after an action |
| `isLoading` flag on the service | no navigation state | `useNavigation()` |
| `FormioAlerts` | no routing-level error boundary | `errorElement` + `useRouteError`, or error data returned from an action |
| `extendRouter` decorator mutation | Angular's static module metadata | routes are plain values; compose arrays |

The kernel SHALL therefore consist of **pure functions** carrying Form.io domain logic plus **thin loader/action factories** that call them. It SHALL NOT introduce a service object, a context provider registry, or a hook that re-implements fetching that a loader already performs.

#### Scenario: No service or registry is generated

- **WHEN** the generated kernel is inspected
- **THEN** it contains no per-resource service class or object holding fetch state
- **AND** it contains no context provider whose purpose is looking up another resource's loaded data
- **AND** it contains no event emitter used to trigger re-render

#### Scenario: Mutations go through route actions

- **WHEN** a generated create, edit, or delete flow is inspected
- **THEN** the write is performed in a route `action`
- **AND** navigation after a successful write is a `redirect()` returned from that action, not an imperative navigate call in a component

### Requirement: The kernel is generated into the application, not imported from a package

`formio-react-resources` SHALL emit the runtime as source files inside the user's application, under `src/formio/`, and SHALL NOT instruct the user to install a package that provides it. `@formio/react` ships no equivalent.

The kernel SHALL be emitted exactly once per application. On a later invocation against the same workspace, the sub-skill SHALL detect the existing kernel, leave it in place, and generate only new per-resource files. A kernel whose surface does not match this specification SHALL be reported with the specific divergence named, and SHALL NOT be silently overwritten.

Per-resource files SHALL contain configuration and presentation only. URL construction, parent resolution, permission computation, and route assembly SHALL live in the kernel.

#### Scenario: First generation writes the kernel

- **WHEN** Phase B runs against a workspace with no `src/formio/` directory
- **THEN** it writes the kernel modules named by this specification
- **AND** it writes the per-resource files for the requested resources

#### Scenario: Later generation reuses the existing kernel

- **WHEN** Phase B runs against a workspace that already contains a conforming kernel
- **THEN** the kernel files are unmodified and only new per-resource files are written

#### Scenario: Divergent kernel is reported, not overwritten

- **WHEN** Phase B finds `src/formio/` present but missing an export this specification requires
- **THEN** the sub-skill names the missing export and stops

### Requirement: Domain logic is pure functions

The Form.io-specific behavior the kernel owns SHALL be expressed as functions that take data and return data, with no React and no router imports. All but one SHALL be pure and synchronous; `resourcePermissions` is the exception, and the list below says why:

- `applyParentContext({ form, parents, parentSubmissions })` → `{ form, submissionDefaults }`. Walks the form's components with `Utils.eachComponent`, and for each parent entry finds the component whose `key` matches its `field`, sets that component's `hidden` to `true` and `clearOnHide` to `false`, and places the parent submission into the returned defaults at the component's resolved path. Returns a new form object; MUST NOT mutate its input.
- `parentFilters({ form, parents, params })` → a submission-query object. For each parent entry not marked `filter: false`, produces `data.<path>._id` equal to the parent id read from route params. It takes the **form** because `<path>` is the reference component's resolved data path, which only the form definition can supply; a signature without it can key on the binding's `field` alone, which is the unfiltered-list failure the next requirement forbids.
- `resourcePermissions({ formUrl, user, form, submission })` → `Promise<{ create, read, edit, delete }>`, wrapping `new Formio(formUrl).userPermissions(user, form, submission)`. `userPermissions` is an **instance** method and asynchronous — there is no `Formio.userPermissions` static — so this entry SHALL take `formUrl` as a parameter rather than deriving it, and SHALL NOT be specified as pure or synchronous. A signature omitting `formUrl` cannot construct the instance the call needs.
- `resourceUrls({ projectUrl, form, id })` → the form URL and, when an id is present, the submission URL.
- `preserveDraftState({ existing, incoming })` → the submission to write, retaining `state` from the loaded submission when the incoming one names none.

Purity is the point: these are the parts of the Angular service that are actually about Form.io rather than about Angular, and keeping them free of React and router imports means they are unit-testable without a renderer and reusable if an application fetches through TanStack Query, a server framework, or anything else instead of loaders.

#### Scenario: Parent context is applied without mutation

- **WHEN** `applyParentContext` is called with a form and a loaded parent submission
- **THEN** the returned form's matching component has `hidden: true` and `clearOnHide: false`
- **AND** the returned defaults carry the parent submission at that component's path
- **AND** the form object passed in is unchanged

#### Scenario: Pure functions import no React and no router

- **WHEN** the modules holding these functions are inspected
- **THEN** none of them imports `react` or `react-router`

#### Scenario: Draft round-trips through edit

- **WHEN** `preserveDraftState` receives an existing submission with `state: 'draft'` and an incoming submission naming no state
- **THEN** the result carries `state: 'draft'`

### Requirement: Loaders resolve URLs from the generated config, not from React context

Loaders and actions run **outside** React, during navigation, so they cannot read `FormioProvider`'s context. The kernel SHALL therefore take the Project URL and Base URL by importing the generated `src/config.ts` directly, and SHALL construct a `Formio` instance per request from the URL that `resourceUrls` builds.

`FormioProvider` configures the **renderer** — the `Form` component and the SDK statics the rendered form relies on. The kernel's data layer configures itself. Both read the same generated config module, so there is one source of truth and no dependency on global SDK state having been set by something that ran earlier.

The kernel SHALL NOT read URLs from module-level SDK globals set at bootstrap, and SHALL NOT require URLs to be threaded through `resourceRoutes` by every call site. Reading a global makes loader behavior depend on initialization order that is invisible at the call site and untestable in isolation.

**Authentication is the one exception, and it is forced.** `Formio.currentUser()` resolves against the SDK's global project URL, and no per-request form of it survives a sub-directory deployment: an instance constructed to carry the URL parses the host as the project (`https://host/myproject/customer` yields a project URL of `https://host`), so the call would authenticate against the wrong URL, and constructing an instance mutates the global regardless. Form and submission URLs are unaffected. The kernel SHALL therefore let `currentUser()` read the global, SHALL NOT construct an instance to carry an auth URL, and SHALL document why at the call site. It is safe ONLY because the generated `src/config.ts` SHALL set `Formio.setBaseUrl` and `Formio.setProjectUrl` at module evaluation, and every kernel module SHALL import that module. `FormioProvider` is NOT the guarantee: `createBrowserRouter(...)` calls `.initialize()` and runs the initial navigation's loaders the moment it is constructed — during module evaluation of the router file, before React has rendered the provider or anything else. A kernel that relied on the provider to set the globals would issue its first `currentUser()` against the SDK default URL and, on a self-hosted deployment, send the user's token to the wrong host.

#### Scenario: A loader resolves its URL without React

- **WHEN** a kernel loader runs during navigation
- **THEN** it obtains the Project URL by importing the generated config module
- **AND** it does not read React context
- **AND** it does not depend on a previously-set SDK global for form or submission URLs

#### Scenario: The auth call is the documented exception

- **WHEN** the kernel resolves the current user
- **THEN** it calls `currentUser()` against the global that `src/config.ts` set at module evaluation
- **AND** it does not construct a `Formio` instance to carry an auth URL
- **AND** the reason is recorded at the call site

#### Scenario: The globals are set before the router is constructed

- **WHEN** the generated `router.tsx` calls `createBrowserRouter`, which runs the initial loaders immediately
- **THEN** the SDK globals are already set, because the config module that sets them was imported first
- **AND** no loader depends on `FormioProvider` having rendered

#### Scenario: Provider and kernel agree by construction

- **WHEN** the generated application is inspected
- **THEN** `FormioProvider` and the kernel both take their URLs from the same generated config module

### Requirement: Loaders and actions are the fetching layer

The kernel SHALL export factories that build React Router `loader` and `action` functions from a resource config:

- `resourceListLoader(config)` — loads the form and the requested page of submissions, applying `parentFilters` when the resource has parents, and reading page and page-size from the route's search params.
- `resourceItemLoader(config)` — loads the form, the submission named by the route param, the current user, and the computed permissions, returning them as one loader payload.
- `resourceNewLoader(config)` — loads the form, loads any parent submissions the config names, and returns the result of `applyParentContext`.
- `resourceSaveAction(config)` — creates or updates a submission, applying `preserveDraftState` on update, and returns `redirect()` to the item route on success or error data on failure.
- `resourceDeleteAction(config)` — deletes the submission and returns `redirect()` to the list route.

Permissions SHALL be computed in `resourceItemLoader`, not in a component hook. The user, the form, and the submission are all in hand there, so the item shell renders with permissions already resolved and there is no intermediate state in which a permitted control is hidden. A `usePermissions` hook that fetches after mount SHALL NOT be generated.

Loaders SHALL pass the loaded form JSON to `@formio/react`'s `Form` via its `form` prop rather than handing it a `src` URL, so the router owns fetching and revalidation rather than the renderer.

**The loader is the only data owner for the list screen.** The generated list renders a table over `resourceListLoader`'s data; `@formio/react`'s `SubmissionTable` SHALL NOT be composed into it. That component fetches the form and its own page of submissions internally, so composing it would fetch both twice on every list route, would leave `parentFilters` with no documented path into its `submissionQuery`, and would put fetching where the router cannot revalidate it after a mutation.

Pagination SHALL therefore live in the route's search params rather than in component state, which makes a list's page linkable, restores it on back-navigation, and lets an action's revalidation return the user to the page they were on.

#### Scenario: A list route fetches once

- **WHEN** a list route loads
- **THEN** the form and the submission page are each requested once
- **AND** `SubmissionTable` is not rendered

#### Scenario: Pagination is addressable

- **WHEN** the user moves to page three and copies the URL
- **THEN** the URL carries the page, and opening it renders page three

#### Scenario: Item route renders with permissions resolved

- **WHEN** the item shell first renders
- **THEN** the edit and delete controls are already in their correct final state
- **AND** no request is issued from the component to determine them

#### Scenario: Renderer is given form JSON, not a URL

- **WHEN** a generated screen renders `Form`
- **THEN** it passes the loader's form JSON as the `form` prop
- **AND** it does not pass a `src` URL for the renderer to fetch

#### Scenario: List applies parent filters from route params

- **WHEN** the child list loader runs at `/events/:eventId/participants`
- **THEN** the submission query includes `data.event._id` equal to `params.eventId`

### Requirement: Resource configs compose into a hierarchy

A resource config SHALL be a plain object `{ routePath, param, form, parents? }`:

- `routePath` — the URL segment this resource mounts at (`customer`, `quote`).
- `param` — the route param name holding **this** resource's submission id. It SHALL be unique across the whole route tree and derived from the resource (`customerId`, `quoteId`). A bare `:id` SHALL NOT be generated.
- `form` — the form's `path` in the planner's `template.json`, copied verbatim.
- `parents` — an array of ancestor bindings, described in the next requirement.

Unique param names are load-bearing rather than cosmetic. Angular's nested resource routes all use `:id`, so a child route's params shadow its parent's and the child cannot read its ancestor's id at all — which is the reason `FormioResources` exists as a DI registry: it is the only channel by which a child can reach a loaded ancestor. Naming the params distinctly removes that constraint entirely. In `/customer/:customerId/quote/:quoteId`, every ancestor id is present in `params` at every depth, so a child reads what it needs directly and no registry is required.

Nesting SHALL be arbitrary depth. `/customer/:customerId/quote/:quoteId/line-item/:lineItemId` is composed the same way two levels are, and a descendant MAY bind to any ancestor, not only its immediate parent.

#### Scenario: Each resource declares a distinct param

- **WHEN** generated configs for `customer` and `quote` are inspected
- **THEN** their `param` values differ and neither is `id`

#### Scenario: Every ancestor id is reachable at depth

- **WHEN** a loader runs at `/customer/:customerId/quote/:quoteId/line-item/new`
- **THEN** `params` carries both `customerId` and `quoteId`

#### Scenario: Static segments win over the item param

- **WHEN** the router matches `/customer/:customerId/quote/new`
- **THEN** the `new` route matches, not the item route with `quoteId` of `"new"`

### Requirement: Ancestor bindings replace the DI registry

Each entry in `parents` SHALL be `{ resource, field, filter? }`, where `resource` is a **direct reference to the ancestor's config object**, imported as an ordinary module value, and `field` is the `key` of the component in this resource's form that holds the ancestor reference. `filter` defaults to `true`.

Angular's `name` registry key SHALL NOT exist. It was the string by which a child looked its parent up in the DI container, and the requirement to keep `name` and `form` distinct — a documented footgun in the Angular skill, where deriving one from the other 404s the entire CRUD surface — is an artifact of that lookup. With ancestors referenced as imported values, a wrong reference is a module or type error at build time, and the ancestor's `param` comes from the referenced config rather than being restated.

The ancestor's id SHALL be read from `params[parent.resource.param]`. The kernel SHALL NOT attempt to read an ancestor's loaded data from another route's loader: React Router runs the loaders of all matched routes **in parallel**, so a child loader cannot await its parent's result. This is why the child fetches what it needs itself, and why the design does not attempt a shared cache of loaded resources.

#### Scenario: Ancestor binding resolves through the referenced config

- **WHEN** a quote config declares `parents: [{ resource: customerConfig, field: 'customer' }]`
- **THEN** the ancestor id is read from the param named by `customerConfig.param`
- **AND** the quote config does not restate that param name

#### Scenario: A wrong ancestor reference fails at build time

- **WHEN** a config references an ancestor that does not exist
- **THEN** type-checking or module resolution fails, rather than a request 404ing against the deployment

### Requirement: Child lists filter on the ancestor's component path

`parentFilters` SHALL produce, for each binding not marked `filter: false`, a query entry keyed `data.<path>._id` whose value is the ancestor id from route params. `<path>` is the **resolved data path of the component whose `key` matches `field`**, as reported by `Utils.eachComponent` — not the `field` string and not the resource name.

The distinction matters whenever the reference component is nested inside a container, panel with a data key, or similar: its `key` is `customer` while its path is `billing.customer`, and filtering on the key produces a query that matches nothing while filtering on nothing produces a list of every submission in the resource. Angular derives the same value from `eachComponent`'s `path` argument, and the kernel SHALL preserve that.

When no component in the child's form has a `key` matching `field`, the kernel SHALL throw an error naming the resource, the missing field, and the likely cause — the planner's `template.json` did not emit a reference select for that relationship. It SHALL NOT fall back to an unfiltered query. Angular's equivalent path silently produces a malformed key and lists every record in the resource, which is a data-exposure failure, not a cosmetic one.

#### Scenario: Filter uses the resolved path, not the key

- **WHEN** the child's reference component has `key: 'customer'` at path `billing.customer`
- **THEN** the query entry is `data.billing.customer._id`

#### Scenario: Multiple filtering ancestors compose

- **WHEN** a line-item resource binds to both customer and quote with filtering enabled
- **THEN** the list query carries an entry for each

#### Scenario: Missing reference component is a hard error

- **WHEN** the child's form has no component whose `key` matches a binding's `field`
- **THEN** the loader throws an error naming the resource and the field
- **AND** no unfiltered submission query is issued

### Requirement: Create pre-fills the ancestor; edit verifies it

On the create route, `applyParentContext` SHALL, for each binding, hide the reference component (`hidden: true`, `clearOnHide: false`) and place the **whole ancestor submission object** into the new submission's defaults at that component's resolved path. Storing the whole object rather than the id is what the Form.io resource-select component expects, and it is what makes `data.<path>._id` a valid query against saved records.

Creating a child therefore requires fetching the ancestor submission, which is the only case that does. A binding used purely for filtering needs the id alone and SHALL NOT trigger a fetch.

On the edit route, the reference component SHALL be hidden the same way, but the stored value SHALL NOT be overwritten from the route context. Instead the kernel SHALL compare the stored ancestor `_id` against the route param and surface a mismatch as an error. Angular re-sets the parent from the route on every load, which silently rewrites the relationship if a record is ever reached through the wrong ancestor's URL; verifying instead makes that visible.

#### Scenario: New child arrives pre-filled and hidden

- **WHEN** a user opens `/customer/:customerId/quote/new`
- **THEN** the quote form's `customer` component is hidden with `clearOnHide: false`
- **AND** the submission defaults carry the full customer submission at that component's path
- **AND** saving produces a quote whose `data.customer._id` is that customer

#### Scenario: Filter-only binding issues no ancestor fetch

- **WHEN** a child list route renders and every binding is filter-only
- **THEN** no request for an ancestor submission is issued

#### Scenario: Edit does not rewrite the stored ancestor

- **WHEN** an existing quote is edited at `/customer/:customerId/quote/:quoteId/edit`
- **THEN** the stored `data.customer` is left as saved
- **AND** a stored ancestor id that disagrees with `customerId` is surfaced as an error rather than overwritten

### Requirement: The current user is bindable for pre-fill only

A binding MAY name the current user instead of a resource config, as `{ resource: 'currentUser', field: 'user', filter: false }`. It SHALL pre-fill the named component with the user loaded by the root loader and hide it, author-stamping new records.

`filter` SHALL be `false` for such a binding, and `parentFilters` SHALL throw when it is not, rather than dropping the clause — a dropped clause yields an unfiltered list that appears filtered.

**A "my records" view SHALL NOT be implemented by filtering in the client.** The deployment already scopes the list: when the requesting user lacks `read_all` on the form, the server injects an owner clause into both the model query and the count query before either runs. Three server-side mechanisms do this — the owner filter driven by `read_own` in `submissionAccess`, resource access driven by field-based `submissionAccess` on a reference select (which is also how group and team membership scopes a list), and the form's `fieldMatchAccess` conditions — and each ORs in the requester's own submissions. A plain list request therefore returns only the records that user may see.

Client-side filtering for this purpose is redundant when the access rules are configured and misleading when they are not: with `read_all` in force, the client clause is the only thing concealing other users' records, and it is trivially removed. The access rules are the data model's concern, owned by the planner and `formio-api`, not generated by this kernel.

#### Scenario: Author stamping needs no filter

- **WHEN** a binding is `{ resource: 'currentUser', field: 'user', filter: false }`
- **THEN** new submissions carry the current user in the named component
- **AND** the list query carries no clause for it

#### Scenario: Filtering on the current user is refused

- **WHEN** a `currentUser` binding enables filtering
- **THEN** `parentFilters` throws, naming the server-side access rules as the mechanism for a my-records view
- **AND** it does not silently omit the clause

#### Scenario: A my-records list is scoped by the deployment

- **WHEN** the form grants the authenticated role `read_own` rather than `read_all`
- **THEN** an unfiltered list request returns only that user's records
- **AND** the generated code adds no client-side owner clause

### Requirement: `resourceRoutes` returns composable route objects

`resourceRoutes(config, overrides)` SHALL return a React Router `RouteObject[]` with loaders, actions, and an `errorElement` already wired:

- the list route at the index
- a `new` route using `resourceNewLoader` and `resourceSaveAction`
- an item route at `:<param>` using `resourceItemLoader`, rendering a layout with `<Outlet />`, with a view child and an `edit` child using `resourceSaveAction`

`overrides` SHALL allow replacing each rendered surface — list, new, item layout, view, edit — so the sub-skill supplies designed components while the kernel supplies the data wiring.

Nested resources SHALL be composed by pushing a child's `resourceRoutes(...)` result, wrapped in its `routePath` segment, into the parent item route's `children` array. Because routes are plain values, this is ordinary array composition at any depth, and no decorator mutation, module re-writing, or router extension helper SHALL be generated. The kernel MAY expose a helper that performs the push, but it SHALL be a function over route arrays, not a registration side effect.

Nested child screens therefore render inside the parent item route's layout `<Outlet />`, so the parent's chrome — its heading, tabs, and breadcrumbs — stays on screen while a child list or child item is displayed. Each resource's item layout SHALL render links to its own child resources alongside its view and edit links, so a hierarchy is navigable without hand-written URLs.

Because a deep route no longer displays which ancestors it sits under, the generated item layout SHALL render a breadcrumb built from the ancestor chain the config declares, each segment linking to that ancestor's item route.

Delete SHALL be an action on the item route invoked with `useFetcher`, confirmed in a dialog. A dedicated `/delete` confirmation route SHALL NOT be generated; it is an Angular routing habit that costs a navigation and a route entry to ask one question.

#### Scenario: Routes carry their own data wiring

- **WHEN** `resourceRoutes` output is inspected
- **THEN** each route that reads data has a `loader` and each route that writes has an `action`
- **AND** the subtree has an `errorElement`

#### Scenario: Nested resource composes by array

- **WHEN** the quote resource's routes are composed into the customer item route's `children`
- **THEN** `/customer/:customerId/quote` renders the quote list scoped to that customer
- **AND** `/customer/:customerId/quote/new` renders the quote create screen
- **AND** `/customer/:customerId/quote/:quoteId` renders the quote item screen

#### Scenario: Child screens render inside the parent's chrome

- **WHEN** `/customer/:customerId/quote` renders
- **THEN** the customer item layout is still mounted around it
- **AND** the customer's own navigation links are visible

#### Scenario: Deep route shows its ancestry

- **WHEN** an item screen renders at `/customer/:customerId/quote/:quoteId/line-item/:lineItemId`
- **THEN** a breadcrumb names the customer, the quote, and the line item
- **AND** each ancestor segment links to that ancestor's item route

#### Scenario: Third level composes the same way as the second

- **WHEN** a line-item resource is composed into the quote item route's `children`
- **THEN** no kernel change is required to support the additional depth

#### Scenario: Delete is a fetcher action, not a route

- **WHEN** the generated delete affordance is inspected
- **THEN** it submits to the item route's action through `useFetcher`
- **AND** no `delete` path exists in the route tree

### Requirement: Auth is a root loader and guard loaders

The current user SHALL be loaded once in a root route loader and read by descendants with `useRouteLoaderData`. Route protection SHALL be a loader that redirects, not a guard component that renders a redirect after mount.

The kernel SHALL export `requireUser`, usable two ways: `requireUser()` is a loader that only checks, and `requireUser(loader)` wraps one. Either returns `redirect('/login')` for an unauthenticated request. Because the check happens during navigation, no protected screen mounts for an unauthenticated visitor and there is no intermediate render to suppress.

Protection SHALL be applied **once, at a pathless protected layout route** above the resource subtrees, rather than repeated on each route. A resource subtree is five or more routes, so per-route wrapping is five chances to omit one, and an omission fails silently — the screen renders and nothing reports that it was reachable while signed out. The authentication routes SHALL remain siblings of that layout route: `/login` and `/register` placed beneath it would redirect to themselves. Per-route wrapping remains available for a genuinely mixed public/private application.

Because matched routes' loaders run in parallel, the protected route's redirect aborts the navigation but child loaders have already fired. The deployment enforces access, so those requests fail rather than leaking; documentation SHALL say so, since the requests are visible and otherwise read as a defect.

`resourceRoutes` SHALL NOT accept a guard option. Protection lives above the subtree, and an options object that silently ignores unknown keys turns an invented `guard` key into routes that render unprotected with nothing reporting it.

A `useUser` hook that fetches the current user after mount SHALL NOT be generated, and neither SHALL an `isReady` flag distinguishing "not yet resolved" from "anonymous" — that distinction is only needed when resolution happens after render, which loaders make impossible.

#### Scenario: Protected route redirects during navigation

- **WHEN** an anonymous visitor navigates to a protected route
- **THEN** the redirect is returned from the loader
- **AND** the protected screen never mounts

#### Scenario: User is loaded once at the root

- **WHEN** several descendant routes need the current user
- **THEN** they read it from the root loader's data
- **AND** each does not issue its own `currentUser` request

### Requirement: Cache handling follows the router, not a global clear

The Angular components call `Formio.clearCache()` on destroy because the service and the renderer both cache and nothing else invalidates them. The kernel SHALL NOT generate a global cache clear on unmount; it is a blunt instrument that discards unrelated entries and races concurrent navigation.

Freshness SHALL instead come from the router: loaders revalidate after actions by default, and a loader that must bypass the SDK cache SHALL pass `ignoreCache` on that specific request.

#### Scenario: No global clear on unmount

- **WHEN** the generated components are inspected
- **THEN** none of them calls `Formio.clearCache()` in an unmount effect

#### Scenario: Fresh data after a write

- **WHEN** an action completes successfully
- **THEN** the affected route's loader revalidates without an explicit refresh call

### Requirement: Dependency and portability constraints

The kernel SHALL depend only on `@formio/react`, `@formio/js`, `react`, and `react-router`. It SHALL NOT use Redux, `@formio/react`'s legacy `modules/*` surface, or any additional state-management or data-fetching library.

Generated per-resource files SHALL import only from the kernel's index module, so the import specifier is the single thing a later extraction into a published package has to rewrite. The kernel's surface SHALL be documented as a stable contract for that purpose.

#### Scenario: Per-resource files import through the kernel index

- **WHEN** a generated per-resource file's imports are inspected
- **THEN** every kernel import resolves to the kernel's index module

#### Scenario: No state library is pulled in

- **WHEN** the generated kernel's imports are inspected
- **THEN** no import resolves to Redux, `react-redux`, `@formio/react/lib/modules`, or a third-party data-fetching library
