# Resource module patterns

> **`FormioAppConfig` renames both URLs.** `appUrl` is the **Project URL** — the project this application reads and writes, and the one value anyone supplies. `apiUrl` is the **Base URL** — the deployment hosting it, which is normally derived from the Project URL rather than supplied. Take both from `npx -y @formio/mcp@0.10.0 project get --cwd "<workspace root>"`; never compose, derive, or hand-type either one yourself.

Every pattern you generate in Phase B. Copy the shape, swap the names, don't invent new structure — `FormioResourceService` is picky about `FormioResourceConfig` and the route tree that `FormioResourceRoutes()` produces.

## The design contract

**Every resource module in this skill overrides both the `ResourceComponent` (navigation chrome) AND the `ViewComponent` (read-only detail page) with designed templates.** Bare `FormioResourceRoutes()` with no options is not acceptable output — it means the user gets `@formio/angular`'s default "render the form read-only" chrome, which is the generic CRUD fallback this skill exists to avoid. If you are ever tempted to skip the override pair, stop and re-read "Designing the ViewComponent from the resource's fields" at the bottom of this file.

## The primitives you import

You do not re-implement these; you import them from `@formio/angular/resource`.

### Route shape from `FormioResourceRoutes()`

`FormioResourceRoutes()` returns:

```
[
  { path: '',    component: FormioResourceIndexComponent  },   // [0] list
  { path: 'new', component: FormioResourceCreateComponent },   // [1] create
  { path: ':id', component: FormioResourceComponent, children: [
      { path: '',     redirectTo: 'view', pathMatch: 'full' },
      { path: 'view',   component: FormioResourceViewComponent   },
      { path: 'edit',   component: FormioResourceEditComponent   },
      { path: 'delete', component: FormioResourceDeleteComponent }
    ]
  }                                                            // [2] item
]
```

`routes[2].children` is where you push nested resource routes (children, N:N joins, etc.) — see sections 3–5 below for exact code.

### `FormioResourceConfig` shape

```typescript
{
  name:    string;               // the resource's key in FormioResources registry — property-style camelCase
  form:    string;               // MUST equal the form's `path` in template.json — usually kebab-case
  parents?: Array<string | { field: string; resource: string; filter?: boolean }>;
}
```

- Plain-string parent (`parents: ['event']`) tells `FormioResourceService.loadParents()` to find a select component whose `key === 'event'` and auto-fill it with the parent submission.
- Object parent (`{ field: 'user', resource: 'currentUser', filter: false }`) is used by `@formio/angular/auth`'s `currentUser` resource to pre-fill a `user` field with the logged-in user without using it as a list filter.

## Contents

1. Simple resource (always with designed overrides)
2. The override pair — what `resource.component` and `view/view.component` look like
3. Parent resource with a 1:N nested child
4. 1:N nested child module
5. N:N join — both sides mounted under their opposite parent, each with its own designed index grid
6. Current-user parent (`{field: 'user', resource: 'currentUser', filter: false}`)
7. Static (AOT-safe) routes — when dynamic `routes[2].children.push()` fails under strict AOT
8. Extending `FormioResourceIndexComponent` to customize the grid
9. Designing the ViewComponent from the resource's fields (recipes by field-shape)

---

## 1. Simple resource (always with designed overrides)

Even the simplest resource in the map — no parents, no nested children — still gets a custom `ResourceComponent` + `ViewComponent` pair. The routing shape is minimal; the UI design is where you earn your keep.

`src/app/<resource>/<resource>.module.ts`:

```typescript
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormioModule } from '@formio/angular';
import {
  FormioResource,
  FormioResourceRoutes,
  FormioResourceConfig,
  FormioResourceService
} from '@formio/angular/resource';
import { ResourceComponent } from './resource.component';
import { ViewComponent } from './view/view.component';

@NgModule({
  imports: [
    CommonModule,
    FormioModule,
    FormioResource,
    RouterModule.forChild(FormioResourceRoutes({
      resource: ResourceComponent,
      view: ViewComponent
    }))
  ],
  declarations: [ResourceComponent, ViewComponent],
  providers: [
    FormioResourceService,
    {
      provide: FormioResourceConfig,
      useValue: {
        name: '<camelCaseResourceName>',            // e.g. 'teamUser' — camelCase registry key
        form: '<template.json.<form>.path verbatim>' // e.g. 'team-user' — MUST equal template.json's form.path
      }
    }
  ]
})
export class <Pascal>Module {}
```

