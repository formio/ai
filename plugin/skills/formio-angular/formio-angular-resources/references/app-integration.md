# App integration — AppModule, routing, config, auth, styling

> **`FormioAppConfig` renames both URLs.** `appUrl` is the **Project URL** — the project this application reads and writes, and the one value anyone supplies. `apiUrl` is the **Base URL** — the deployment hosting it, which is normally derived from the Project URL rather than supplied. Take both from `project_get` (called with `cwd` set to the workspace root) when the Form.io MCP tools are callable by you, and otherwise ask the user for them — see [`project-urls.md`](../../../formio-mcp-setup/references/project-urls.md). Never compose, derive, or hand-type either one yourself.

**Every path in this document is relative to `workspaceRoot`** — the absolute path the parent skill's Pre-flight captured and SETUP stashed. Read and write them as `<workspaceRoot>/src/app/app-module.ts`, never against wherever the shell happens to stand. Shell working directories persist between commands in an agent session, so a bare relative path can land in a different tree, report that the file is missing, and write a whole resource module into a tree nobody will look in.

Every resource module you generate plugs into a shared foundation. This file is the canonical shape of that foundation, matching the angular-demo's AppModule but trimmed to only what this skill's output needs.

## Contents

1. `AppModule`
2. `AppRoutingModule`
3. `AppConfig` (FormioAppConfig in config.ts; the auth config inline at root)
4. Root component (`App`) and `Home`
5. `AuthModule` and `authGuard`
6. `angular.json` — Bootstrap 5 + Bootstrap Icons
7. Logout route
8. SSO (OIDC / SAML)
9. Minimum `package.json` dependencies
10. Reading an existing workspace (don't overwrite)

---

## 1. `AppModule`

`src/app/app-module.ts`:

```typescript
import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Formio, FormioModule, FormioAppConfig } from '@formio/angular';
import { FormioGrid } from '@formio/angular/grid';
import { FormioAuthService, FormioAuthConfig } from '@formio/angular/auth';
import { FormioResources } from '@formio/angular/resource';

import { AppConfig } from './config';
import { AppRoutingModule } from './app-routing-module';
import { App } from './app'; // legacy naming: `import { AppComponent } from './app.component';`
import { Home } from './home/home'; // legacy naming: `import { HomeComponent } from './home/home.component';`

// 'bi' selects Bootstrap Icons — the icon set BOOTSTRAP installs and loads via
// angular.json. Use 'fontawesome' ONLY in a workspace that actually loads a
// FontAwesome stylesheet; the renderer emits fa-* classes for it either way, so a
// mismatch renders every renderer icon as blank space.
(Formio as any).icons = 'bi';

@NgModule({
  declarations: [App, Home],
  imports: [BrowserModule, CommonModule, FormioModule, FormioGrid, AppRoutingModule],
  providers: [
    // provideZonelessChangeDetection() is added by BOOTSTRAP (see BOOTSTRAP.md Step 6).
    FormioAuthService,
    FormioResources,
    { provide: FormioAppConfig, useValue: AppConfig },
    {
      provide: FormioAuthConfig,
      useValue: { login: { form: 'user/login' }, register: { form: 'user/register' } },
    },
  ],
  bootstrap: [App],
})
export class AppModule {}
```

The heavy lifting: `FormioAppConfig` carries `appUrl` (project URL) — every `FormioResourceService` reads it at init time, and `FormioModule` configures the SDK (`Formio.setBaseUrl`/`setProjectUrl`) from it in its constructor at bootstrap, so the plain `useValue` provider is sufficient. `FormioResources` (plural!) is the registry every nested resource module looks up its parents through. `FormioAuthService` is what makes `currentUser` available as an object-parent to any resource that wants to auto-fill a user field.

If the user has an existing AppModule, **merge** these declarations/imports/providers rather than overwriting. See section 10.

## 2. `AppRoutingModule`

`src/app/app-routing-module.ts`:

```typescript
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { Home } from './home/home'; // legacy naming: `import { HomeComponent } from './home/home.component';`
import { authGuard } from './auth/auth.guard';

const routes: Routes = [
  { path: '', component: Home },
  {
    path: 'auth',
    // NO guard — login / register must be reachable while anonymous.
    loadChildren: () => import('./auth/auth.module').then(m => m.AuthModule)
  },
  // One entry per browsable resource module. Authenticated resources (anonymous = `—`
  // in the Access Matrix) MUST carry canActivate: [authGuard] — without it an anonymous
  // visitor navigates straight in, the load 401/403s, and the page renders broken/empty.
  {
    path: '<kebab>',
    canActivate: [authGuard],
    loadChildren: () =>
      import('./<kebab>/<kebab>.module').then(m => m.<Pascal>Module)
  }
  // ...
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { useHash: true })],
  exports: [RouterModule]
})
export class AppRoutingModule {}
```

Why `useHash: true`? Matches the angular-demo and sidesteps server-rewrite config for the common "just deploy to a static host" case. Swap to path-based routing only if the user asks.

### `authGuard` — the authentication guard (required for protected routes)

`authGuard` is produced by the parent skill's AUTH phase at `src/app/auth/auth.guard.ts` (a functional `CanActivateFn` that awaits `FormioAuthService.ready`, then returns `true` if `auth.authenticated` else a `UrlTree` to `/auth/login`). See the parent `AUTH.md` → "`src/app/auth/auth.guard.ts`" for the file body. This sub-skill's job is to attach `canActivate: [authGuard]` to every resource route the Access Matrix marks unreachable by `anonymous`. If you are generating a routing module in a workspace where AUTH was skipped and no `auth.guard.ts` exists, flag the gap (the route is unprotected) rather than silently omitting the guard.

**Authentication vs. authorization — do not conflate them.** The guard enforces _authentication_ only (is anyone logged in). It does NOT enforce _authorization_ (which role / group) — that stays server-side and is allowed to 403. So: a group-access resource (e.g. Task gated by ProjectUser membership) STILL gets `canActivate: [authGuard]` because anonymous users have no access at all; the per-group narrowing is left to the backend. "Server enforces access" justifies skipping a role/group guard, never the authentication guard.

## 3. `AppConfig` — and where the auth config actually lives

**`src/app/config.ts` holds `AppConfig` and nothing else** — the SAME file the parent skill's CONFIG phase generates (see parent `CONFIG.md`), which writes it exactly and permits no extras. Do NOT name it `app.config.ts`: that name is reserved by Angular standalone convention for `ApplicationConfig`, and the parent's SETUP/CONFIG phases read `src/app/config.ts`.

```typescript
import { FormioAppConfig } from '@formio/angular';

export const AppConfig: FormioAppConfig = {
  appUrl: '{projectUrl}', // Project URL — from `project_get`, never hand-typed
  apiUrl: '{baseUrl}', // Base URL — the deployment; from `project_get`, never hand-typed
};
```

**The auth config is an inline `useValue` in `app-module.ts`'s root `providers`,** written by the parent's AUTH phase — not an export from `config.ts` and not an export from `auth/auth.module.ts`:

```typescript
{ provide: FormioAuthConfig, useValue: { login: { form: 'user/login' }, register: { form: 'user/register' } } },
FormioAuthService,
```

This sub-skill does not write either one. Verify they are present and move on; if the auth providers are missing, that is the parent's AUTH phase to run.

**Do not import `AuthModule` into `AppModule`, and do not add it to any `imports` array.** It belongs exactly once, as the `loadChildren` target of the `/auth` route. `FormioAuth` declares no providers and no exports, so importing it gains nothing, while its `RouterModule.forChild(FormioAuthRoutes())` would contribute a second root-level `path: ''` route and make the lazy chunk eager. Both shipped Form.io applications (`formmanager`, `pro.formview.io`) wire it the lazy-only way. The parent's `AUTH.md` has the full reasoning under "Why `AuthModule` is NOT in `AppModule.imports`".

## 4. Root component (`App`) and `Home`

`src/app/app.ts` (legacy naming: `src/app/app.component.ts`, class `AppComponent`):

```typescript
import { Component } from '@angular/core';
import { FormioAuthService } from '@formio/angular/auth';

@Component({
  selector: 'app-root',
  templateUrl: './app.html', // legacy naming: './app.component.html'
  styleUrl: './app.scss', // match the workspace's stylesheet extension — './app.css' on a CSS workspace; legacy naming: styleUrls: ['./app.component.scss']
  standalone: false,
})
export class App {
  constructor(public auth: FormioAuthService) {}
}
```

Match whatever `ng new` actually emitted in this workspace — Angular 20+ generates `app.ts` / `app.html` plus a component stylesheet with class `App` and singular `styleUrl`; older workspaces use the `app.component.*` / `AppComponent` / `styleUrls` set. The stylesheet extension is NOT fixed: the CLI emits `app.css` unless the workspace was scaffolded with `--style=scss` (BOOTSTRAP leaves that choice to `angular-new-app`'s interview), so read the extension off the file on disk rather than copying `.scss` from this snippet — pointing `styleUrl` at a file that does not exist fails the build. Do not rename existing files to match this doc.

### The app shell template — owned by AUTH, not by this file

The shell template (`src/app/app.html`, legacy `src/app/app.component.html`) is specified in ONE place: the parent skill's `AUTH.md`, in its shell-template section and its "Page layout contract" subsection. Read it there. It carries the navbar skeleton, the auth-state conditionals, and — load-bearing — the **page layout contract**: the shell wraps `<router-outlet>` in a single page-layout element that owns the app's horizontal gutters, max content width, and top spacing, because most routed surfaces are library components (`FormioResourceCreate/Edit/Delete/Index`, `FormioAuthLogin/Register`) that generated code cannot wrap.

By the time this file is consulted the shell already exists. Two edits belong here, and nothing else:

- Add one `<li class="nav-item"><a class="nav-link" routerLink="/<kebab>"><Resource></a></li>` per browsable resource to the navbar's left-hand `<ul class="navbar-nav me-auto">` — the empty insertion point AUTH.md's shell skeleton leaves for exactly this. If the shell has no left-hand `<ul>` (a hand-written navbar, or one from a different design language), add one before the auth-state list rather than appending resource links into it.
- Verify the page-layout wrapper around `<router-outlet>` is present. If it is missing, add it per AUTH.md's contract — do not compensate with per-page wrappers inside the resource templates.

`src/app/home/home.ts` (legacy naming: `src/app/home/home.component.ts`, class `HomeComponent`):

```typescript
import { Component } from '@angular/core';

@Component({
  selector: 'app-home',
  templateUrl: './home.html', // legacy naming: './home.component.html'
  styleUrl: './home.css', // match the workspace's stylesheet extension; legacy naming: styleUrls: ['./home.component.scss']
  standalone: false,
})
export class Home {
  // Interpolated by the template below. Under `strictTemplates` (the `ng new` default)
  // every property a template reads must be declared, or the build fails with NG9.
  appName = '<application name>';
}
```

`src/app/home/home.html` (legacy `home.component.html`) — keep it terse; one card per browsable resource:

```html
<h1>{{ appName }}</h1>
<div class="row">
  <!-- one <div class="col-md-4"> per browsable resource -->
  <div class="col-md-4">
    <div class="card">
      <div class="card-body">
        <h5 class="card-title"><Resource></h5>
        <a routerLink="/<kebab>" class="btn btn-primary">Open</a>
      </div>
    </div>
  </div>
</div>
```

## 5. `AuthModule` and `authGuard`

`src/app/auth/auth.guard.ts` — the authentication guard wired onto protected routes in section 2. Generate it alongside `AuthModule`:

```typescript
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { FormioAuthService } from '@formio/angular/auth';

// Blocks protected routes for anonymous visitors. Awaits the cached-JWT restore
// (auth.ready) so a returning, still-authenticated user is not bounced on a cold
// deep-link, then redirects anyone unauthenticated to the login form.
export const authGuard: CanActivateFn = async () => {
  const auth = inject(FormioAuthService);
  const router = inject(Router);

  await auth.ready;

  return auth.authenticated ? true : router.createUrlTree(['/auth/login']);
};
```

`src/app/auth/auth.module.ts`:

```typescript
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormioModule } from '@formio/angular';
import { FormioAuth } from '@formio/angular/auth';
import { LogoutComponent } from './logout.component';

@NgModule({
  imports: [
    CommonModule,
    FormioModule,
    FormioAuth,
    RouterModule.forChild([
      { path: '', redirectTo: 'login', pathMatch: 'full' },
      { path: 'logout', component: LogoutComponent },
      // '/login' and '/register' are contributed by FormioAuth's own route config
    ]),
  ],
  declarations: [LogoutComponent],
})
export class AuthModule {}
```

`FormioAuth` (module from `@formio/angular/auth`) contributes the `login` and `register` routes automatically; they are wired to the form paths in the root `FormioAuthConfig` provider. Note this module is reached only through the `/auth` `loadChildren` route — it is never added to an `imports` array.

`src/app/auth/logout.component.ts`:

```typescript
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { FormioAuthService } from '@formio/angular/auth';

@Component({
  selector: 'app-logout',
  template: '<p>Logging out…</p>',
  standalone: false,
})
export class LogoutComponent implements OnInit {
  constructor(
    private auth: FormioAuthService,
    private router: Router
  ) {}
  ngOnInit() {
    this.auth.logout();
    this.router.navigate(['/auth/login']);
  }
}
```

## 6. `angular.json` — Bootstrap 5 + Bootstrap Icons

For a new workspace or when the user opts in to Bootstrap 5:

```jsonc
// angular.json → projects.<app>.architect.build.options
"styles": [
  "node_modules/bootstrap/dist/css/bootstrap.min.css",
  "node_modules/bootstrap-icons/font/bootstrap-icons.css",
  "src/styles.css"
],
"scripts": []
```

Required install — shown for npm; run it with the workspace's own package manager (`packageManager` field or lockfile: `yarn.lock` → Yarn, `pnpm-lock.yaml` → pnpm, `bun.lockb` → Bun) so no second lockfile is written (see `../../BOOTSTRAP.md`, "Which package manager this workspace uses"):

```bash
npm install @formio/angular @formio/js bootstrap bootstrap-icons
```

On an orchestrated run BOOTSTRAP already wrote these entries (see `BOOTSTRAP.md` Step 5) — verify them rather than re-adding, and match `src/styles.css` to whatever extension the workspace actually uses.

If the user picked **unstyled HTML** for the design language, omit the bootstrap/bootstrap-icons lines, drop the `(Formio as any).icons` assignment from section 1, and generate plain HTML (no `nav-tabs` in the resource template, no card markup in the home template). If they picked Tailwind, Angular Material, or the workspace's existing design system, install that language's packages instead of bootstrap/bootstrap-icons and use its vocabulary in the templates. Two things survive every one of those choices: the shell's page-layout wrapper, and re-expressing that wrapper plus the navbar container in the newly-selected language when the answer differs from what BOOTSTRAP installed — swapping the stylesheet out from under Bootstrap classes leaves the app with no gutters at all.

## 7. Logout route

Already covered in section 5. Do not duplicate `FormioAuthService.logout()` logic across the app — there's one component in `AuthModule` and every navbar hits it.

## 8. SSO (OIDC / SAML)

When the Resource Map says `SSO: OIDC` or `SSO: SAML`, skip the native-form login and link `/auth/login` to the project's SSO redirect URL instead. The Form.io project configures the IdP; the Angular app just points the user at it.

Replace the Login button in the shell template (`src/app/app.html`, legacy `src/app/app.component.html`):

```html
<li class="nav-item" *ngIf="!auth.authenticated">
  <a class="nav-link" [href]="ssoLoginUrl">Login</a>
</li>
```

With:

```typescript
ssoLoginUrl = `${AppConfig.appUrl}/oauth2/login/<providerKey>`;
```

See `formio-api/references/platform-auth` for the exact IdP endpoint shape.

## 9. Minimum `package.json` dependencies

Ensure these four are in `dependencies`:

```json
"@formio/angular": "^<FORMIO_ANGULAR_VERSION>",
"@formio/js":      "^<compatible>",
"bootstrap":       "^5.3.0",
"bootstrap-icons": "^1.11.0"
```

Do not pin versions inside the skill — the user's Angular version dictates the compatible `@formio/angular` major. Look up latest at <https://www.npmjs.com/package/@formio/angular> or rely on `npm install` to resolve.

## 10. Reading an existing workspace — don't overwrite

When mode is "existing workspace," before writing `app-module.ts` / `app-routing-module.ts`:

1. Read the existing file.
2. Merge: add new `import` lines, add new entries to `imports: [...]`, `declarations: [...]`, `providers: [...]`, `routes: [...]`. Leave untouched everything you didn't add.
3. If the file declares `FormioAppConfig` / `FormioResources` / `FormioAuthService` already, do NOT re-declare. Verify the existing `appUrl` matches what `project_get` reported for this workspace — if not, that is the split-brain the sub-skill's handoff-mode check covers: stop and ask which is correct, naming both pairs and where each came from. Do not ask the user to re-supply a URL; the report already carries it.
4. Same for `angular.json` styles — append, don't replace.
5. Read the shell template (`src/app/app.html`, legacy `app.component.html`). If `<router-outlet>` is not inside a page-layout element that supplies horizontal gutters and a max content width, add one per the parent skill's `AUTH.md` → "Page layout contract" — it is the only thing that pads the library-rendered routes. Report it in the Phase A plan as a shell modification.

In the Phase A plan, be explicit about which existing files will be modified and what will be added to each. The user should be able to read the plan and know exactly what the diff will look like before you touch their code.
