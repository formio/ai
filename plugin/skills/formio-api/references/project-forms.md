## Overview

The Forms API covers everything a project admin does with form and resource definitions: listing, filtering by type/name/tag, retrieving by ID or alias, creating new forms, updating existing forms, and exporting form data as JSON or CSV. It does NOT cover form submissions (see `runtime-submissions.md`) or form revisions (see `project-form-revisions.md`).

## Root URL

All endpoints below are rooted at `{projectUrl}` — the project endpoint, equivalent to `{{baseUrl}}/{{projectName}}` in Postman.

## Authentication

Every request to these endpoints MUST include an `x-jwt-token` header holding the user JWT issued by the MCP server's browser-based portal-login flow. The MCP server attaches this header automatically via `formioFetch`; external clients must obtain the JWT through the same portal-login flow. Do not use any other authentication mechanism with these endpoints.

## MCP Tool Preference

Prefer the MCP server's first-party tools when they cover the requested operation. Call the HTTP endpoint directly only when no MCP tool applies.

| Operation                | Preferred MCP tool | Fallback endpoint                 |
| ------------------------ | ------------------ | --------------------------------- |
| Create a form            | `form_create`      | `POST {projectUrl}/form`          |
| Get a form by ID or name | `form_get`         | `GET {projectUrl}/form/:idOrName` |
| List forms               | `form_list`        | `GET {projectUrl}/form`           |
| Update a form            | `form_update`      | `PUT {projectUrl}/form/:idOrName` |

## Endpoints

### GET {projectUrl}/form

List forms and resources in the project, optionally filtered by type, name, or tag.

| Query parameter | Type | Description |
| --- | --- | --- |
| `type` | string | `form` to return only forms, `resource` to return only resources. Omit to return both. |
| `name__regex` | string | MongoDB-style regex filter (e.g., `/^user/i` for names starting with "user", case-insensitive). |
| `tag` | string | Comma-separated list of tags — forms matching any tag are returned. |
| `select` | string | Comma-separated projection of fields to include (e.g., `title,name,type,path`). Reduces payload. |
| `limit`, `skip`, `sort` | — | Standard Form.io list controls. See the `formio-api` README for cross-cutting pagination/sorting notes. |

Response: JSON array of form documents. Each document contains `_id`, `title`, `name`, `path`, `type`, and whatever additional fields `select` requested.

Errors: `401` if the JWT is missing/expired; `403` if the caller lacks read access to the project's forms.

Example:

```bash
curl -H "x-jwt-token: $FORMIO_JWT" \
  "{projectUrl}/form?type=form&select=title,name,path,type"
```

### GET {projectUrl}/form/:idOrName

Retrieve a single form by its MongoDB ID or machine name. Form.io accepts either in the same path segment.

Response: the full form document (components, settings, access, etc.). Use `project-form-revisions.md` if you need a specific historical revision.

Errors: `404` if no form matches; `401`/`403` as above.

Example:

```bash
curl -H "x-jwt-token: $FORMIO_JWT" \
  "{projectUrl}/form/user-registration"
```

### GET {projectUrl}/:formPath

Retrieve a form by its URL alias (path). Useful when the caller has the path but not the ID.

Response: same shape as the ID-based GET.

Errors: `404` if no form has that path.

### POST {projectUrl}/form

Create a new form or resource. The request body is a form definition.

Request body (JSON):

```json
{
  "title": "Example Form",
  "display": "form",
  "type": "form",
  "name": "exampleForm",
  "path": "example-form",
  "tags": ["example"],
  "components": [
    {
      "type": "textfield",
      "label": "First Name",
      "key": "firstName",
      "validate": { "required": true }
    },
    { "type": "email", "label": "Email", "key": "email", "validate": { "required": true } }
  ]
}
```

Required fields: `title`, `type` (`form` or `resource`), `name`, `path`, `components`. Optional fields: `tags`, `display`, `settings`, `access`, `submissionAccess`. See the `formio-schema` skill for the full component schema.

Response: the created form document with server-assigned `_id`, `machineName`, `created`, and `modified` fields.

Errors: `400` for validation errors (duplicate `name`/`path`, missing required fields, invalid component definitions); `401`/`403` as above.

Example:

```bash
curl -X POST -H "x-jwt-token: $FORMIO_JWT" -H "Content-Type: application/json" \
  -d @form-definition.json \
  "{projectUrl}/form"
```

### PUT {projectUrl}/form/:idOrName

Replace an existing form definition. The body SHOULD include the `_id` of the form being updated (Form.io treats this as a full document replacement; omitted fields are reset to defaults).

Request body: same shape as the create body, plus `_id`. Include every field you want to preserve.

Response: the updated form document.

Errors: `400` for validation errors; `404` if the form does not exist; `409` if `_vid` version checks fail (when revisions are enabled).

Note: prefer `PATCH` (via `runtime-submissions.md` patterns extended to forms) if partial updates are needed — this endpoint is a full replacement.

### PUT {projectUrl}/:formPath

Alias-based update. Equivalent to the ID-based PUT but addressed by `path`. Useful when the caller has the alias but not the ID.

### GET {projectUrl}/form/:idOrName/export

Export all submission data for a form as JSON (default) or CSV.

| Query parameter | Type   | Description                |
| --------------- | ------ | -------------------------- |
| `format`        | string | `json` (default) or `csv`. |

Response: streamed file. `Content-Type` is `application/json` or `text/csv`. For large forms, expect streaming — consume via a streaming HTTP client rather than buffering in memory.

Errors: `401`/`403` for insufficient access; `404` if the form does not exist.

Example (CSV):

```bash
curl -H "x-jwt-token: $FORMIO_JWT" \
  "{projectUrl}/form/example-form/export?format=csv" \
  -o submissions.csv
```

## Related Skills

- [project-form-revisions](./project-form-revisions.md) — form draft/publish/revision operations
- [project-actions](./project-actions.md) — form actions (email, webhook, etc.) attached to a form
- [runtime-submissions](./runtime-submissions.md) — submitting and reading submission data for these forms
- [project-roles](./project-roles.md) — configuring form-level access via project roles