Mount from `AppRoutingModule`:

```typescript
{
  path: '<kebab-case-path>',
  loadChildren: () =>
    import('./<kebab>/<kebab>.module').then(m => m.<Pascal>Module)
}
```

Note `FormioResourceRoutes({ resource, view })` — never `FormioResourceRoutes()` with no options.

### `name` vs. `form` — DO NOT conflate these two

This trips up every first pass on multi-word resources (`Team User`, `Line Item`, `Account Contact`, etc.). The two fields serve different layers and almost always have different casing:

- **`name`** is an in-memory registry key used by the Angular side only. It is the symbol every child/join module references when it declares `parents: ['teamUser']`, and it is how `FormioResources` distinguishes sibling modules (e.g., a bidirectional join has two sibling modules with distinct `name` values — `teamUsers` vs `userTeams` — pointing at the same form). Because it flows through TypeScript identifiers and is consumed as a JS property, it is **camelCase** derived from the resource's display name: `Team User` → `teamUser`, `Line Item` → `lineItem`, `Account Contact` → `accountContact`.

- **`form`** is a URL-path segment. `FormioResourceService` concatenates `appUrl + '/' + config.form` to build every REST call (`/teamUser/submission`, `/teamUser/submission/:id`, etc.). It therefore MUST equal the `path` property of the corresponding form inside `template.json` — no exceptions, no heuristics, no casing transforms. Form.io's project-import step creates each resource's form at exactly the `path` recorded in `template.json`; if the `form` value you write into `FormioResourceConfig` does not match that `path` byte-for-byte, every request 404s and the CRUD surface is dead on arrival.

  The planner emits `path` in **kebab-case by default** (`team-user`, `line-item`, `account-contact`), so on multi-word resources the two fields diverge — `name` is camelCase, `form` is kebab-case, and that is correct. Copy the `path` value from `template.json` verbatim; do NOT derive `form` from `name` by lowercasing or inserting hyphens, because single-word resources where the planner chose a non-obvious path will silently break.

**How to populate both in Phase B.** For every module you generate, read the corresponding resource's form out of `template.json` (look under `template.json.resources` or `template.json.forms` for the entry whose `name` or `machineName` matches the resource in the plan) and copy its `path` string into the `form` field. Derive `name` from the plan's resource display name via camelCase. If the planner's artifact pair is missing the resource's `path`, stop and surface the gap — do not guess.

**Worked example — `Team User` resource, whose `template.json` form entry is `{ name: 'teamUser', path: 'team-user', ... }`:**

```ts
providers: [
  FormioResourceService,
  {
    provide: FormioResourceConfig,
    useValue: {
      name: 'teamUser', // camelCase registry key, consumed by parents: ['teamUser']
      form: 'team-user', // MUST equal template.json form's `path` — the URL segment
    },
  },
];
```

**Worked example — single-word `Event` resource, whose `template.json` form entry is `{ name: 'event', path: 'event', ... }`:** `name` and `form` happen to coincide, but that is because `path` and camelCase both collapse to `event` for a single lowercase word — NOT because they are computed from each other. Still copy `form` from `template.json.path`.

**Phase-B self-check.** Before writing each resource module, quickly verify `providers[].useValue.form === template.json.<form-entry>.path`. Phase-A plan output should call out the (`name`, `form`) pair per resource in the route map block so the user can sanity-check the divergence before any file is written, especially on multi-word resources and on bidirectional joins where two sibling modules both have to pin `form` to the same `path`.

The next section is the resource-component and view-component bodies that make this override pair do actual design work.

## 2. The override pair — `resource.component` + `view/view.component`

Two components per resource, every resource. The `ResourceComponent` is the navigation chrome that wraps the `:id/*` child routes (view, edit, delete, and any nested children). The `ViewComponent` is the read-only detail page and is the biggest design surface in the skill — it's where the resource stops feeling like a form and starts feeling like its own thing (Event, Project, Account, etc.).

### 2a. `resource.component.ts` — always this shape

