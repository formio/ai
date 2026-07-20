## Overview

A tenant is a specialized sub-project type (`type: "tenant"`) used to give isolated admin/data namespaces to customer organizations sharing a common parent project. This skill covers creating tenants, listing tenants within a parent project, retrieving tenant information, updating tenant metadata, provisioning tenant administrators, logging in as a tenant admin, and creating forms inside a tenant. All operations are rooted at `${FORMIO_BASE_URL}/project` — tenants are project-like documents, so they share the `/project` resource tree with top-level projects and stages.

## Root URL

All endpoints below are rooted at `${FORMIO_BASE_URL}` — the platform deployment endpoint, equivalent to bare `{{baseUrl}}/` in Postman.

## Authentication

Every request to these endpoints MUST include an `x-jwt-token` header holding the user JWT issued by the MCP server's browser-based portal-login flow. The MCP server attaches this header automatically via `formioFetch`; external clients must obtain the JWT through the same portal-login flow. Do not use any other authentication mechanism with these endpoints.

## MCP Tool Preference

No MCP tool covers this operation — use the HTTP endpoint directly.

## Endpoints

### POST ${FORMIO_BASE_URL}/project (create tenant)

Create a new tenant under a parent project. Tenants share the `/project` endpoint with stages and top-level projects; the `type: "tenant"` field distinguishes them and the `project` field points to the parent.

Request body (Tenant A):

```json
{
  "title": "Tenant A",
  "name": "tenant-a",
  "type": "tenant",
  "project": "<parentProjectId>",
  "settings": { "cors": "*" }
}
```

The Postman documentation shows creating two separate tenants (Tenant A, Tenant B) with different `name` values — repeat this request with unique names per tenant. Response: the created tenant document with `_id`, `owner`, seeded `access` array, and timestamps.

### GET ${FORMIO_BASE_URL}/project?project=:projectId&type=tenant

List tenants within a parent project.

| Query parameter | Type   | Description                                     |
| --------------- | ------ | ----------------------------------------------- |
| `project`       | string | Parent project ID. Required.                    |
| `type`          | string | Must be `tenant`.                               |
| `select`        | string | Optional field projection (e.g., `title,name`). |

Response: array of tenant documents (projection limited by `select`).

### GET ${FORMIO_BASE_URL}/project/:tenantId

Get a tenant by ID. Returns the tenant's full document including `access`, `settings`, and linkage to the parent project.

### PUT ${FORMIO_BASE_URL}/project/:tenantId

Update a tenant's metadata. The full tenant document must be supplied (same shape as create, plus `_id`); omitted fields are reset to defaults.

Response: the updated tenant document.

### POST ${FORMIO_BASE_URL}/project/:tenantId/admin/submission

Provision a new tenant administrator. Creates an admin user within the tenant's admin resource — distinct from platform admins and from the parent project's admins.

Request body:

```json
{
  "data": {
    "email": "tenant-admin@example.com",
    "password": "CHANGEME"
  }
}
```

Response: the admin submission document (owned by the tenant's admin resource form).

### POST ${FORMIO_BASE_URL}/project/:tenantId/admin/login

Log in as a tenant administrator. Exchanges the tenant admin's credentials for a JWT scoped to the tenant.

Request body:

```json
{
  "data": {
    "email": "tenant-admin@example.com",
    "password": "CHANGEME"
  }
}
```

Response: the admin submission document. The tenant-scoped JWT is returned in the `x-jwt-token` response header; consume it from there.

```bash
curl -D - -X POST -H "Content-Type: application/json" \
  -d '{"data":{"email":"tenant-admin@example.com","password":"CHANGEME"}}' \
  "${FORMIO_BASE_URL}/project/<tenantId>/admin/login"
```

### POST ${FORMIO_BASE_URL}/project/:tenantId/form

Create a form inside a tenant. Must be invoked with a tenant-admin JWT (obtained via the login endpoint above).

Request body:

```json
{
  "title": "New Form",
  "path": "newform",
  "name": "newform",
  "components": [
    { "type": "textfield", "label": "First Name", "key": "firstName" },
    { "type": "textfield", "label": "Last Name", "key": "lastName" }
  ]
}
```

Response: the created form document, scoped to the tenant. This form does not appear in the parent project's form list — tenant data is isolated.

### DELETE ${FORMIO_BASE_URL}/project/:tenantId

Delete a tenant. Removes all tenant-specific forms, submissions, admins, and access rules. The parent project is unaffected.

Response: `200 OK`.

## Related Skills

- [platform-projects](./platform-projects.md) — parent project operations that own a tenant namespace
- [platform-auth](./platform-auth.md) — platform-admin login that authorizes tenant creation
- [platform-staging](./platform-staging.md) — stages are a different sub-project type; this skill and that one share the `/project` endpoint tree
- [project-forms](./project-forms.md) — once logged in as a tenant admin, form operations follow the standard project Forms API pattern
