## Overview

Stages are per-environment copies of a parent project (authoring, staging, production) used to separate development from live data. This skill covers creating a stage, retrieving stage details, listing all stages for a project, configuring a remote connection between a stage and an external Form.io deployment, and the full versioning workflow: tagging a version, listing versions, fetching a specific version, deploying a version to a stage, and deleting versions or stages. Two project-endpoint operations (`/export`, `/import`) are relevant to cross-environment template flow and are referenced here but documented in detail in `platform-projects.md`.

## Root URL

All endpoints below are rooted at `{baseUrl}` — the platform deployment endpoint, equivalent to bare `{{baseUrl}}/` in Postman. Two operations (`/export`, `/import`) cross-reference `{projectUrl}` (Postman `{{baseUrl}}/{{projectName}}`) and are explicitly labeled.

## Authentication

Every request to these endpoints MUST include an `x-jwt-token` header holding the user JWT issued by the MCP server's browser-based portal-login flow. The MCP server attaches this header automatically via `formioFetch`; external clients must obtain the JWT through the same portal-login flow. Do not use any other authentication mechanism with these endpoints.

## MCP Tool Preference

For the project the working directory resolves to, versions have MCP tools: `project_tag_list` (the current version and every tag), `project_tag_create` (a new version), and `project_export` with `tag` (the template a tag stored). Creating stages and deploying a tag to another stage have no MCP tool — they belong to the Form.io portal or the user's own CI/CD; use the HTTP endpoints below only when the user asks for that work.

## Endpoints

### POST {baseUrl}/project (create stage)

Create a new stage under a parent project. Stages are created through the same `/project` endpoint as top-level projects, with `type: "stage"` and a `project` field pointing to the parent project ID.

Request body:

```json
{
  "title": "Staging",
  "type": "stage",
  "project": "<parentProjectId>",
  "copyFromProject": "<parentProjectId>",
  "framework": "custom",
  "name": "<parent-name>-stage",
  "stageTitle": "Staging",
  "settings": { "cors": "*" }
}
```

Required fields: `title`, `type: "stage"`, `project`, `name`. Optional: `copyFromProject` (clones roles/forms/actions from an existing project at creation time), `stageTitle`, `framework`, `settings`.

Response: the created stage document (same shape as a project, with `type: "stage"` and a non-null `project` field).

### GET {baseUrl}/project/:stageId

Get a stage by ID. Returns the stage document including its `remote` configuration if one is set.

### GET {baseUrl}/project?project=:projectId&type=stage

List all stages under a parent project.

| Query parameter | Type   | Description                                                        |
| --------------- | ------ | ------------------------------------------------------------------ |
| `project`       | string | Parent project ID. Required to scope the list to a single project. |
| `type`          | string | Must be `stage`.                                                   |
| `select`        | string | Optional field projection.                                         |

Response: array of stage documents.

### PUT {baseUrl}/project/:stageId (stage remote connection)

Update a stage — primarily to configure (or reconfigure) its `remote` connection. The full stage document must be supplied; `remote` is the field of interest.

Request body (abbreviated, include the full existing stage document):

```json
{
  "_id": "<stageId>",
  "type": "stage",
  "project": "<parentProjectId>",
  "remote": {
    "type": "Subdirectories",
    "url": "https://form.local",
    "project": {
      "_id": "<remoteProjectId>",
      "name": "remote-project-name",
      "title": "Remote Project"
    }
  }
}
```

Response: the updated stage document, now including the `remote` block.

### GET {baseUrl}/project/:stageId/access/remote

Obtain a short-lived JWT that authenticates this stage to its configured remote Form.io deployment. Used internally by the subdirectory/remote-connection flow.

Response: raw JWT string (not JSON).

### PUT {baseUrl}/project/:stageId (set remote connection)

Postman shows this as a second variant of the stage update above — the functional endpoint is identical. Use to set or replace the `remote` block. The difference from "Stage Remote Connection" is semantic (initial setup vs. reconnection); the API surface is the same.

### GET {projectUrl}/export _(project-endpoint, referenced)_

Cross-scope: export a stage or project as a template. Used when migrating a stage's configuration to another deployment. Documented in full in [platform-projects](./platform-projects.md).

### POST {projectUrl}/import _(project-endpoint, referenced)_

Cross-scope: import a template into an existing stage/project. Documented in full in [platform-projects](./platform-projects.md).

### POST {baseUrl}/project/:projectId/tag (create version)

Tag a version of the project — a named snapshot of the project's template that can be deployed to stages later. Tags are stored under the primary project, so they are shared by every stage of the project family: a tag created on one stage can be deployed to any other. Sent without a `template`, the request makes the server snapshot the project's current export; either way it sets the creating project's `tag` to the new name. Names are unique within the family (at most 32 characters) and the `description` holds at most 256; a tag cannot be edited afterwards.

Request body:

```json
{
  "project": "<projectId>",
  "tag": "1.0.0",
  "description": "Initial Version",
  "template": { "title": "...", "version": "2.0.0", "roles": {}, "forms": {}, "resources": {}, "actions": {} }
}
```

Response: the tag document with a server-assigned `_id`, timestamps, and the stored template.

### GET {baseUrl}/project/:projectId/tag/current

The project's current version: `{ "tag": "1.2.0" }` — the tag it was last tagged or deployed at (`0.0.0` when it never was).

### GET {baseUrl}/project/:projectId/tag

List all versions tagged for a project. Use `sort=-created` to get newest first.

Response: array of tag documents (without the full `template`; use `/tag/:tagId` for the full content).

### GET {baseUrl}/project/:projectId/tag/:tagId

Get a single tag, including its full template payload.

### POST {baseUrl}/project/:projectId/deploy

Deploy a tagged version (or an ad-hoc template) to a stage. The destination stage is the project at `:projectId`. Deploy runs the same importer as `/import` — forms in the template are updated in place and their actions recreated — except that it never changes the stage's project-level access; afterwards it sets the stage's `tag` and `lastDeploy`.

Request body, by tag:

```json
{
  "type": "tag",
  "tag": "1.2.0"
}
```

or with a template:

```json
{
  "type": "template",
  "template": { "title": "...", "version": "2.0.0", "roles": {}, "forms": {}, "resources": {}, "actions": {} }
}
```

Response: plain text `Tag Deployed` on success; `400` on template validation errors.

### DELETE {baseUrl}/project/:projectId/tag/:tagId

Delete a tag. Any stage deployed from this tag retains its deployed state; only the tag record is removed.

Response: `200 OK`.

### DELETE {baseUrl}/project/:stageId

Delete a stage entirely. Removes its forms, submissions, and access rules. This is the same endpoint as project deletion; the `type: stage` classification is enforced on the document, not on the path.

Response: `200 OK`.

## Related Skills

- [platform-projects](./platform-projects.md) — parent project operations, export/import
- [platform-tenants](./platform-tenants.md) — tenants are a separate but related sub-project type
- [platform-auth](./platform-auth.md) — platform-admin login
- [platform-teams](./platform-teams.md) — assign teams to stages via the same access-rule mechanism as projects
