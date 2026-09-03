# The generated kernel — contract

The kernel is written into the user's application at `src/formio/`, once. Per-resource files import only from its index, so a later extraction into a published package rewrites one import specifier and nothing else.

`@formio/react` ships no equivalent, so this is generated rather than installed.

## Designed from React Router, not ported from Angular

`@formio/angular`'s `FormioResource` module is mostly scaffolding for capabilities React Router already has. None of it is reproduced:

| Angular construct | Why it exists there | What replaces it |
| --- | --- | --- |
| `FormioResourceService.loadForm/loadResource` | components cannot fetch before render | route `loader` |
| `resourceLoaded` promise awaited by siblings | share loaded state across sibling routes | `useLoaderData()` / `useRouteLoaderData(id)` |
| `FormioResources` string-keyed registry | DI lookup of another resource's data | the route hierarchy, `params`, and module imports |
| `save()` / `remove()` + imperative navigate | no mutation primitive | route `action` returning `redirect()` |
| `refresh: EventEmitter` | manual push to re-render | automatic revalidation after an action |
| `isLoading` on the service | no navigation state | `useNavigation()` |
| `FormioAlerts` | no routing-level error boundary | `errorElement` + `useRouteError` |
| `extendRouter` decorator mutation | Angular's static module metadata | routes are values; compose arrays |

Do not generate a service object, a context registry, or a hook that re-fetches what a loader already loaded.

## Pure functions — the domain logic

No React imports, no router imports, no fetching. Unit-testable without a renderer, and reusable if an application fetches some other way.

- **`applyParentContext({ form, parents, parentSubmissions })` → `{ form, submissionDefaults }`** — walks components with `Utils.eachComponent`; for each binding finds the component whose `key` matches its `field`, sets `hidden: true` and `clearOnHide: false`, and places the parent submission into the defaults at that component's **resolved path**. Returns a new form; never mutates its input.
- **`parentFilters({ form, parents, params })` → query object** — for each binding not marked `filter: false`, `data.<path>._id` equal to the ancestor id from route params. It takes the **form** because `<path>` is the reference component's resolved data path, which only the form definition can supply — a signature without it can key on the binding's `field` alone, which is the unfiltered-list failure described below.
- **`resourcePermissions({ formUrl, user, form, submission })` → `Promise<{ create, read, edit, delete }>`** — wraps the SDK's `userPermissions`, which is an **instance** method and asynchronous: `new Formio(formUrl).userPermissions(user, form, submission)`. There is no `Formio.userPermissions` static, so the URL is a parameter rather than something the function can derive — this is the one entry here that is neither pure nor synchronous.
- **`resourceUrls({ projectUrl, form, id })`** — the form URL, and the submission URL when an id is present.
- **`preserveDraftState({ existing, incoming })`** — retains `state` from the loaded submission when the incoming one names none, so a draft that round-trips through edit stays a draft.

### The filter key is the resolved path, not the field key

`Utils.eachComponent` yields both a component and its data path. They diverge whenever the reference component sits inside a container: `key` is `customer` while the path is `billing.customer`. Filtering on the key matches nothing; filtering on nothing lists every record in the resource.