```typescript
import { Component } from '@angular/core';
import { FormioResourceComponent } from '@formio/angular/resource';

@Component({
  selector: 'app-<kebab>-resource',
  templateUrl: './resource.component.html',
  styleUrls: ['./resource.component.scss'],
  standalone: false,
})
export class ResourceComponent extends FormioResourceComponent {}
```

### 2b. `resource.component.html` — the navigation chrome

Pick ONE of the three shapes below based on the resource's nested-children count:

**Shape A — Tabbed (recommended default, matches angular-demo):**

```html
<ul class="nav nav-tabs mb-3">
  <li class="nav-item">
    <a class="nav-link" routerLink="../"><i class="fa fa-chevron-left"></i> Back</a>
  </li>
  <li class="nav-item">
    <a class="nav-link" routerLink="view" routerLinkActive="active">Details</a>
  </li>
  <!-- One <li> per nested child route — include the same label used in the Phase A plan: -->
  <li class="nav-item">
    <a class="nav-link" routerLink="<childPath>" routerLinkActive="active">
      <i class="fa fa-<icon>"></i> <ChildLabel>
    </a>
  </li>
  <li class="nav-item ms-auto">
    <a class="nav-link" routerLink="edit" routerLinkActive="active"><i class="fa fa-pencil"></i> Edit</a>
  </li>
  <li class="nav-item">
    <a class="nav-link text-danger" routerLink="delete" routerLinkActive="active"><i class="fa fa-trash"></i></a>
  </li>
</ul>
<router-outlet></router-outlet>
```

**Shape B — Breadcrumb + actions (simpler resources with zero or one nested child):**

```html
<nav aria-label="breadcrumb" class="mb-3">
  <ol class="breadcrumb">
    <li class="breadcrumb-item"><a routerLink="../..">{{ '<PluralLabel>' }}</a></li>
    <li class="breadcrumb-item active" aria-current="page">
      {{ service.resource?.data?.<summaryField> || 'Loading…' }}
    </li>
  </ol>
  <div class="btn-group btn-group-sm">
    <a class="btn btn-outline-primary" routerLink="view" routerLinkActive="active">View</a>
    <a class="btn btn-outline-secondary" routerLink="edit" routerLinkActive="active">Edit</a>
    <a class="btn btn-outline-danger" routerLink="delete" routerLinkActive="active">Delete</a>
  </div>
</nav>
<router-outlet></router-outlet>
```

**Shape C — Sidebar + content (data-heavy resources with 3+ nested children):**

```html
<div class="row">
  <div class="col-md-3">
    <div class="list-group">
      <a class="list-group-item" routerLink="view" routerLinkActive="active">Details</a>
      <!-- one entry per nested child -->
      <a class="list-group-item" routerLink="<childPath>" routerLinkActive="active"><ChildLabel></a>
      <a class="list-group-item text-muted" routerLink="edit" routerLinkActive="active">Edit</a>
      <a class="list-group-item text-danger" routerLink="delete" routerLinkActive="active">Delete</a>
    </div>
  </div>
  <div class="col-md-9">
    <router-outlet></router-outlet>
  </div>
</div>
```

Pick the shape in Phase A; mention which one in the plan so the user can redirect before you write files. Count nested children from the Resource Map; if in doubt, go Shape A.

### 2c. `view/view.component.ts` — always this shape

```typescript
import { Component } from '@angular/core';
import { FormioResourceViewComponent } from '@formio/angular/resource';

@Component({
  selector: 'app-<kebab>-view',
  templateUrl: './view.component.html',
  styleUrls: ['./view.component.scss'],
  standalone: false,
})
export class ViewComponent extends FormioResourceViewComponent {}
```

### 2d. `view/view.component.html` — THE design decision

**Do NOT ship this as the fallback:**

```html
<!-- ANTI-PATTERN — do not emit this as the ViewComponent template -->
<formio
  *ngIf="service.form && service.resource"
  [form]="service.form"
  [submission]="service.resource"
  [readOnly]="true"
>
</formio>
```

That's equivalent to using the bare `FormioResourceViewComponent` and defeats the purpose of overriding. Only use a whole-form read-only render when the user has explicitly said "just show the form" — and even then, flag it in Phase A.

