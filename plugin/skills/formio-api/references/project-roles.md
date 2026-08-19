## Overview

The Project Roles API lets a project admin manage the roles that govern access inside a single Form.io project. Roles are referenced by `access` and `submissionAccess` entries on forms, and they are assigned to user submissions (for example, to admin submissions or to authenticated end users). This skill covers listing, creating, and updating roles. Every project is seeded with built-in roles such as `Administrator`, `Authenticated`, and `Anonymous`.

## Root URL

All endpoints below are rooted at `{projectUrl}` — the project endpoint, equivalent to `{{baseUrl}}/{{projectName}}` in Postman.

## Authentication

Every request to these endpoints MUST include an `x-jwt-token` header holding the user JWT issued by the MCP server's browser-based portal-login flow. The MCP server attaches this header automatically via `formioFetch`; external clients must obtain the JWT through the same portal-login flow. Do not use any other authentication mechanism with these endpoints.

## MCP Tool Preference

Prefer the MCP server's first-party tools when they cover the requested operation. Call the HTTP endpoint directly only when no MCP tool applies.

| Operation      | Preferred MCP tool | Fallback endpoint               |
| -------------- | ------------------ | ------------------------------- |
| List all roles | `role_list`        | `GET {projectUrl}/role`         |
| Create a role  | `role_create`      | `POST {projectUrl}/role`        |
| Update a role  | `role_update`      | `PUT {projectUrl}/role/:roleId` |

## Endpoints

### GET {projectUrl}/role

List every role defined in the project, including built-in roles (`Administrator`, `Authenticated`, `Anonymous`) and any custom roles the admin has created.

Response: JSON array of role documents. Each entry contains:

```json
{
  "_id": "69d65f4e040fa2cea2572254",
  "title": "Administrator",
  "description": "A role for Administrative Users.",
  "default": false,
  "admin": true,
  "project": "69d65f4e040fa2cea257224d",
  "machineName": "example:administrator",
  "created": "2026-04-08T13:59:42.647Z",
  "modified": "2026-04-08T13:59:42.650Z"
}
```

Errors: `401` if the JWT is missing/expired; `403` if the caller lacks read access to project roles.

Example:

```bash
curl -H "x-jwt-token: $FORMIO_JWT" \
  "{projectUrl}/role"
```

### POST {projectUrl}/role

Create a new role inside the project.

Request body (JSON):

```json
{
  "title": "Employee",
  "description": "A person who belongs to a company."
}
```

Required fields: `title`. Optional fields: `description`, `default` (boolean — when `true`, the role is assigned to every new authenticated user), `admin` (boolean — when `true`, holders bypass access checks; use sparingly).

Response: the created role document with server-assigned `_id`, `project`, `machineName`, `created`, and `modified` fields. `default` and `admin` default to `false` when omitted.

```json
{
  "title": "Employee",
  "description": "A person who belongs to a company.",
  "default": false,
  "admin": false,
  "_id": "69d68310040fa2cea2572945",
  "project": "69d65f4e040fa2cea257224d",
  "created": "2026-04-08T16:32:16.889Z",
  "modified": "2026-04-08T16:32:16.892Z",
  "machineName": "example:employee"
}
```

Errors: `400` for validation errors (missing `title`, duplicate `machineName`); `401`/`403` as above.

Example:

```bash
curl -X POST -H "x-jwt-token: $FORMIO_JWT" -H "Content-Type: application/json" \
  -d '{"title":"Employee","description":"A person who belongs to a company."}' \
  "{projectUrl}/role"
```

### PUT {projectUrl}/role/:roleId

Update an existing role. This is a full replacement — include every field you want to preserve.

| Path parameter | Type   | Description                              |
| -------------- | ------ | ---------------------------------------- |
| `roleId`       | string | The MongoDB `_id` of the role to update. |

Request body (JSON):

```json
{
  "title": "Employee",
  "description": "A person who belongs to a company."
}
```

Any field from the create body can be included. Changing `admin` or `default` has immediate effect on access checks for all existing users with this role.

Response: the updated role document with a refreshed `modified` timestamp.

Errors: `400` for validation errors; `404` if the role does not exist; `401`/`403` as above.

Example:

```bash
curl -X PUT -H "x-jwt-token: $FORMIO_JWT" -H "Content-Type: application/json" \
  -d '{"title":"Employee","description":"A person who belongs to a company."}' \
  "{projectUrl}/role/69d68310040fa2cea2572945"
```

## Related Skills

- [project-forms](./project-forms.md) — forms whose `access` and `submissionAccess` entries reference these roles
- [project-auth](./project-auth.md) — admin submissions that receive the `Administrator` role
- [project-actions](./project-actions.md) — actions (such as `role` and `login`) that assign roles to submissions
