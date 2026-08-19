## Overview

Project management at the platform level: creating new projects, listing all projects/stages/tenants on a deployment, retrieving a project by ID or alias, updating project metadata (title, access, framework, settings), exporting a project template, importing a template, and deleting a project. The create/list/get-by-id/delete operations are rooted at `{baseUrl}/project` (platform root). Update-by-alias, access-info, export, and import operations are actually invoked at the _project_ endpoint (`{projectUrl}/...`) and are documented here because they are project-management operations typically performed by a platform admin.

## Root URL

All endpoints below are rooted at `{baseUrl}` — the platform deployment endpoint, equivalent to bare `{{baseUrl}}/` in Postman. A few documented operations cross-reference the project endpoint (`{projectUrl}`, equivalent to `{{baseUrl}}/{{projectName}}` in Postman); those are explicitly labeled below.

## Authentication

Every request to these endpoints MUST include an `x-jwt-token` header holding the user JWT issued by the MCP server's browser-based portal-login flow. The MCP server attaches this header automatically via `formioFetch`; external clients must obtain the JWT through the same portal-login flow. Do not use any other authentication mechanism with these endpoints.

## MCP Tool Preference

No MCP tool covers this operation — use the HTTP endpoint directly.

## Endpoints

### POST {baseUrl}/project

Create a new project owned by the authenticated platform admin.

Request body:

```json
{
  "title": "Example Project",
  "description": "This is an example Form.io project.",
  "name": "example-project",
  "type": "project",
  "settings": { "cors": "*" }
}
```

Required fields: `title`, `name`, `type` (`project`, `stage`, or `tenant`). Optional: `description`, `settings`, `framework`, `access`, `plan`.

Response: the created project document — includes `_id`, `owner`, `plan`, a fresh `access` array seeded with an administrator role, and server timestamps.

Errors: `400` on validation issues (duplicate `name`, invalid settings); `401`/`403` if the caller is not a platform admin.

```bash
curl -X POST -H "x-jwt-token: $FORMIO_JWT" -H "Content-Type: application/json" \
  -d '{"title":"Example","name":"example","type":"project","settings":{"cors":"*"}}' \
  "{baseUrl}/project"
```

### GET {baseUrl}/project

List projects, stages, and tenants on the deployment. Use `type` to filter and `select` to project a subset of fields.

| Query parameter | Type | Description |
| --- | --- | --- |
| `type` | string | `project` (live projects), `stage`, or `tenant`. Omit to return all three types. |
| `select` | string | Comma-separated fields (e.g., `title,name,type`). |
| `project` | string | When listing stages or tenants, restrict to children of this parent project ID. |
| `limit`, `skip`, `sort` | — | Standard list controls. |

Response: array of project-like documents. With `select`, only the requested fields are returned.

```bash
curl -H "x-jwt-token: $FORMIO_JWT" \
  "{baseUrl}/project?type=project&select=title,name,type"
```

### GET {baseUrl}/project/:projectId

Get a project by its MongoDB ID. Returns the full project document including access rules and settings.

Errors: `404` if no project with that ID; `401`/`403` if the caller lacks read access to the project.

### GET {projectUrl} _(project-endpoint alias)_

Cross-scope convenience: the project endpoint's root returns the same document as `/project/:projectId`, addressed by alias (`{{baseUrl}}/{{projectName}}`). Use this when you have the project name but not the ID.

### PUT {projectUrl} _(project-endpoint, update project metadata)_

Cross-scope: replace the project's metadata (title, description, access, framework, settings, default access). The request body MUST include the project's `_id`; omitted fields are reset to defaults.

Request body: full project document (see create shape) plus `_id`. Include every field you want to preserve.

Response: the updated project document. `409` if a stage-aware revision check fails.

### GET {projectUrl}/access _(project-endpoint, access info)_

Cross-scope: return the project's complete access configuration — roles (with IDs), resource-level access map, and public access flags. Used by UIs that render "who can do what" for a project.

Response shape (abridged):

```json
{
  "roles": {
    "administrator": { "_id": "...", "title": "Administrator", "admin": true },
    "authenticated": { "_id": "...", "title": "Authenticated" },
    "anonymous": { "_id": "...", "title": "Anonymous", "default": true }
  }
}
```

### GET {projectUrl}/export _(project-endpoint, export template)_

Cross-scope: export the project's complete template (roles, forms/resources, actions) as a portable JSON document. Use this to migrate a project between deployments or to snapshot it before making destructive changes.

Response: a template JSON object with `title`, `version`, `roles`, `forms`, `actions`, and `resources`.

### POST {projectUrl}/import _(project-endpoint, import template)_

Cross-scope: import a template JSON into an existing project. Merges the template's roles, resources, forms, and actions into the current project.

Request body:

```json
{ "template": { "title": "...", "version": "2.0.0", "roles": {}, "forms": [], "resources": [] } }
```

Response: plain text `Ok` on success. `400` if the template is malformed or incompatible with the current project's resources.

### DELETE {baseUrl}/project/:projectId

Permanently delete a project. Soft-deletes via Form.io's standard mechanism (`deleted` timestamp set on the document). Stages and tenants under this project must be deleted first.

Response: `200 OK`. `409` if dependent stages/tenants still exist.

```bash
curl -X DELETE -H "x-jwt-token: $FORMIO_JWT" \
  "{baseUrl}/project/<projectId>"
```

## Related Skills

- [platform-auth](./platform-auth.md) — obtain the platform-admin JWT that authorizes these calls
- [platform-staging](./platform-staging.md) — stage lifecycle under a parent project
- [platform-tenants](./platform-tenants.md) — multi-tenant operations within a project
- [platform-teams](./platform-teams.md) — team assignment to projects