**Instead, design from the resource's fields.** The base `FormioResourceViewComponent` exposes `service.resource?.data` — that's your input, keyed by field `key` from the form JSON. Every field becomes a lookup like `service.resource?.data?.<fieldKey>`. Wrap the important ones in a Bootstrap card layout. See section 9 for the field-shape recipes; here's the example shape you use most often:

```html
<div class="row g-3">
  <div class="col-md-8">
    <div class="card">
      <div class="card-body">
        <h3 class="card-title mb-2">{{ service.resource?.data?.<titleField> }}</h3>
        <p class="text-muted" *ngIf="service.resource?.data?.<descriptionField>">
          {{ service.resource?.data?.<descriptionField> }}
        </p>
        <!-- one <dl> entry per additional scalar field worth showing -->
        <dl class="row small mb-0">
          <dt class="col-sm-3"><FieldLabel></dt>
          <dd class="col-sm-9">{{ service.resource?.data?.<fieldKey> }}</dd>
        </dl>
      </div>
    </div>
  </div>
  <div class="col-md-4">
    <div class="card">
      <div class="card-header">Actions</div>
      <div class="card-body d-flex flex-column gap-2">
        <!-- one <a> per nested child the resource has -->
        <a [routerLink]="['../<childPath>']" class="btn btn-outline-primary"><ChildLabel></a>
        <a [routerLink]="['../<childPath>/new']" class="btn btn-primary">+ New <ChildSingular></a>
      </div>
    </div>
  </div>
</div>
```

### 2e. `*.scss` — empty is fine

Both `resource.component.scss` and `view/view.component.scss` can be empty files unless you have resource-specific overrides. Do not copy-paste global styles into them.

## 3. Parent resource with a 1:N nested child

This is how `Event → Participant` works in the angular-demo. The child lives under `<parent>/:id/<child>`.

`src/app/<parent>/<parent>.module.ts`:

```typescript
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormioModule } from '@formio/angular';
import {
  FormioResource,
  FormioResourceRoutes,
  FormioResourceConfig,
  FormioResourceService
} from '@formio/angular/resource';
import { ResourceComponent } from './resource.component';
import { ViewComponent } from './view/view.component';

const <parent>Routes = FormioResourceRoutes({
  resource: ResourceComponent,
  view: ViewComponent
});

// Push nested children onto the `:id` route's children array.
<parent>Routes[2].children.push({
  path: '<child>',
  loadChildren: () =>
    import('./<child>/<child>.module').then(m => m.<Child>Module)
});

@NgModule({
  imports: [
    CommonModule,
    FormioModule,
    FormioResource,
    RouterModule.forChild(<parent>Routes)
  ],
  declarations: [ResourceComponent, ViewComponent],
  providers: [
    FormioResourceService,
    {
      provide: FormioResourceConfig,
      useValue: {
        name: '<camelCaseParentName>',                  // e.g. 'event', 'teamUser'
        form: '<template.json parent form.path verbatim>' // usually kebab-case; NEVER derive from name
      }
    }
  ]
})
export class <Parent>Module {}
```

The tabs in `resource.component.html` should include a link to the child route (see Pattern 2 above).

## 4. 1:N nested child module

`src/app/<parent>/<child>/<child>.module.ts`:

```typescript
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormioModule } from '@formio/angular';
import {
  FormioResource,
  FormioResourceRoutes,
  FormioResourceConfig,
  FormioResourceService
} from '@formio/angular/resource';

@NgModule({
  imports: [
    CommonModule,
    FormioModule,
    FormioResource,
    RouterModule.forChild(FormioResourceRoutes())
  ],
  providers: [
    FormioResourceService,
    {
      provide: FormioResourceConfig,
      useValue: {
        name: '<camelCaseChildName>',                    // e.g. 'lineItem'
        form: '<template.json child form.path verbatim>', // usually kebab-case; MUST equal template.json.path
        parents: ['<camelCaseParentName>']               // match the parent module's `name`
      }
    }
  ]
})
export class <Child>Module {}
```

The `parents: ['<parent>']` entry is what activates `FormioResourceService.loadParents()`. At runtime, when a user lands on `/<parent>/:id/<child>/new`, the child's form is auto-populated with the parent submission in the field whose `key === '<parent>'`, and that field is hidden. The user sees a "new Task" form with the Project pre-selected and invisible.

