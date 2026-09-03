# AUTH — authentication through the router

`@formio/react` provides no authentication surface. `FormioProvider` exposes a token, whether a user is authenticated, and logout — no user object and no roles. So the surface is generated, and it is built from React Router primitives rather than from Angular's `FormioAuthService` shape.

## What gets generated

### Public routes

- **`/login`** and **`/register`** — render the planner's login and registration forms through `@formio/react`'s `Form` component. The credential submit goes to a route `action` that returns `redirect()` on success and error data on failure.
- **`/logout`** — clears the session and redirects. It renders no form.

### The current user, loaded once at the root

Load the current user in a **root route loader** and read it in descendants with `useRouteLoaderData`. One request, one source, available to every route that needs it.

### Protection by loader, not by component

Protect a route by wrapping its loader with `requireUser`, which returns `redirect('/login')` for an unauthenticated request before the wrapped loader runs.

Because the check happens during navigation, **a protected screen never mounts for an anonymous visitor**, and there is no intermediate render to suppress.

## What must NOT be generated

- **No `useUser` hook that fetches after mount.** The root loader has already resolved the user before anything renders.
- **No `isReady` flag** distinguishing "not yet resolved" from "anonymous". That distinction only exists when resolution happens after render, which loaders make impossible.
- **No guard component** that redirects from an effect. It mounts the protected screen first, then navigates away.
- **No use of the legacy Redux `modules/auth` surface.** It predates the current API and is not wired to `FormioProvider`.

Those shapes exist in Angular because its router has no data phase. Reproducing them here reintroduces a render pass in which a protected screen is briefly mounted for someone who may not be allowed to see it.

## Authorization stays server-side

Protection defaults to **authentication only**. Do not generate role or group guards unless the user asks for them: the deployment enforces authorization through `submissionAccess`, and a client-side role check is presentation, never a boundary.

## Gate

End with the approval gate: the generated routes, the root-loader user, and which routes are protected. Proceed only on approval.
