## Overview

Role CRUD on a Form.io project. A `new Formio(roleUrl)` instance exposes `loadRole`, `saveRole`, `deleteRole`, and `loadRoles`. Sourced from `packages/core/src/sdk/Formio.ts` in the Form.io source code.

## Imports

```ts
import { Formio } from '@formio/js';
```

## URL Configuration

**Where these two values come from.** The hosts below are illustrations. When you write these calls into a real application, take both URLs from the MCP server rather than typing them — run `npx -y @formio/mcp@0.11.0 project get --cwd "$(pwd)"` and use exactly what it prints: its `Project URL` for `setProjectUrl`, its `Base URL` for `setBaseUrl`. Do not hardcode an example host, do not derive either URL from the other, and do not carry a value over from another project or an earlier session — the mapping the server reports is what every build-time Form.io tool call resolves, so a different value here ships an application pointed at a deployment the tooling is not managing. If the command reports a value missing, relay its instruction, persist the answer with the `project set` command it names, and re-run it.

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