This is why the `<child>` form MUST contain a select component with `key: '<parent>'` and `data.resource: '<parent>'` — without it, `loadParents()` has nothing to hide/fill. The `formio-resource-planner` `template.json` already emits this; do not re-emit it here.

## 5. N:N join — both sides mounted under their opposite parent

For a join `UserTeam` linking `User` and `Team`, you generate **two sibling modules** that both target the same underlying Form.io form but with different `parents` and different `name` (to avoid registry collision in `FormioResources`).

### A. The `team` parent module gets a `users` child route

`src/app/team/team.module.ts` (fragment):

```typescript
const teamRoutes = FormioResourceRoutes({
  resource: ResourceComponent,
  view: ViewComponent,
});
teamRoutes[2].children.push({
  path: 'users',
  loadChildren: () => import('./users/team-users.module').then((m) => m.TeamUsersModule),
});
```

### B. The `TeamUsersModule` — shows the join rows for a team

`src/app/team/users/team-users.module.ts`:

```typescript
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormioModule } from '@formio/angular';
import {
  FormioResource,
  FormioResourceRoutes,
  FormioResourceConfig,
  FormioResourceService,
} from '@formio/angular/resource';
import { TeamUsersIndexComponent } from './index/team-users-index.component';

@NgModule({
  imports: [
    CommonModule,
    FormioModule,
    FormioResource,
    RouterModule.forChild(FormioResourceRoutes({ index: TeamUsersIndexComponent })),
  ],
  declarations: [TeamUsersIndexComponent],
  providers: [
    FormioResourceService,
    {
      provide: FormioResourceConfig,
      useValue: {
        name: 'teamUsers', // distinct registry key per side (camelCase)
        form: 'user-team', // MUST equal template.json's form.path for the join resource — kebab-case by default
        parents: ['team'], // filter join rows to this team
      },
    },
  ],
})
export class TeamUsersModule {}
```

### C. The `user` side — mirror

`src/app/user/user.module.ts` (fragment):

```typescript
const userRoutes = FormioResourceRoutes({ resource: ResourceComponent, view: ViewComponent });
userRoutes[2].children.push({
  path: 'teams',
  loadChildren: () => import('./teams/user-teams.module').then((m) => m.UserTeamsModule),
});
```

`src/app/user/teams/user-teams.module.ts` — identical shape, `name: 'userTeams'`, `form: 'user-team'` (same kebab-case `template.json.path` as the other side — both sibling modules target the one underlying form), `parents: ['user']`.

### D. Customizing the index grid to link at the opposite side

The default `FormioResourceIndexComponent` shows a submission grid for the join rows. That is the table of `userTeam` rows — not ideal, because the user wants to see `Team` entities when browsing `/user/:id/teams`.

Two acceptable options. Pick based on the Phase A plan:

**Option 1: keep the grid, customize the column renderer to link to the opposite side.**

`team-users-index.component.ts`:

```typescript
import { Component } from '@angular/core';
import { FormioResourceIndexComponent } from '@formio/angular/resource';

@Component({
  selector: 'app-team-users-index',
  templateUrl: './team-users-index.component.html',
  standalone: false,
})
export class TeamUsersIndexComponent extends FormioResourceIndexComponent {}
```

`team-users-index.component.html`:

```html
<formio-grid *ngIf="service.form" [src]="service.formUrl" (rowSelect)="goToOpposite($event)">
</formio-grid>
```

Override `goToOpposite` to `this.router.navigate(['/user', row.data.user._id, 'view'])`.

**Option 2: replace the index with a custom component that fetches the join rows and shows the opposite entity directly.**

More work; only do it when the user explicitly asks for it. Option 1 is the default.

## 6. Current-user parent (pre-fill the `user` field)

For a resource that should auto-fill its `user` field with the logged-in user (e.g., `Participant.user` in the angular-demo), add a `currentUser` object parent:

```typescript
parents: ['event', { field: 'user', resource: 'currentUser', filter: false }];
```

`currentUser` is the resource name that `@formio/angular/auth`'s `FormioAuthService` registers once a user logs in. `filter: false` means "don't use this parent to narrow the list; just pre-fill the field." This is the exact pattern in the angular-demo's `ParticipantModule`.

## 7. Static (AOT-safe) routes

Dynamic `routes[2].children.push(...)` works under Angular 15+ with strict AOT, but if the consumer's build fails with "Function calls are not supported in decorators", fall back to static routes:

