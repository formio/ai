## Overview

Role CRUD on a Form.io project. A `new Formio(roleUrl)` instance exposes `loadRole`, `saveRole`, `deleteRole`, and `loadRoles`. Sourced from `packages/core/src/sdk/Formio.ts` in the Form.io source code.

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

Roles live at `${projectUrl}/role` (list) and `${projectUrl}/role/<roleId>` (single).

## API

Instance methods on a role-scoped Formio:

- `loadRole(opts?): Promise<Role>` — `GET ${roleUrl}`.
- `saveRole(data?, opts?): Promise<Role>` — `POST ${rolesUrl}` if `roleId` is absent, `PUT ${roleUrl}` to update.
- `deleteRole(opts?): Promise<void>` — `DELETE ${roleUrl}`.
- `loadRoles(opts?): Promise<Role[]>` — `GET ${projectUrl}/role` — list.

Role shape (from the API): `{ _id, title, machineName, description, admin: boolean, default: boolean }`. A role with `default: true` is assigned to anonymous traffic; a role with `admin: true` bypasses access checks within the project.

## Examples

### List roles

```ts
import { Formio } from '@formio/js';

Formio.setBaseUrl('https://forms.mysite.com');
Formio.setProjectUrl('https://forms.mysite.com/myproject');

const roles = await new Formio(`${Formio.getProjectUrl()}/role`).loadRoles();
roles.forEach((r) => console.log(r.machineName, r.admin, r.default));
```

### Create a role

```ts
import { Formio } from '@formio/js';

Formio.setBaseUrl('https://api.form.io');
Formio.setProjectUrl('https://myproject.form.io');

await new Formio(`${Formio.getProjectUrl()}/role`).saveRole({
  title: 'Reviewer',
  description: 'Can review and edit but not delete submissions.',
  admin: false,
  default: false,
});
```

### Update a role

```ts
import { Formio } from '@formio/js';

const formio = new Formio(`${Formio.getProjectUrl()}/role/000000000000000000000020`);
const role = await formio.loadRole();
role.description = 'Reviewer (revised).';
await formio.saveRole(role);
```

### Delete a role

```ts
import { Formio } from '@formio/js';

await new Formio(`${Formio.getProjectUrl()}/role/000000000000000000000020`).deleteRole();
```

## MCP Tool Preference

Inside this workspace, prefer the first-party MCP tools:

| Operation     | MCP tool      | SDK fallback                          |
| ------------- | ------------- | ------------------------------------- |
| Create a role | `role_create` | `new Formio(rolesUrl).saveRole(role)` |
| List roles    | `role_list`   | `new Formio(rolesUrl).loadRoles()`    |
| Update a role | `role_update` | `new Formio(roleUrl).saveRole(role)`  |

There is no first-party `role_delete` MCP tool today — use the SDK or `DELETE ${roleUrl}` for deletion.
