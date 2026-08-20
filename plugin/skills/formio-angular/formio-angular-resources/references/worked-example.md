# Worked example — Task Manager

> **`FormioAppConfig` renames both URLs.** `appUrl` is the **Project URL** — the project this application reads and writes, and the one value anyone supplies. `apiUrl` is the **Base URL** — the deployment hosting it, which is normally derived from the Project URL rather than supplied. Take both from `npx -y @formio/mcp@0.10.0 project get --cwd "<workspace root>"`; never compose, derive, or hand-type either one yourself.

End-to-end walk-through of `../SKILL.md`'s flow: the planner's input, the Phase A Scaffolding Plan emitted for approval, and representative Phase B files.

**Input** (`template.md` from the planner — Task Manager; accompanying `template.json` not shown inline):

```
- Project (type: resource)
  Fields: name, description
- Task (type: resource)
  Fields: title, description, project (select Project), assignee (select User), status, dueDate
- ProjectUser (type: resource, join)
  Fields: project (select Project), user (select User)
  Actions: Group Permissions (group=project, user=user)
- User resource: default `user`
- Login form: userLogin
- Registration: userRegister
```

**Phase A plan** (emitted for approval):

```
## Scaffolding Plan — Task Manager

### Target workspace
- Mode: new workspace `ng new task-manager`
- FormioAppConfig.appUrl: https://taskmanager.form.io
- UI framework: Bootstrap 5

### Files to create / modify

  src/app/
    app-module.ts                                       NEW
    app-routing-module.ts                               NEW
    config.ts                                           NEW
    home/home.component.{ts,html,scss}                  NEW
    auth/auth.module.ts                                 NEW
    project/project.module.ts                           NEW
    project/resource.component.{ts,html,scss}           NEW  (tabs: View / Tasks / Members / Edit / Delete)
    project/view/view.component.{ts,html,scss}          NEW  (header card: name + description; side card: task count + member count + "New Task" button)
    project/tasks/project-tasks.module.ts               NEW   (1:N, parents: ['project'])
    project/tasks/resource.component.{ts,html,scss}     NEW  (breadcrumb back to project + task tabs)
    project/tasks/view/view.component.{ts,html,scss}    NEW  (status badge, due-date pill, assignee, description)
    project/users/project-users.module.ts               NEW   (N:N via ProjectUser — admin-only)
    project/users/index/project-users-index.component.{ts,html}  NEW  (grid — user column renders as link to that user)
    task/task.module.ts                                 NEW
    task/resource.component.{ts,html,scss}              NEW  (tabs: View / Edit / Delete)
    task/view/view.component.{ts,html,scss}             NEW  (same view layout as project/tasks — shared view template pattern)

### Module & route map

| Path                           | Module                   | Resource form | Parents       |
| ------------------------------ | ------------------------ | ------------- | ------------- |
| `/login`                       | AuthModule               | userLogin     | —             |
| `/register`                    | AuthModule               | userRegister  | —             |
| `/project`                     | ProjectModule            | project       | —             |
| `/project/:id/tasks`           | ProjectTasksModule       | task          | ['project']   |
| `/project/:id/users`           | ProjectUsersModule       | projectUser   | ['project']   |
| `/task`                        | TaskModule               | task          | —             |

### UI design sketch per resource (for review)
- **Project.view**: 2-col Bootstrap grid. Left card — `<h3>{{ service.resource?.data.name }}</h3>` header, description body. Right card — "Team & Work" header, with count badges for tasks and members and a prominent "New Task" button linking to `./tasks/new`.
- **Task.view**: Header shows status as a color-coded badge (`status === 'done'` → green, `'in-progress'` → yellow, `'open'` → gray). Subheader: due-date formatted with Angular date pipe and relative-time indicator. Body: full description. Footer: assignee line.
- **ProjectUsers.index** (admin grid): override the index template so the `user` column renders as a link to `/user/:id/view` when the user resource is browsable; otherwise render the user's `data.email` inline.

### N:N joins
- ProjectUser: mounted on Project only (User side omitted — admin operation on the join, not a normal user view). Index grid column `user` → link to that user's profile (or omitted if no User CRUD).

### Auth
- `/login` → userLogin, `/register` → userRegister, `/logout` → FormioAuthService.logout(). These three stay unguarded.
- `authGuard` (`src/app/auth/auth.guard.ts`) applied via `canActivate: [authGuard]` on the root `/project` and `/task` routes in `app-routing-module.ts` (anonymous has no access per `## Access Matrix`). The nested `/project/:id/tasks` and `/project/:id/users` routes inherit protection from the guarded parent. Per-group narrowing stays server-side — no role/group guard.
```

**After approval, Phase B** writes the full file set. The module file is only part of the story — every resource also gets `resource.component.{ts,html,scss}` and `view/view.component.{ts,html,scss}` with designed templates. Here's `project.module.ts` wiring in the custom overrides:

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
import { ResourceComponent } from './resource.component';
import { ViewComponent } from './view/view.component';

const projectRoutes = FormioResourceRoutes({
  resource: ResourceComponent,
  view: ViewComponent,
});
projectRoutes[2].children.push({
  path: 'tasks',
  loadChildren: () => import('./tasks/project-tasks.module').then((m) => m.ProjectTasksModule),
});
projectRoutes[2].children.push({
  path: 'users',
  loadChildren: () => import('./users/project-users.module').then((m) => m.ProjectUsersModule),
});

@NgModule({
  imports: [CommonModule, FormioModule, FormioResource, RouterModule.forChild(projectRoutes)],
  declarations: [ResourceComponent, ViewComponent],
  providers: [
    FormioResourceService,
    {
      provide: FormioResourceConfig,
      useValue: {
        name: 'project', // camelCase registry key (single-word, so no divergence)
        form: 'project', // === template.json form.path — coincides with `name` here only because the resource is single-word
      },
    },
  ],
})
export class ProjectModule {}
```

And here's the designed `view/view.component.html` that makes this resource feel like a Project page, not a generic form render:

```html
<div class="row g-3">
  <div class="col-md-8">
    <div class="card h-100">
      <div class="card-body">
        <h3 class="card-title mb-2">{{ service.resource?.data?.name }}</h3>
        <p class="card-text text-muted" *ngIf="service.resource?.data?.description">
          {{ service.resource?.data?.description }}
        </p>
      </div>
    </div>
  </div>
  <div class="col-md-4">
    <div class="card h-100">
      <div class="card-header">Team &amp; Work</div>
      <div class="card-body d-flex flex-column gap-2">
        <a [routerLink]="['../tasks']" class="btn btn-outline-primary">View Tasks</a>
        <a [routerLink]="['../tasks/new']" class="btn btn-primary">+ New Task</a>
        <a [routerLink]="['../users']" class="btn btn-outline-secondary">Manage Members</a>
      </div>
    </div>
  </div>
</div>
```

See `resource-module-patterns.md` for the complete worked set (every override template, nested Task module, N:N ProjectUsersIndexComponent, AppModule wiring, and the "Designing the ViewComponent from the resource's fields" recipe).