```typescript
import {
  FormioResourceComponent,
  FormioResourceIndexComponent,
  FormioResourceCreateComponent,
  FormioResourceViewComponent,
  FormioResourceEditComponent,
  FormioResourceDeleteComponent
} from '@formio/angular/resource';

RouterModule.forChild([
  { path: '', component: FormioResourceIndexComponent },
  { path: 'new', component: FormioResourceCreateComponent },
  {
    path: ':id',
    component: ResourceComponent,
    children: [
      { path: '', redirectTo: 'view', pathMatch: 'full' },
      { path: 'view', component: ViewComponent },
      { path: 'edit', component: FormioResourceEditComponent },
      { path: 'delete', component: FormioResourceDeleteComponent },
      {
        path: '<child>',
        loadChildren: () => import('./<child>/<child>.module').then(m => m.<Child>Module)
      }
    ]
  }
])
```

Same three-segment shape as `FormioResourceRoutes()`; you just write it by hand. Use this when the user reports an AOT build failure or asks for "no dynamic routes."

## 8. Extending `FormioResourceIndexComponent`

The default index renders a `formio-grid` pointed at `service.formUrl`. To customize columns, filtering, or row actions, extend it:

```typescript
import { Component } from '@angular/core';
import { FormioResourceIndexComponent } from '@formio/angular/resource';

@Component({
  selector: 'app-<kebab>-index',
  templateUrl: './<kebab>-index.component.html',
  standalone: false
})
export class <Pascal>IndexComponent extends FormioResourceIndexComponent {}
```

Pass it via `FormioResourceRoutes({ index: <Pascal>IndexComponent })`.

## 9. Designing the ViewComponent from the resource's fields

This is where the skill earns its keep. A resource map gives you a field list; the ViewComponent template turns that field list into a designed page. Below are recipes by field shape. When a resource has multiple shapes (e.g., a title + a date range + a status), compose the recipes — they are additive.

### Recipe A — Title + description (almost every resource)

Most resources have a name/title field and a descriptive long-form field. Surface them as the card title and card body respectively; don't hide them inside a form render.

```html
<h3 class="card-title">{{ service.resource?.data?.<titleField> }}</h3>
<p class="card-text text-muted" *ngIf="service.resource?.data?.<descField>">
  {{ service.resource?.data?.<descField> }}
</p>
```

Common title-field names to auto-detect: `name`, `title`, `subject`, `label`, `firstName + lastName` (compose). Common description fields: `description`, `notes`, `summary`, `body`.

### Recipe B — Date range (events, scheduling)

When the map has a `start`/`end` or `startDate`/`endDate` pair, render it as the card header with Angular's `date` pipe:

```html
<div class="card-header">
  {{ service.resource?.data?.start | date:'medium' }} &rarr; {{ service.resource?.data?.end |
  date:'medium' }}
</div>
```

Single `dueDate` / `closeDate`: show as a pill next to the title, with optional color if overdue:

```html
<span class="badge bg-warning" *ngIf="service.resource?.data?.dueDate">
  Due {{ service.resource?.data?.dueDate | date:'mediumDate' }}
</span>
```

### Recipe C — Status / stage (state enums)

When the map has a `status` or `stage` field with a static `select` option list, render as a color-coded badge:

```html
<span
  class="badge"
  [class.bg-success]="service.resource?.data?.status === 'done'"
  [class.bg-warning]="service.resource?.data?.status === 'in-progress'"
  [class.bg-secondary]="service.resource?.data?.status === 'open'"
>
  {{ service.resource?.data?.status | titlecase }}
</span>
```

For deal stages (prospect/qualified/proposal/won/lost), pick a longer color scale or a progress bar. The exact colors aren't important — what matters is that `status` becomes visually distinguishable, not a raw string.

### Recipe D — Numeric / currency

Amount, count, total → render with `number` / `currency` pipe. Pair with a label in a small dl:

```html
<dl class="row small">
  <dt class="col-sm-3">Amount</dt>
  <dd class="col-sm-9">{{ service.resource?.data?.amount | currency:'USD' }}</dd>
</dl>
```

### Recipe E — Reference selects (foreign keys)

