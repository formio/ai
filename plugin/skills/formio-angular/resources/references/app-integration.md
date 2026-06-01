# App integration — AppModule, routing, config, auth, styling

Every resource module you generate plugs into a shared foundation. This file is the canonical shape of that foundation, matching the angular-demo's AppModule but trimmed to only what this skill's output needs.

## Contents

1. `AppModule`
2. `AppRoutingModule`
3. `AppConfig` (FormioAppConfig + FormioAuthConfig)
4. `AppComponent` and `HomeComponent`
5. `AuthModule`
6. `angular.json` — Bootstrap 5 + FontAwesome
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

import { AppConfig, AuthConfig } from './app.config';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { HomeComponent } from './home/home.component';

(Formio as any).icons = 'fontawesome';

@NgModule({
  declarations: [AppComponent, HomeComponent],
  imports: [BrowserModule, CommonModule, FormioModule, FormioGrid, AppRoutingModule],
  providers: [
    FormioAuthService,
    FormioResources,
    { provide: FormioAppConfig, useValue: AppConfig },
    { provide: FormioAuthConfig, useValue: AuthConfig },
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
```

Three provider lines are doing the heavy lifting. `FormioResources` (plural!) is the registry every nested resource module looks up its parents through. `FormioAuthService` is what makes `currentUser` available as an object-parent to any resource that wants to auto-fill a user field. `FormioAppConfig` carries `appUrl` (project URL) — every `FormioResourceService` reads it at init time.

If the user has an existing AppModule, **merge** these declarations/imports/providers rather than overwriting. See section 10.

## 2. `AppRoutingModule`

`src/app/app-routing-module.ts`:

```typescript
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { HomeComponent } from './home/home.component';

const routes: Routes = [
  { path: '', component: HomeComponent },
  {
    path: 'auth',
    loadChildren: () => import('./auth/auth.module').then(m => m.AuthModule)
  },
  // One entry per browsable resource module:
  {
    path: '<kebab>',
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

## 3. `AppConfig` — `FormioAppConfig` + `FormioAuthConfig`

`src/app/app.config.ts`:

```typescript
import { FormioAppConfig } from '@formio/angular';
import { FormioAuthConfig } from '@formio/angular/auth';

export const AppConfig: FormioAppConfig = {
  appUrl: 'YOUR_FORMIO_PROJECT_URL', // e.g. https://myproject.form.io
  apiUrl: 'YOUR_FORMIO_BASE_URL', // e.g. https://api.form.io — usually the hosted API
};

export const AuthConfig: FormioAuthConfig = {
  login: { form: 'userLogin' },
  register: { form: 'userRegister' },
};
```

Swap `userLogin` / `userRegister` for whatever the Resource Map called them. If the map said `admin` or a custom form, use that name here.

**`appUrl` vs `apiUrl`:**

- `appUrl` = project URL = `FORMIO_PROJECT_URL`. This is what `FormioResourceService` calls to load forms and submissions. It is the value every `form_*` MCP tool uses and every `formio-api/references/project-*` / `formio-api/references/runtime-*` skill means by "project URL."
- `apiUrl` = base URL = `FORMIO_BASE_URL`. Used for cross-project concerns (team / project / tenant management). For a single-project Angular app, `apiUrl` is usually the same `https://api.form.io` or a self-hosted platform root.

## 4. `AppComponent` and `HomeComponent`

`src/app/app.component.ts`:

```typescript
import { Component } from '@angular/core';
import { FormioAuthService } from '@formio/angular/auth';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  standalone: false,
})
export class AppComponent {
  constructor(public auth: FormioAuthService) {}
}
```

`src/app/app.component.html`:

```html
<nav class="navbar navbar-expand-lg navbar-light bg-light">
  <div class="container-fluid">
    <a class="navbar-brand" routerLink="/">{{ appTitle }}</a>
    <ul class="navbar-nav me-auto">
      <!-- one <li> per browsable resource: -->
      <li class="nav-item"><a class="nav-link" routerLink="/<kebab>"><Resource></a></li>
    </ul>
    <ul class="navbar-nav">
      <li class="nav-item" *ngIf="!auth.authenticated">
        <a class="nav-link" routerLink="/auth/login">Login</a>
      </li>
      <li class="nav-item" *ngIf="!auth.authenticated">
        <a class="nav-link" routerLink="/auth/register">Register</a>
      </li>
      <li class="nav-item" *ngIf="auth.authenticated">
        <a class="nav-link" (click)="auth.logout()" style="cursor: pointer;">Logout</a>
      </li>
    </ul>
  </div>
</nav>
<div class="container" style="margin-top: 20px;">
  <router-outlet></router-outlet>
</div>
```

`src/app/home/home.component.ts`:

```typescript
import { Component } from '@angular/core';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
  standalone: false,
})
export class HomeComponent {}
```

`src/app/home/home.component.html` — keep it terse; one card per browsable resource:

```html
<h1>{{ appTitle }}</h1>
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

## 5. `AuthModule`

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

`FormioAuth` (module from `@formio/angular/auth`) contributes the `login` and `register` routes automatically; they are wired to the form names in `FormioAuthConfig`.

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

## 6. `angular.json` — Bootstrap 5 + FontAwesome

For a new workspace or when the user opts in to Bootstrap 5:

```jsonc
// angular.json → projects.<app>.architect.build.options
"styles": [
  "node_modules/bootstrap/dist/css/bootstrap.min.css",
  "node_modules/font-awesome/css/font-awesome.min.css",
  "src/styles.scss"
],
"scripts": []
```

Required `npm install`:

```bash
npm install @formio/angular @formio/js bootstrap font-awesome
```

If the user picked "none" for UI framework, omit the bootstrap/font-awesome lines and generate plain HTML (no `nav-tabs` in `resource.component.html`, no card markup in `home.component.html`).

## 7. Logout route

Already covered in section 5. Do not duplicate `FormioAuthService.logout()` logic across the app — there's one component in `AuthModule` and every navbar hits it.

## 8. SSO (OIDC / SAML)

When the Resource Map says `SSO: OIDC` or `SSO: SAML`, skip the native-form login and link `/auth/login` to the project's SSO redirect URL instead. The Form.io project configures the IdP; the Angular app just points the user at it.

Replace the Login button in `app.component.html`:

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
"@formio/angular": "^<latest-5.x>",
"@formio/js":      "^<compatible>",
"bootstrap":       "^5.3.0",
"font-awesome":    "^4.7.0"
```

Do not pin versions inside the skill — the user's Angular version dictates the compatible `@formio/angular` major. Look up latest at <https://www.npmjs.com/package/@formio/angular> or rely on `npm install` to resolve.

## 10. Reading an existing workspace — don't overwrite

When mode is "existing workspace," before writing `app-module.ts` / `app-routing-module.ts`:

1. Read the existing file.
2. Merge: add new `import` lines, add new entries to `imports: [...]`, `declarations: [...]`, `providers: [...]`, `routes: [...]`. Leave untouched everything you didn't add.
3. If the file declares `FormioAppConfig` / `FormioResources` / `FormioAuthService` already, do NOT re-declare. Verify the existing `appUrl` matches what the user gave — if not, flag a conflict and ask.
4. Same for `angular.json` styles — append, don't replace.

In the Phase A plan, be explicit about which existing files will be modified and what will be added to each. The user should be able to read the plan and know exactly what the diff will look like before you touch their code.
