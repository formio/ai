# Wiring the application

## Read the routing code as an example

React Router is not the only router in React, and the kernel is deliberately split so that most of it does not care which one you use.

- **The domain logic is router-agnostic.** `applyParentContext`, `parentFilters`, `resourcePermissions`, `resourceUrls`, `preserveDraftState` are pure functions with no React and no router imports. They are the part that is actually about Form.io, and they work unchanged under TanStack Router, Wouter, a hand-rolled router, or a data layer like TanStack Query with any router at all.
- **The wiring is React Router specific.** The loader/action factories, `resourceRoutes`, `requireUser`, and everything on this page assume React Router's data-router API — loaders that run before render, actions that return `redirect()`, `errorElement`, revalidation after a mutation, `useLoaderData` and `useRouteLoaderData`. That is what this skill generates and what the eval harness grades, because those primitives are what let the kernel omit the service, registry, alert bus, and refresh emitter the Angular module needs.

So the code below is **the** implementation for React Router, and **an example** of what any router has to provide. Another router can host the same kernel if it supplies the same four things: a way to load data before a screen renders, a way to run a mutation and redirect on success, an error boundary per route subtree, and a way to re-fetch after a write. Map the pure functions in directly; rewrite only the wiring layer against that router's equivalents, keeping the same behaviours — permissions resolved before the item screen paints, protection applied above the subtree, filters keyed on the resolved data path. What does not transfer is a router with no data phase at all: `<BrowserRouter>` with `<Routes>` alone has nowhere to put a loader, which is why the existing-application branch gates on it.

## Router assembly

```ts
const router = createBrowserRouter([
  {
    path: '/',
    id: 'root',
    loader: rootLoader,          // the current user, loaded once
    element: <AppLayout />,      // shell: nav, gutters, max width
    errorElement: <AppError />,
    children: [
      // Public siblings — these must NOT sit under the protected route.
      { path: 'login', action: loginAction, element: <Login /> },
      { path: 'register', action: registerAction, element: <Register /> },
      { path: 'logout', loader: logoutLoader },
      {
        // Pathless layout route: adds no URL segment, protects everything below it.
        id: 'protected',
        loader: requireUser(),
        element: <Outlet />,
        children: appRoutes,     // every resource subtree
      },
    ],
  },
]);
```

The root route carries `id: 'root'` so descendants read the user with `useRouteLoaderData('root')`.

## Protection

**Apply it once, at the protected layout route.** A resource subtree is five or more routes — list, new, item, view, edit — so wrapping each by hand is five chances to miss one, and a missed one fails silently: the screen renders, and nothing reports that it was reachable while signed out. Hoisting protection above the subtrees makes the default structural instead of repeated.

`requireUser()` with no argument is a loader that only checks. `requireUser(loader)` wraps one, for the exception below.

Either form returns `redirect('/login')` for an unauthenticated request, during navigation — so a protected screen never mounts for an anonymous visitor. Do not generate a guard component that redirects from an effect.

**Keep the auth routes as siblings, not children.** `/login` and `/register` beneath the protected route would redirect to themselves.

**The exception: a mixed public/private app.** When one resource is genuinely public — a published directory, say — leave it outside the protected route and protect only the subtree that needs it, with its own pathless layout route:

```ts
{
  path: 'customer',
  children: [{ loader: requireUser(), element: <Outlet />, children: customerRoutes }],
}
```

`requireUser(loader)` wraps a loader for a route that has one of its own. It is the wrong tool here: `resourceRoutes` already installed `resourceListLoader` on the index child, so `loader: requireUser(resourceListLoader(customer))` on the parent runs the list query a second time and throws the result away.

**One nuance worth knowing.** React Router runs the loaders of all matched routes in parallel, so the protected route's redirect aborts the navigation but the child loaders have already fired. The deployment enforces access, so those requests 401 rather than leaking anything — but you will see them in the network tab, and that is expected rather than a bug in the generated code.

## The list screen

The loader owns the data. Render a generated table over `useLoaderData()`; do not compose `SubmissionTable`, which fetches internally.

Pagination reads and writes the route's search params, so a page is linkable, survives back-navigation, and is restored after an action revalidates. Columns come from the form's components — the ones without `tableView: false`.

Every list needs three states designed, not just the happy one: rows, empty, and error. An empty child list is common and normal — it is the state a user sees before they create the first record under a parent.

## Errors

Each resource subtree carries an `errorElement`. It renders the app's own error presentation, reading the thrown value with `useRouteError`.

Two distinct paths, and they are not the same surface:

- **Loader failures** — the route could not load. The `errorElement` renders in place of the screen.
- **Action failures** — a save was rejected, usually validation. The action returns error data rather than throwing, and the form screen renders it beside the form with the submission intact. Throwing here would replace the form with an error page and lose what the user typed.

Server-side validation errors arrive in the action's response and belong on the form, mapped to their fields where the shape allows it.

## Layout

The shell owns horizontal gutters and max content width. Generated screens do not add their own page padding — padding a screen fixes that one screen and leaves every route you did not write flush against the viewport edge.

## Design language

Greenfield: the `FRONTEND_DESIGN_BRIEF` stashed at bootstrap. Existing: whatever the application already uses, from the handoff findings. Either way `frontend-design` is consulted before screens are written.