When a field is a `select` whose `data.resource` points at another resource (e.g., `Task.assignee` → User, `Contact.account` → Account), render the reference as a clickable pill that navigates to the referenced entity's view page:

```html
<a *ngIf="service.resource?.data?.<refField>?._id"
   [routerLink]="['/<otherKebab>', service.resource?.data?.<refField>?._id, 'view']"
   class="badge bg-light text-dark border">
  <i class="fa fa-link"></i>
  {{ service.resource?.data?.<refField>?.data?.<otherTitleField> || 'Open' }}
</a>
```

### Recipe F — Nested children — action cards

When a resource has nested children (1:N or N:N), the ViewComponent is the natural place to expose them. Add a side/bottom card per child with a count + "New X" button:

```html
<div class="card">
  <div class="card-header"><ChildPluralLabel></div>
  <div class="card-body d-flex flex-column gap-2">
    <a [routerLink]="['../<childPath>']" class="btn btn-outline-primary">View <ChildPluralLabel></a>
    <a [routerLink]="['../<childPath>/new']" class="btn btn-primary">+ New <ChildSingularLabel></a>
  </div>
</div>
```

Counts can wait — add them in iteration 2 with a `service.resources['<childName>']` lookup — but the action card itself is in iteration 1.

### Recipe G — Join-index grid, linking to the opposite side

For the N:N join's custom `IndexComponent` template (mounted under a parent side — see section 5), render the grid but intercept row clicks to navigate to the opposite entity:

```html
<formio-grid *ngIf="service.form" [src]="service.formUrl" (rowSelect)="goToOpposite($event)">
</formio-grid>
```

```typescript
goToOpposite(row: any) {
  const oppositeId = row.data?.<oppositeKey>?._id;
  if (oppositeId) {
    this.router.navigate(['/<oppositeKebab>', oppositeId, 'view']);
  }
}
```

### Composing recipes

A Deal view with title (A), close-date (B), stage (C), amount (D), account reference (E), and nested Activities (F) composes all six recipes into a single coherent ViewComponent template:

```html
<div class="row g-3">
  <div class="col-md-8">
    <div class="card">
      <div class="card-body">
        <div class="d-flex align-items-start justify-content-between">
          <h3 class="card-title mb-0">{{ service.resource?.data?.title }}</h3>
          <span class="badge bg-info text-dark"
            >{{ service.resource?.data?.stage | titlecase }}</span
          >
        </div>
        <div class="text-muted small mt-1" *ngIf="service.resource?.data?.closeDate">
          Closes {{ service.resource?.data?.closeDate | date:'mediumDate' }}
        </div>
        <dl class="row mt-3">
          <dt class="col-sm-3">Amount</dt>
          <dd class="col-sm-9">{{ service.resource?.data?.amount | currency:'USD' }}</dd>
          <dt class="col-sm-3">Account</dt>
          <dd class="col-sm-9">
            <a
              *ngIf="service.resource?.data?.account?._id"
              [routerLink]="['/account', service.resource?.data?.account?._id, 'view']"
            >
              {{ service.resource?.data?.account?.data?.name }}
            </a>
          </dd>
        </dl>
      </div>
    </div>
  </div>
  <div class="col-md-4">
    <div class="card">
      <div class="card-header">Activity</div>
      <div class="card-body d-flex flex-column gap-2">
        <a [routerLink]="['../activities']" class="btn btn-outline-primary">View Activities</a>
        <a [routerLink]="['../activities/new']" class="btn btn-primary">+ Log Activity</a>
      </div>
    </div>
  </div>
</div>
```

**In Phase A, sketch this composition per resource in plain English** (not HTML) so the user can course-correct before you write it. The sketch is the "UI design sketch per resource" block in the plan.

### When the user picks a design language other than Bootstrap 5

The skeletons above use Bootstrap 5 classes. For **Tailwind**, swap `card` → a `rounded-lg shadow-sm bg-white p-4` block, `btn btn-primary` → a Tailwind button class pattern (or an `@apply`'d utility class). For **Angular Material**, replace cards with `<mat-card>` + `<mat-card-content>` and buttons with `<button mat-raised-button color="primary">`. The compose-from-field-shapes logic is identical; only the markup shell changes. When **unstyled** is selected, drop the classes entirely — the Angular router bindings and `service.resource?.data?.<field>` references are the only load-bearing parts.