**When no component's `key` matches a binding's `field`, throw** — naming the resource, the field, and the likely cause (the planner's `template.json` emitted no reference select for that relationship). Never fall back to an unfiltered query. Angular's equivalent path produces a malformed key and lists everything, which is a data-exposure failure, not a cosmetic one.

## URL resolution — loaders import the config

Loaders run **outside React**, during navigation, so they cannot read `FormioProvider`. The kernel takes both URLs by importing the generated `src/config.ts` directly and constructs a `Formio` instance per request from the URL `resourceUrls` builds.

`FormioProvider` configures the **renderer**; the kernel configures its own data layer. Both read the same module, so there is one source of truth and no ordering requirement.

Do **not** read URLs from SDK globals set at bootstrap — that makes loader behavior depend on initialization order invisible at the call site — and do **not** thread URLs through every `resourceRoutes` call.

### The one exception: `Formio.currentUser()`

Auth is the exception, and it is forced rather than chosen. `currentUser()` resolves against the SDK's **global** project URL, and there is no per-request form of it that survives a sub-directory deployment. Constructing an instance to carry the URL does not work:

```
new Formio('https://forms.mysite.com/myproject/customer').projectUrl
  -> 'https://forms.mysite.com'      // the project segment is gone
```

The instance parses the host as the project, so on a deployment that routes projects to sub-directories the auth call would go to the wrong URL. Constructing an instance before `setProjectUrl` has run also **mutates** the global as a side effect, so the no-globals property is not reachable that way at all. Form and submission URLs are unaffected — `formUrl` parses correctly — so this is scoped to `currentUser` alone.

What makes it safe is that the global is set by the same module the kernel reads. **`src/config.ts` calls `Formio.setBaseUrl` / `Formio.setProjectUrl` at module evaluation**, right after exporting the two values, and every kernel module imports it — so the globals are in place before any loader runs. `setProjectUrl` stores what it is given verbatim rather than re-parsing it, which is precisely why the mangling above does not apply here.

**`FormioProvider` setting the same values during render is NOT what makes this safe, and must not be relied on.** `createBrowserRouter(...)` starts the initial navigation — and its loaders — the moment it is called, during module evaluation of the router module, before React has rendered anything. A `rootLoader` that ran `currentUser()` against globals only the provider sets would hit `https://api.form.io/current` (the SDK's default) on first load, sending the user's token to the wrong host on any self-hosted deployment; and the first `new Formio(formUrl)` in a sibling loader would then stamp its mis-parsed project URL into the global. The provider still receives both values from `src/config.ts` — for the renderer and the auth context — but the kernel's correctness does not depend on when it mounts.

So: build form and submission URLs per request from the config module; let `currentUser()` read the global that same module set. Do not "fix" the auth call by constructing an instance for it, and do not move the `set*Url` calls out of `src/config.ts` into a component.

**`currentUser()` rejects on a dead token.** When a stored token is expired or revoked, the `/current` request fails with a 401 or 440 and the promise REJECTS rather than resolving `null`. `requireUser` and `rootLoader` therefore go through a `currentUserOrNull` helper that folds the rejection into "anonymous" — otherwise a returning user with a stale token gets the `errorElement` instead of the sign-in redirect.

## Loaders and actions

- **`resourceListLoader(config)`** — the form plus the requested page of submissions, `parentFilters` applied, page and page size read from the route's search params.
- **`resourceItemLoader(config)`** — the form, the submission named by the route param, the current user, and the computed permissions, as one payload.
- **`resourceNewLoader(config)`** — the form, any ancestor submissions the config names, and the result of `applyParentContext`.
- **`resourceSaveAction(config)`** — create or update, `preserveDraftState` on update, `redirect()` to the item route on success, error data on failure.
- **`resourceDeleteAction(config)`** — delete, then `redirect()` to the list route.

**Permissions are computed in the item loader, never in a hook.** User, form, and submission are all in hand there, so the item shell renders with edit and delete already in their final state. A hook that fetches after mount reintroduces a pass where a permitted control is hidden.

**The renderer gets loader-supplied form JSON** as an object passed through `Form`'s `src` prop — never a URL string, which would put fetching back in the renderer where the router cannot revalidate it. `src` is the prop the types require; the `form` alias is optional in the types, so a screen written `<Form form={form} />` without `src` fails to compile.

**Every screen that hands `onSubmit` to an action latches on a ref so one submission cannot write twice.** A create route that runs its handler twice writes two records, milliseconds apart, and the duplicates look like data somebody meant to create. `navigation.state` and a disabled button are both too late — the second call arrives in the same tick. See [`resource-patterns.md`](./resource-patterns.md) → "Latch the submit".

**The loader is the only list-screen data owner.** Render a generated table over its data; do not compose `@formio/react`'s `SubmissionTable`, which fetches the form and its own page internally — composing it double-fetches every list route and leaves `parentFilters` no path into its `submissionQuery`. Pagination lives in route search params, so a list page is linkable and survives back-navigation.

## Config and hierarchy

```
{ routePath, param, form, parents? }
```

- **`routePath`** — the URL segment (`customer`).
- **`param`** — the route param holding **this** resource's id. Distinct across the whole tree, derived from the resource (`customerId`). Never a bare `id`.
- **`form`** — the form's `path` in `template.json`, verbatim.
- **`parents`** — `{ resource, field, filter? }[]`, where `resource` is a **direct reference to the ancestor's config object**, imported as an ordinary value. `filter` defaults to `true`.

A binding MAY name `'currentUser'` instead of a config object. It is **prefill only** — author-stamping the current user into a hidden reference — and `filter` MUST be `false`. `parentFilters` throws on a `currentUser` binding with filtering enabled rather than dropping the clause, because a dropped clause is an unfiltered list that looks filtered.

"My records" is not a client concern: when the user lacks `read_all`, the deployment injects an owner clause into the list query itself. See [`hierarchy.md`](./hierarchy.md) §6.

There is no registry key. Angular's `name` existed only for DI lookup, and the requirement to keep it distinct from `form` was a footgun that 404s a whole CRUD surface. An ancestor referenced as an imported value fails at build time instead.

The ancestor's id comes from `params[parent.resource.param]`. **Do not try to read an ancestor's loaded data from another route's loader:** React Router runs the loaders of all matched routes in parallel, so a child cannot await its parent's. It does not need to — filtering needs only the id, and only create needs the ancestor object, which it fetches itself.

Full walk-through: [`hierarchy.md`](./hierarchy.md).

## Routes

`resourceRoutes(config, overrides)` returns `RouteObject[]` with loaders, actions, and an `errorElement` wired:

- the list route at the index
- `new` — `resourceNewLoader` + `resourceSaveAction`
- `:<param>` — `resourceItemLoader`, carrying a stable `id`, rendering a layout with `<Outlet />`, with a view child and an `edit` child

`overrides` replaces each **rendered surface** and nothing else: list, new, item layout, view, edit. It takes no guard, no loader, and no action — those are the kernel's, and protection is applied above the subtree (see [`app-integration.md`](./app-integration.md)). Unknown keys are ignored silently, so an invented option produces routes that quietly lack whatever it was meant to add.

`requireUser` is usable two ways: `requireUser()` is a loader that only checks, for the protected layout route; `requireUser(loader)` wraps one, for a route protected on its own.

**Type the loaders as `react-router`'s own `LoaderFunction`.** A local alias like `type Loader = (args: never) => unknown` looks permissive and is the opposite: a `never` parameter is checked contravariantly, so nothing accepting real loader arguments can be assigned to `RouteObject['loader']`, and `tsc` rejects every route the kernel builds. Take `LoaderFunction` from `react-router` and let the factories' own inferred types satisfy it.

**`itemRouteOf` returns the item route with `children` present**, not optional — declare it `RouteObject & { children: RouteObject[] }`. The function has just defaulted `children` to `[]`; typing the return as bare `RouteObject` leaves `children` `| undefined`, and `itemRouteOf(x).children.push(...)` — the composition every hierarchy uses — does not compile under `strict`.

### The item route carries an `id`, and its children read it

The item loader fetches the form, the submission, the user and the permissions in one request, so the `view` and `edit` children deliberately have **no loader of their own** — a second one would refetch all of it.

That makes two things mandatory, and both fail in ways worth naming:

**`useLoaderData` resolves against the route the component renders in — NOT the nearest ancestor with a loader.** Called from a child that has no loader it returns `undefined`, so `const { submission } = useLoaderData()` throws `Cannot destructure property 'submission' of 'useLoaderData(...)' as it is undefined` the first time anyone opens the screen. The item route therefore carries a stable `id` (derive it from `routePath`, which is already unique per resource), the kernel exposes a `useResourceItem(config)` hook wrapping `useRouteLoaderData(itemRouteId(config))`, and every view/edit screen uses that hook instead.

**`useActionData` is keyed the same way.** The `edit` child gets its own `action` — the same save action the item route uses. Without it a rejected save returns its errors under the item route's id, the edit screen reads `undefined`, and the user sees a form that simply does nothing on submit. That one does not throw, so it survives review; it is the more dangerous of the two.

The item layout itself renders **at** the `:<param>` route, so it uses plain `useLoaderData()` correctly. Three screens, two of which must not use the call the third does — do not copy between them.

**One config, one mount.** The id is derived from `routePath`, and React Router requires route ids to be globally unique — `createBrowserRouter` throws `Found a route id collision on id "<routePath>-item"` and the whole application fails to start. Calling `resourceRoutes` twice with the SAME config is therefore never correct, which matters for the bidirectional join: each side gets its own config, with its own `routePath` and `param`, both pointing at the same `form`. That is also what makes the two sides addressable — `/team/:teamId/member/:membershipId` and `/user/:userId/team-membership/:teamMembershipId` cannot share a param name either.

**Delete is an action on the item route, invoked with `useFetcher` and confirmed in a dialog.** No `/delete` route — a navigation and a route entry to ask one question is a routing habit, not a requirement.

## Cache

**No global `Formio.clearCache()` on unmount.** Angular needs it because nothing else invalidates; here the router revalidates after actions, and a global clear discards unrelated entries and races concurrent navigation. A loader that must bypass the SDK cache passes `ignoreCache` on that specific request.

## Dependencies

`@formio/react`, `@formio/js`, `react`, `react-router`. No Redux, no `@formio/react` legacy `modules/*`, no third-party data-fetching library.
