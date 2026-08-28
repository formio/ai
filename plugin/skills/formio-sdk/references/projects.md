## Overview

Project CRUD and access-info lookups via the SDK. A `new Formio(projectUrl)` instance exposes `loadProject`, `saveProject`, `deleteProject`, and `accessInfo`. Role listing is via the static `Formio.projectRoles()` helper (there is no instance `projectRoles` method). Sourced from `packages/core/src/sdk/Formio.ts` in the Form.io source code.

## Imports

```ts
import { Formio } from '@formio/js';
```

## URL Configuration

**Where these two values come from.** The hosts below are illustrations — never ship one. Take both URLs from whichever of the two paths applies, per [`project-urls.md`](../../formio-mcp-setup/references/project-urls.md). **If the Form.io MCP tools are callable by you**, call `project_get` with `cwd` set to the user's current working directory and use exactly what it reports: its `projectUrl` for `setProjectUrl`, its `baseUrl` for `setBaseUrl`; if it reports a value missing, relay its instruction, persist the answer with `project_set`, and call it again. **If they are not, ask the user** — for the Project URL first and alone, deriving the Base URL from it, and asking for the Base URL only in the one shape where it cannot be derived. Do not install the MCP server to obtain these two values: writing them into an application reaches no deployment. Either way, do not hardcode an example host, do not derive either URL from the other, and do not carry a value over from another project or an earlier session — a wrong value here ships an application pointed at a deployment nobody is managing.

### Hosted

```ts
import { Formio } from '@formio/js';

Formio.setBaseUrl('https://forms.mysite.com');
Formio.setProjectUrl('https://forms.mysite.com/myproject');
```

### SaaS

```ts
import { Formio } from '@formio/js';

Formio.setBaseUrl('https://api.form.io');
Formio.setProjectUrl('https://myproject.form.io');
```

The project URL is exactly what was passed to `Formio.setProjectUrl(...)`. The SDK extracts `projectId` from the path/subdomain when needed.

## API

Instance methods on a project-scoped Formio:

- `loadProject(query?, opts?): Promise<Project>` — `GET ${projectUrl}`.
- `saveProject(data?, opts?): Promise<Project>` — `PUT ${projectUrl}` (update). New-project creation is a platform-scoped operation; see `formio-api`'s `platform-projects.md`.
- `deleteProject(opts?): Promise<void>` — `DELETE ${projectUrl}` (platform-scoped permission required).
- `accessInfo(): Promise<{ roles, forms, components }>` — `GET ${projectUrl}/access` — return the roles + per-form access rules visible to the current user.
- `getProjectId(): Promise<string>` — resolve the project's Mongo ObjectId.

Static helpers:

- `Formio.accessInfo(formio?): Promise<...>` — `GET ${projectUrl}/access`; if `formio` is omitted, uses the configured project URL.
- `Formio.projectRoles(formio?): Promise<Role[]>` — `GET ${projectUrl}/role`. There is no instance-method equivalent — for role listing on a different project, pass a `new Formio(otherProjectUrl)` as the argument.

## Examples

### Load project metadata

```ts
import { Formio } from '@formio/js';

Formio.setBaseUrl('https://forms.mysite.com');
Formio.setProjectUrl('https://forms.mysite.com/myproject');

const project = await new Formio(Formio.getProjectUrl()).loadProject();
console.log(project.title, project.machineName);
```

### Update project settings

```ts
import { Formio } from '@formio/js';

const formio = new Formio(Formio.getProjectUrl());
const project = await formio.loadProject();
project.settings = { ...project.settings, email: { sendgrid: { auth: { api_key: 'SG.x...' } } } };
await formio.saveProject(project);
```

### Inspect access rules

```ts
import { Formio } from '@formio/js';

Formio.setBaseUrl('https://api.form.io');
Formio.setProjectUrl('https://myproject.form.io');

const access = await Formio.accessInfo();
access.roles.forEach((role) => console.log(role.title, role.admin, role.default));
```

### Delete a project (platform-scoped)

```ts
import { Formio } from '@formio/js';

await new Formio(Formio.getProjectUrl()).deleteProject();
```

## MCP Tool Preference

Inside this workspace, prefer the MCP tools when they cover the operation:

| Operation | MCP tool | SDK fallback |
| --- | --- | --- |
| Export a project as a template | `project_export` | `loadProject()` + walking `/form` and `/role` manually |
| Import a project template | `project_import` | `saveForm` / `saveRole` looped over the template |

`loadProject` / `saveProject` for live metadata edits have no MCP equivalent — use the SDK.
