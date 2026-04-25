# AUTH — `AuthModule` and `FormioAuthConfig` wiring

This document is loaded by the parent `formio-angular` skill during Phase 4. It is **not** a standalone skill — no frontmatter, no independent trigger. The parent reads it after CONFIG has been approved and before delegating to the resource sub-skill.

## External references (authoritative)

- https://help.form.io/developers/introduction/application#user-authentication — the canonical explanation of user authentication in `@formio/angular` applications.
- https://github.com/formio/angular-demo/blob/master/src/app/auth/auth.module.ts — the reference implementation of `AuthModule`, including `FormioAuthConfig` registration, login/register form names, and the `FormioAuthService` wiring.
- https://github.com/formio/angular-demo/blob/master/src/app/app.module.ts#L71 — the exact line where the `angular-demo` imports the `AuthModule` into `AppModule`. Match the position in the imports array.
- https://github.com/formio/angular/wiki/User-Authentication#authentication-events — the canonical list of `FormioAuthService` events (`login`, `logout`, `error`) that the `app.component.ts` edit below subscribes to for post-login / post-logout navigation.

Read these URLs before generating the files below if you are at all unsure about a detail. The templates here are faithful to the demo at the time of writing, but the demo is the source of truth.

## Skip-if-already-wired detection

Before generating anything, inspect the target workspace:

1. Read `src/app/app.module.ts`. Check for an `import { AuthModule } from './auth/auth.module'` (or equivalent path) and an entry for `AuthModule` inside `@NgModule({ imports: [...] })`.
2. Read `src/app/auth/auth.module.ts` if it exists. Check that it (a) configures `FormioAuthConfig` (typically by declaring an `AuthConfig` object and providing it) AND (b) mounts `RouterModule.forChild(FormioAuthRoutes())` so the login/register URLs resolve. A file that configures the provider but does not mount `FormioAuthRoutes()` is half-wired — treat that as "needs regeneration" and run the phase.
3. Read `src/app/app-routing.module.ts`. Check for a route whose `path` is `'auth'` with a `loadChildren` entry pointing at `./auth/auth.module`. Missing this route means `/auth/login` is a dead URL even when `AuthModule` is correct.
4. Read `src/app/app.component.ts`. Check for `FormioAuthService` import + `onLogin` + `onLogout` subscriptions + `router.navigate` calls.

If ALL four conditions hold, **skip this phase**. Tell the user which files triggered the skip:

> Skipping AUTH — `src/app/auth/auth.module.ts` already configures `FormioAuthConfig` and mounts `FormioAuthRoutes()`, `AppModule` already imports `AuthModule`, `AppRoutingModule` has the `/auth` lazy route, and `AppComponent` subscribes to `FormioAuthService.onLogin` / `onLogout`. Moving to Resources. Say if you want to regenerate the auth wiring anyway.

