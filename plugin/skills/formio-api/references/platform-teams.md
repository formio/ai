## Overview

Teams are Form.io's mechanism for granting a group of platform users shared access to one or more projects. This skill covers the full team lifecycle: creating and listing teams, adding and removing members, promoting members to admins, inviting users, assigning a team to a project, and deleting a team. Team CRUD is rooted at `{baseUrl}/team`; the two cross-scope operations that bind a team to a project or check a member's project access live at `{projectUrl}/...` and are labeled below.

## Root URL

All endpoints below are rooted at `{baseUrl}` — the platform deployment endpoint, equivalent to bare `{{baseUrl}}/` in Postman. Two operations cross-reference `{projectUrl}` (Postman `{{baseUrl}}/{{projectName}}`) and are explicitly labeled.

## Authentication

Every request to these endpoints MUST include an `x-jwt-token` header holding the user JWT issued by the MCP server's browser-based portal-login flow. The MCP server attaches this header automatically via `formioFetch`; external clients must obtain the JWT through the same portal-login flow. Do not use any other authentication mechanism with these endpoints.

## MCP Tool Preference

No MCP tool covers this operation — use the HTTP endpoint directly.

## Endpoints

### POST {baseUrl}/team

Create a new team owned by the calling platform user.

Request body:

```json
{ "data": { "name": "Form Builders" } }
```

Response: the team submission document including `_id`, `form` (the Team resource form ID), `owner`, and metadata.

### GET {baseUrl}/team/all

List all teams the caller has visibility into (teams they own, are a member of, or admin).

Response: array of team submission documents.

### GET {baseUrl}/team/all (per user)

Same endpoint as above; authorization context (the JWT in `x-jwt-token`) determines which teams are returned. There is no separate "teams per user" endpoint — the `/team/all` endpoint already filters by caller.

### GET {baseUrl}/team/:teamId

Get a single team by ID.

Response: the team submission document.

### PUT {baseUrl}/team/:teamId

Rename a team or update its metadata.

Request body:

```json
{ "data": { "name": "Form Builders Updated" } }
```

Response: the updated team document.

### POST {baseUrl}/team/:teamId/member

Add a member to the team. Set `admin: true` to add as a team admin directly.

Request body:

```json
{
  "data": {
    "team": { "_id": "<teamId>" },
    "email": "user@example.com",
    "admin": false
  }
}
```

Response: the member submission document. If the email is already registered on the platform, the user is added directly; otherwise an invitation flow is triggered.

### POST {baseUrl}/team/:teamId/member (add as admin)

Same endpoint as above — set `admin: true` in the request body:

```json
{ "data": { "team": { "_id": "<teamId>" }, "email": "admin@example.com", "admin": true } }
```

### PUT {baseUrl}/team/:teamId/member/:memberId

Promote an existing team member to admin (or demote to member). Only team admins and the team owner may invoke this.

Request body:

```json
{ "data": { "email": "user@example.com", "admin": true } }
```

### POST {baseUrl}/formio/user/login (login as team member)

Not a distinct team endpoint — this is the standard platform login flow (see `platform-auth.md`). Included in the Postman team workflow to illustrate logging in as a team member to accept an invite.

### POST {baseUrl}/team/:teamId/join

Accept an outstanding team invitation. Called by the invited user (whose JWT is in `x-jwt-token`).

Response: the accepted membership document.

### PUT {projectUrl} _(project-endpoint, assign team to project)_

Cross-scope: grant a team access to a project by updating the project's access rules to include the team's roles. The full project body must be supplied (same shape as in `platform-projects.md` → Update Project). Add the team's access entries to the `access` array:

```json
{
  "_id": "<projectId>",
  "name": "<projectName>",
  "type": "project",
  "access": [
    { "type": "team_admin", "roles": ["<teamRoleId>"] },
    { "type": "team_write", "roles": ["<teamRoleId>"] }
  ]
}
```

Response: the updated project document.

### GET {baseUrl}/team/:teamId/projects

List projects a team has access to, with the team's permission level on each project.

Response:

```json
[
  {
    "_id": "<projectId>",
    "title": "Example Project",
    "name": "example-project",
    "owner": "<ownerId>",
    "permission": "team_admin"
  }
]
```

### GET {projectUrl}/form?select=title,type,modified _(project-endpoint, member access verification)_

Cross-scope: verify a team member actually has access to a project's forms by listing them with the member's JWT. A `401`/`403` response indicates the team assignment did not propagate as expected.

Response: array of form documents (projection limited by `select`).

### DELETE {baseUrl}/team/:teamId/member/:memberId

Remove a member from a team. Response: `200 OK`.

### DELETE {baseUrl}/team/:teamId

Delete a team entirely. All member records are removed; the team's access on any project is revoked.

Response: `200 OK`.

## Related Skills

- [platform-auth](./platform-auth.md) — platform login that establishes which user the team operations run as
- [platform-projects](./platform-projects.md) — the project CRUD operations teams get access to
- [platform-tenants](./platform-tenants.md) — multi-tenant access control (distinct from teams but sometimes layered)
- [platform-staging](./platform-staging.md) — teams can be assigned to stages the same way they are assigned to projects