If only a subset is already wired, run the phase and regenerate ONLY the missing pieces (don't clobber user-customized files). If the user wants to fully regenerate, run the phase as normal and overwrite.

## Source of auth values: the planner's `template.md` + `template.json`

If the `formio-resource-planner` artifact pair is in scope, derive the auth configuration from it — do not invent values. Prefer `template.md` for the human-readable answer (its `## Users & Auth` and `## Roles` sections name every value in plain text) and cross-check against `template.json` for exact machine names and action settings. Extract four things:

| Field                            | How to find it in the artifact pair                                                                                                                                                                                                                                                           |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **user resource** (machine name) | `template.md` `## Users & Auth` → `User resource:` line names it (default `user` or a custom name). Confirm in `template.json.forms` or `template.json.resources` — the form whose `type` is `resource` and whose `name` matches.                                                            |
| **login form path** (URL path)   | `template.md` `## Users & Auth` → `Login form:` line names the form. Then open `template.json.forms` (or `template.json.resources`) and read the matching entry's **`path`** property — THIS is the value that goes into `FormioAuthConfig.login.form`. Typically kebab-case and namespaced under the user resource (e.g. `user/login`); NEVER use the form's `name` / `machineName` in this field. |
| **register form path** (URL path)| Same rule as login. `template.md` names the register form; `template.json.<form-entry>.path` is the URL segment that goes into `FormioAuthConfig.register.form` (e.g. `user/register`). If `template.md` states `admin-invite only` / `none`, omit the `register` block entirely rather than guessing a path. |
| **role list**                    | `template.md` `## Roles` → bulleted list with capability summaries. Cross-check against `template.json.roles` — keys are machine names.                                                                                                                                                       |

### `FormioAuthConfig.login.form` / `.register.form` MUST equal `template.json.<form>.path`

Same rule as `FormioResourceConfig.form` in the Resources sub-skill: the `form` string inside `FormioAuthConfig` is a **URL path segment**, not a machine name. `@formio/angular/auth` appends `'/' + config.login.form` (and `.register.form`) to the project URL to build the form-load request, so the value MUST match the `path` property of the corresponding form inside `template.json` byte-for-byte. Default Form.io projects create the login form at `user/login` and the register form at `user/register` (the user-resource slug + a nested path), and the planner writes those values into `template.json.forms[*].path` — copy them from there. Do NOT substitute the form's `name` / `machineName` (e.g. `userLogin`, `userRegister`) — those are unrelated identifiers and will 404 at runtime.

## No-artifact-pair fallback

If there is no `template.md` / `template.json` pair available, pause at the start of this phase and offer two options via `AskUserQuestion`:

1. **Run `formio-resource-planner` first** — the planner is the canonical upstream producer of the artifact pair this phase consumes. The parent will pause, hand off to the planner, and resume here once `template.md` + `template.json` are approved.
2. **Skip AUTH with a TODO** — generate `AppModule` without importing an `AuthModule`, but insert a TODO comment that points at the endpoints the user will need to wire auth manually later:

```ts
// TODO: configure authentication.
// Built-in user-resource auth:  see the `formio-api/references/runtime-auth` skill
// Platform-level SSO / OIDC:    see the `formio-api/references/platform-auth` skill
// When ready, generate src/app/auth/auth.module.ts and import AuthModule into this module.
```

Do not proceed to the Resources phase in a way that assumes authenticated access if AUTH was skipped — surface the skip clearly in the handoff to the Resources sub-skill (`./resources/SKILL.md`, a sub-folder of this skill — NOT a separately-registered top-level skill) so resource modules that require auth flag the gap.

## `src/app/auth/auth.module.ts` template

Write this file when the extraction produced a user resource, login form, and register form. Substitute the placeholders with the **`path`** values extracted from `template.json.forms` (or `template.json.resources`) for the login and register forms — NOT the form machine names. Typical Form.io projects default to `user/login` and `user/register`; the planner records whatever the template declares, and your job is to copy those values verbatim.

```ts
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormioAuthConfig, FormioAuthService, FormioAuthModule } from '@formio/angular/auth';

export const AuthConfig: FormioAuthConfig = {
  app: {
    appUrl: '{{FORMIO_PROJECT_URL}}', // same value CONFIG wrote into FormioAppConfig.appUrl
    apiUrl: '{{FORMIO_BASE_URL}}',    // same value CONFIG wrote into FormioAppConfig.apiUrl
  },
  login: {
    form: '{{LOGIN_FORM_PATH}}',      // === template.json login form's `path` — typically 'user/login'
  },
  register: {
    form: '{{REGISTER_FORM_PATH}}',   // === template.json register form's `path` — typically 'user/register'
  },
};

@NgModule({
  imports: [
    CommonModule,
    FormioAuthModule,
    RouterModule.forChild(FormioAuthRoutes()), // mounts /login, /register, and /logout (see note below)
  ],
  providers: [{ provide: FormioAuthConfig, useValue: AuthConfig }, FormioAuthService],
})
export class AuthModule {}
```

Imports update: pull `FormioAuthRoutes` alongside the other auth symbols — `import { FormioAuthConfig, FormioAuthService, FormioAuthModule, FormioAuthRoutes } from '@formio/angular/auth';`.

**Why `FormioAuthRoutes()` matters.** Without it, the `AuthModule` registers the providers + components but does NOT map any URL to the login/register form — so `router.navigate(['/auth/login'])` from `app.component.ts` resolves to an empty outlet and the user sees a blank page. `FormioAuthRoutes()` returns a pre-built `Routes` array that wires `login` → `FormioAuthLoginComponent`, `register` → `FormioAuthRegisterComponent`, and `logout` → a redirect, which is why mounting it via `RouterModule.forChild(...)` is required, not optional. Customization (override login/register components, tweak the redirect target) is handled by passing an options object to the function — see the optional "Customizing the login and register components" section below.

**Worked example** — default user resource with planner-emitted `template.json.forms` containing `{ name: 'userLogin', path: 'user/login' }` and `{ name: 'userRegister', path: 'user/register' }`, against project `https://myproject.form.io` on platform `https://api.form.io`:

```ts
export const AuthConfig: FormioAuthConfig = {
  app: {
    appUrl: 'https://myproject.form.io',
    apiUrl: 'https://api.form.io',
  },
  login: {
    form: 'user/login',    // === template.json.forms[userLogin].path
  },
  register: {
    form: 'user/register', // === template.json.forms[userRegister].path
  },
};
```

Notes on why this shape:

- `FormioAuthConfig` is imported from `@formio/angular/auth`, not from the top-level `@formio/angular` entry point. This is the import path the `angular-demo` uses.
- `AuthConfig.app.appUrl` + `AuthConfig.app.apiUrl` mirror the same URL pair CONFIG wrote into `FormioAppConfig` (SETUP captured these as `FORMIO_PROJECT_URL` / `FORMIO_BASE_URL`). `@formio/angular/auth` reads them to scope every auth request to the right project on the right platform — even though `FormioAppConfig` already carries the pair, the auth module is designed to be self-contained, so you MUST copy both values in here rather than relying on the shared provider.
- `AuthConfig.login.form` and `AuthConfig.register.form` are **URL path segments**, not machine names. The auth module issues requests against `appUrl + '/' + login.form` (and similarly for register), so the value MUST equal the `path` property of the corresponding form inside `template.json`. On a default user-resource setup the planner records `user/login` and `user/register`; on custom setups (e.g., `User resource: member`) the paths follow the custom resource slug. Never substitute the form's `name` / `machineName` (e.g. `userLogin`) — that produces a 404 on sign-in.
- `FormioAuthService` is a service the rest of the application consumes to read the current user, log out, and gate routes. It must be registered as a provider here.
- The role list from `template.json.roles` does not appear in this file directly — roles are enforced at the API level and by route guards in individual resource modules. The Resources sub-skill (nested at `./resources/SKILL.md` under this skill — load the file, do NOT invoke a top-level skill) consumes the role list when it wires per-resource guards.

## `src/app/app.module.ts` edits

Add the `AuthModule` import to `AppModule`:

```ts
import { AuthModule } from './auth/auth.module';

@NgModule({
  imports: [
    // ...existing imports including FormioModule from CONFIG phase
    AuthModule,
  ],
  // ...
})
export class AppModule {}
```

Match the position in the imports array used by the `angular-demo` reference (see the `app.module.ts#L71` link above). `AuthModule` goes after `FormioModule` and before any feature/resource modules, because downstream resource modules depend on `FormioAuthService` being available.

## `src/app/app-routing.module.ts` edits — mount `AuthModule` under `/auth`

The `FormioAuthRoutes()` array you attached inside `AuthModule` wires the `login` / `register` / `logout` child paths, but it still needs a parent path to live under. The convention (matching the wiki and the `angular-demo`) is to mount `AuthModule` at `/auth` via lazy loading, so the final URLs are `/auth/login`, `/auth/register`, and `/auth/logout`. Those are the exact URLs the `app.component.ts` subscriptions below redirect to.

Open `src/app/app-routing.module.ts` (generated by `angular-new-app` when routing was enabled) and add the `auth` route to the `Routes` array:

```ts
const routes: Routes = [
  // ...existing routes (e.g. resource modules)
  {
    path: 'auth',
    loadChildren: () => import('./auth/auth.module').then((m) => m.AuthModule),
  },
];
```

Notes:

- Use the dynamic `import(...)` form, not the legacy `'./auth/auth.module#AuthModule'` string — the string form was removed in Angular 9+ and `angular-new-app` defaults to the dynamic form on every currently-supported Angular major.
- Keep `path: 'auth'` exactly. Changing it (e.g. to `path: 'account'`) silently breaks the redirect targets in `app.component.ts` unless you change both together.
- If the workspace was scaffolded without `app-routing.module.ts` (the user answered "no" to routing during `angular-new-app`'s interview), BOOTSTRAP should have re-prompted them; if you find yourself here with no routing module, stop and tell the user — do NOT synthesize a routing module from scratch.

## `src/app/app.component.ts` edits — subscribe to authentication events and redirect

### Why this step exists

Without this edit, a successful login leaves the user stranded on the Login page. `FormioAuthModule` posts the submission, gets a JWT, emits an `onLogin` event on `FormioAuthService` — and that is where its job ends. The view does NOT change on its own because the login route is still the active route. Something in the application shell has to listen for the event and navigate the router. `app.component.ts` is the right place because it is the one component that is instantiated exactly once for the life of the app, so a single subscription there covers every login/logout that ever happens.

The canonical reference for the event surface is the Form.io Angular wiki: https://github.com/formio/angular/wiki/User-Authentication#authentication-events. Read it first if any detail below diverges from upstream — the wiki is the source of truth.

### Event surface (what `FormioAuthService` emits)

`FormioAuthService` exposes five EventEmitters and one Promise you can consume:

- **`onLogin`** — emitted once per successful interactive login (the user submitted the login form and a JWT came back). Treat as "navigate to the app shell."
- **`onRegister`** — emitted once per successful self-registration. Most apps treat this the same as `onLogin` (the Form.io registration action chain ends with an automatic login, so a JWT is already present) and navigate to the same landing route. If your template wants a "welcome / onboarding" page after register, route there instead of `/`.
- **`onLogout`** — emitted once per explicit logout (and also when the JWT is cleared because of a `401`). Treat as "session gone — send the user back to the login form."
- **`onUser`** — emitted whenever the user object is (re)established from the server. This fires on an interactive login AND on every JWT-restore at app boot, so it is strictly broader than `onLogin`. Use it when you want a single subscription that also covers "returning user with a cached token"; skip it if `onLogin` + `onRegister` already cover your cases.
- **`onError`** — emitted when the auth request itself fails (bad credentials, network error, form validation failure). Do NOT navigate on `onError`; `FormioAuthModule`'s built-in login component already renders the error alert on-screen. Optionally log it for diagnostics.
- **`ready`** — a Promise (not an EventEmitter) that resolves once every auth subsystem has finished initializing (JWT restore attempt, user fetch). `await auth.ready` in an APP_INITIALIZER or in an auth-guard's `canActivate` to block first render until you know whether the user is authenticated. Prevents the "flash of login form" a returning user sees before the token is restored.

### Canonical `app.component.ts`

Edit the file `src/app/app.component.ts` the Angular CLI generated. Add the `FormioAuthService` dependency, subscribe in `ngOnInit`, and navigate with Angular's `Router`. Unsubscribe in `ngOnDestroy` so hot-reload / test teardown does not leak the subscription.

```ts
import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { FormioAuthService } from '@formio/angular/auth';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  standalone: false,
})
export class AppComponent implements OnInit, OnDestroy {
  private subs = new Subscription();

  constructor(public auth: FormioAuthService, private router: Router) {}

  ngOnInit(): void {
    // Event names per https://github.com/formio/angular/wiki/User-Authentication#authentication-events
    this.subs.add(
      this.auth.onLogin.subscribe(() => {
        // Success — leave the login form and go to the app shell.
        this.router.navigate(['/']);
      }),
    );
    this.subs.add(
      this.auth.onRegister.subscribe(() => {
        // Self-register ends with an auto-login → same destination as onLogin.
        this.router.navigate(['/']);
      }),
    );
    this.subs.add(
      this.auth.onLogout.subscribe(() => {
        // Session gone — back to the login form.
        this.router.navigate(['/auth/login']);
      }),
    );
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }
}
```

Notes:

- `standalone: false` matches the `angular-demo` convention. If the workspace was scaffolded standalone, flip this with whatever setting CONFIG / BOOTSTRAP already applied to match the rest of the generated code — consistency with the other modules is what matters.
- `onLogin` fires on interactive logins only. If you want a returning user with a cached JWT to also be redirected on app boot, subscribe to `onUser` instead (or in addition) — `onUser` fires whenever the user object is resolved from the server, covering both paths.
- The target route on login is `'/'` — the app shell. If the user has a specific home/dashboard route (e.g. `/home`, `/dashboard`), use that instead. Do NOT derive it from the user's role here; role-based landing pages are a later concern handled by route guards + per-role redirects inside the Resources sub-skill.
- The target route on logout is `'/auth/login'` — the `@formio/angular/auth` `AuthModule` mounts its login form under the `auth` path via the `AppRoutingModule` edit above, so this matches what the form flow expects.
- Inject `FormioAuthService` as `public` so the template can read `auth.authenticated` / `auth.user` for conditional rendering (nav chrome, "logged in as …" labels) without an extra getter.
- Need to gate something on "auth has finished booting"? `await this.auth.ready` in an async method, or use `.then(...)` on the Promise — it resolves exactly once, after the JWT-restore attempt completes. Wire it into an `APP_INITIALIZER` factory if you need the whole app to wait.

### Skip-if-already-wired detection (for `app.component.ts`)

Before overwriting an existing `app.component.ts`:

1. Read `src/app/app.component.ts`. If it already imports `FormioAuthService` AND calls `.onLogin.subscribe(` AND `.onLogout.subscribe(` AND calls `router.navigate`, the wiring is already in place — skip the edit. Tell the user: "Skipping `app.component.ts` edit — it already subscribes to `FormioAuthService.onLogin` / `onLogout` and navigates on events."
2. If only a subset is present (e.g. `onLogin.subscribe` but no `onLogout.subscribe`, or using the stale `.login` / `.logout` names from older versions of this skill), show a diff and ask whether to merge the missing piece (or rename the stale subscriptions) or leave as-is. Never silently rewrite a file the user has customized.
3. If the file does not yet subscribe at all, apply the template above and cite the wiki link in a one-line comment above the subscriptions so future readers know where the shape came from.

## `src/app/app.component.html` — auth-aware nav chrome (optional but recommended)

**Consult `frontend-design` first — with the Bootstrap 5 brief from BOOTSTRAP Step 7d.** Per the parent skill's Stance, every UI-authoring step in this skill loads Claude's built-in `frontend-design` skill before writing. Prepend the `FRONTEND_DESIGN_BRIEF` that BOOTSTRAP Step 7d stashed — it pins the advice to the Bootstrap 5 + Bootstrap Icons stack already wired into `angular.json`, names the utility classes to reach for, and forbids Tailwind / Material / custom design-token systems that would clash. The nav block below is a starting skeleton that satisfies the auth-wiring requirements (`*ngIf` on `auth.authenticated`, `(click)="auth.logout()"`, `routerLink` to `/auth/login`); the visual-design decisions on top of that — spacing, typography, container width, mobile behavior, active-state styling, brand placement, empty vs. authenticated layouts — should come from `frontend-design`'s Bootstrap-5-briefed guidance, not from memory. Load `frontend-design` with the brief, let it review the skeleton, then apply its recommendations before emitting the final HTML/SCSS.

`FormioAuthService` exposes `authenticated` (boolean) and `user` (submission object) as properties, and `logout()` as a method. Wire them into the root template so the nav bar reacts to login state without any extra plumbing. Typical `app.component.html` addition (keep whatever shell the Angular CLI scaffolded; add this block inside your nav):

```html
<nav class="navbar navbar-expand navbar-light bg-light px-3">
  <a class="navbar-brand" routerLink="/">{{ appName }}</a>
  <ul class="navbar-nav ms-auto">
    <li class="nav-item" *ngIf="!auth.authenticated">
      <a class="nav-link" routerLink="/auth/login" routerLinkActive="active">Sign in</a>
    </li>
    <li class="nav-item" *ngIf="!auth.authenticated">
      <a class="nav-link" routerLink="/auth/register" routerLinkActive="active">Register</a>
    </li>
    <li class="nav-item" *ngIf="auth.authenticated">
      <span class="navbar-text me-2">{{ auth.user?.data?.email }}</span>
    </li>
    <li class="nav-item" *ngIf="auth.authenticated">
      <a class="nav-link" (click)="auth.logout()" style="cursor: pointer">Log out</a>
    </li>
  </ul>
</nav>
<router-outlet></router-outlet>
```

Notes:

- The template talks to `auth` directly because the component injected it as `public` above — no extra bindings, no extra getters.
- `(click)="auth.logout()"` does NOT need to navigate; `FormioAuthService.logout()` clears the JWT and emits `onLogout`, which the `ngOnInit` subscription above catches and routes to `/auth/login`.
- `routerLinkActive="active"` is Bootstrap-friendly because Bootstrap 5's `.nav-link.active` styling is already in the stylesheet BOOTSTRAP installed.

## Customizing the login and register components (optional)

`FormioAuthRoutes()` takes an options object when the default login / register components do not fit the design. Each slot accepts a component class that extends the base component:

```ts
// src/app/auth/auth.module.ts
RouterModule.forChild(
  FormioAuthRoutes({
    login: CustomLoginComponent,       // extends FormioAuthLoginComponent
    register: CustomRegisterComponent, // extends FormioAuthRegisterComponent (same pattern)
    auth: CustomAuthComponent,         // extends FormioAuthComponent — controls the wrapper layout
  }),
),
```

Minimal custom login component — pass the service up to the base class, override the template:

```ts
import { Component } from '@angular/core';
import { FormioAuthLoginComponent, FormioAuthService } from '@formio/angular/auth';

@Component({
  selector: 'app-custom-login',
  templateUrl: './custom-login.component.html',
  standalone: false,
})
export class CustomLoginComponent extends FormioAuthLoginComponent {
  constructor(service: FormioAuthService) {
    super(service);
  }
}
```

The custom register component follows the identical pattern against `FormioAuthRegisterComponent`. Do this only when the default UI truly does not fit — most apps get what they want by styling the default components via CSS against the `form.formio` selector.

## The approval gate — preview then approve

Before writing or editing any files, print a preview that cites the exact values used (pulled from `template.md`, confirmed against `template.json`):

```
Auth values derived from template.md (confirmed against template.json)
  user resource:       <USER_RESOURCE>            (machine name — e.g. 'user')
  login form name:     <LOGIN_FORM_NAME>          (template.json.forms[*].name — NOT used in config)
  login form path:     <LOGIN_FORM_PATH>          (template.json.forms[*].path — GOES INTO config.login.form)
  register form name:  <REGISTER_FORM_NAME>       (template.json.forms[*].name — NOT used in config)
  register form path:  <REGISTER_FORM_PATH>       (template.json.forms[*].path — GOES INTO config.register.form)
  app.appUrl:          <FORMIO_PROJECT_URL>       (same value as FormioAppConfig.appUrl from CONFIG)
  app.apiUrl:          <FORMIO_BASE_URL>          (same value as FormioAppConfig.apiUrl from CONFIG)
  roles:               [<ROLE_1>, <ROLE_2>, ...]

Files to create
  src/app/auth/auth.module.ts  (new file — imports FormioAuthModule + RouterModule.forChild(FormioAuthRoutes()))

Files to edit
  src/app/app.module.ts
    + import { AuthModule } from './auth/auth.module';
    + AuthModule added to @NgModule imports (after FormioModule)
  src/app/app-routing.module.ts
    + add { path: 'auth', loadChildren: () => import('./auth/auth.module').then(m => m.AuthModule) } to Routes
  src/app/app.component.ts
    + import FormioAuthService from '@formio/angular/auth' and Router from '@angular/router'
    + subscribe to auth.onLogin    → router.navigate(['/'])           (post-login redirect)
    + subscribe to auth.onRegister → router.navigate(['/'])           (post-register redirect)
    + subscribe to auth.onLogout   → router.navigate(['/auth/login']) (post-logout redirect)
    + unsubscribe in ngOnDestroy
  src/app/app.component.html
    + auth-aware nav chrome using *ngIf="!auth.authenticated" / *ngIf="auth.authenticated" / (click)="auth.logout()"

Proceed with these writes? (Resources is next — load the nested sub-skill file `./resources/SKILL.md` under this skill.)
```

Wait for explicit approval. If the user declines, stop — do not write partial state, do not delegate to the sub-skill. The parent skill's `## When to reset to an earlier phase` rule applies if the user wants to re-run SETUP or CONFIG with corrections.

## After approval

Write `auth.module.ts` and edit `app.module.ts`. Then tell the user what was written and what the next phase is:

> Wrote `src/app/auth/auth.module.ts` (with `FormioAuthRoutes()` mounted via `RouterModule.forChild`), updated `src/app/app.module.ts`, added the `/auth` lazy-load route to `src/app/app-routing.module.ts`, wired `src/app/app.component.ts` to subscribe to `FormioAuthService.onLogin` / `onRegister` / `onLogout` (redirect to `/` on login/register, to `/auth/login` on logout), and updated `src/app/app.component.html` with auth-aware nav chrome. Loading `./resources/SKILL.md` (the nested Resources sub-skill of this skill) for per-resource NgModule scaffolding.

Hand off to the sub-skill with the context described in the parent `SKILL.md`'s "Handoff contract with the Resources sub-skill (`./resources/SKILL.md`)" section. The sub-skill is a sub-folder of this skill — load that file directly, do NOT attempt to invoke a top-level skill named `formio-angular-resources`.
