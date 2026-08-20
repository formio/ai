## Overview

Submissions are the backbone of any Form.io integration: they hold the data end users enter into a form. Reading and writing them is **application** work, done at runtime with the end user's own token — a list view, a detail page, a dashboard, a submit handler. This document is the reference for building that code; see "MCP Tool Preference" below for why it is not a set of calls to make while configuring a project. It documents runtime-scope CRUD for submissions — creating new submissions, validating payloads without saving, listing and filtering existing submissions, fetching a single submission by ID, checking for existence by field value, updating (full and partial via JSON Patch), reading revisions, and deleting. Form and action definitions are covered by `project-forms.md` and `project-actions.md`.

Submission revisions require the parent form to have `submissionRevisions: "true"` enabled — a one-time form update performed via the Forms API before revision history will be recorded.

## Root URL

All endpoints below are rooted at `{projectUrl}` — the project endpoint, equivalent to `{{baseUrl}}/{{projectName}}` in Postman.

## Authentication

Every request to these endpoints MUST include an `x-jwt-token` header holding the user JWT issued by the MCP server's browser-based portal-login flow. The MCP server attaches this header automatically via `formioFetch`; external clients must obtain the JWT through the same portal-login flow. Do not use any other authentication mechanism with these endpoints.

## MCP Tool Preference

No MCP tool covers these operations, and none should: they are **runtime** endpoints. The MCP tools exist for **build-time** work — creating and updating forms, actions, roles, and project settings while the application is being built. The endpoints below are called by the finished application, on behalf of the person using it, with that person's own token.

So this document is a specification for the code you write, not a set of calls to make now. Fetching submissions into an application at runtime — a list view, a detail page, a dashboard, a report — is one of the most common things a Form.io app does, and this is the reference for building it. There is no build-time reason to read submission records, so do not call these endpoints yourself to inspect data: the records belong to the end users who filled the forms in, reading them is not part of configuring a project, and nothing in a submission is an input to your work here.

## Endpoints

### POST {projectUrl}/:formPath/submission

Create a new submission for the form identified by `:formPath` (the form's URL alias; the ID also works in the same segment). The server runs validation and any `before`/`after` actions attached to the form.

Request body (JSON) — the shape is `{ "data": { ...componentKey: value } }`. Nested and multi-row components (containers, data grids, edit grids) are represented as nested objects or arrays keyed by the component `key`.

```json
{
  "data": {
    "firstName": "Ashlynn",
    "lastName": "Flatley",
    "email": "Lucie94@yahoo.com",
    "numberOfPets": 406,
    "birthday": "08/10/2000",
    "emailNotify": true,
    "topicsOfInterest": {
      "artsCrafts": false,
      "business": false,
      "finance": true,
      "politics": true,
      "sports": false,
      "technology": false
    },
    "children": [
      { "firstName": "Reggie", "lastName": "Fritsch", "birthday": "02/03/2010" },
      { "firstName": "Sheila", "lastName": "Walker", "birthday": "03/15/2014" }
    ]
  }
}
```

Response: the created submission document with server-assigned `_id`, `form`, `owner`, `roles`, `access`, `metadata`, `created`, and `modified`.

Errors: `400` `ValidationError` when required fields are missing or component validators fail (see the `POST .../submission` validate pattern below); `401` if the JWT is missing/expired; `403` if the caller lacks `create_own` / `create_all` permission on the form's `submissionAccess`.

Example:

```bash
curl -X POST -H "x-jwt-token: $FORMIO_JWT" -H "Content-Type: application/json" \
  -d '{"data":{"firstName":"Ashlynn","lastName":"Flatley","email":"Lucie94@yahoo.com"}}' \
  "{projectUrl}/onboarding-872/submission"
```

### POST {projectUrl}/:formPath/submission (validate only)

Validate a submission payload without persisting it. Form.io exposes validation through the same endpoint shape — send the submission with the query/header convention your client library uses to request dry-run validation, or simply inspect the `400 ValidationError` response to surface form-level errors to the UI.

Request body: identical shape to the create endpoint.

Response when valid: same as create.

Response when invalid (`400`):

```json
{
  "name": "ValidationError",
  "details": [
    {
      "message": "First Name is required",
      "level": "error",
      "path": ["firstName"],
      "context": {
        "validator": "required",
        "key": "firstName",
        "label": "First Name",
        "path": "firstName"
      }
    }
  ]
}
```

Errors: `400` with `name: "ValidationError"` and a `details[]` array of per-component failures; `401`/`403` as above.

### GET {projectUrl}/:formPath/submission

List submissions for the form. Supports Form.io's standard list controls and `data.*` filters.

| Query parameter | Type | Description |
| --- | --- | --- |
| `data.<key>` | string | Filter by submission data field (e.g., `data.email=foo@bar.com`). Supports `__regex`, `__gt`, `__lt`, `__in`, etc. |
| `limit`, `skip`, `sort` | — | Standard Form.io pagination/sort controls. |
| `select` | string | Comma-separated projection of top-level fields to include. |

Response: JSON array of submission documents. When the form's `submissionAccess` restricts callers to their own data, the server transparently filters the list to submissions the caller owns.

Errors: `401` missing JWT; `403` no read access to the form's submissions.

Example:

```bash
curl -H "x-jwt-token: $FORMIO_JWT" \
  "{projectUrl}/onboarding-872/submission?limit=25&sort=-created"
```

### GET {projectUrl}/:formPath/submission/:submissionId

Retrieve a single submission by ID.

Response: full submission document (`_id`, `form`, `owner`, `data`, `roles`, `access`, `metadata`, `created`, `modified`, `externalIds`).

Errors: `404` if not found or the caller lacks access; `401`/`403` otherwise.

Example:

```bash
curl -H "x-jwt-token: $FORMIO_JWT" \
  "{projectUrl}/onboarding-872/submission/69dd37ba040fa2cea2579ee2"
```

### GET {projectUrl}/:formPath/exists

Check whether a submission matching the query exists without returning its full body. Useful for uniqueness checks (e.g., "has anyone with this email already submitted?").

| Query parameter | Type | Description |
| --- | --- | --- |
| `data.<key>` | string | Field match predicate, same semantics as `GET .../submission`. At least one is required. |

Response when a match is found:

```json
{ "_id": "69dd37ba040fa2cea2579ee2" }
```

Response when no match: `404`.

Example:

```bash
curl -H "x-jwt-token: $FORMIO_JWT" \
  "{projectUrl}/onboarding-872/exists?data.email=Lucie94@yahoo.com"
```

### PUT {projectUrl}/:formPath/submission/:submissionId

Full replace of a submission. The body SHOULD include `_id` and `form`; any field omitted from the body is treated as reset per Form.io's replace semantics. For single-field edits prefer the `PATCH` endpoint below.

Request body: a full submission document (at minimum `_id`, `form`, `data`).

Response: the updated submission document. When submission revisions are enabled, a new revision entry is appended and accessible via the `/v` endpoint.

Errors: `400` validation errors; `404` submission not found; `401`/`403` as above.

### GET {projectUrl}/:formPath/submission/:submissionId/v

List revisions of a submission. Requires `submissionRevisions: "true"` on the parent form.

Response: JSON array of prior submission snapshots, newest first, each with its own `_id` representing the revision.

Errors: `404` if the form does not have revisions enabled or the submission is unknown.

### GET {projectUrl}/:formPath/submission/:submissionId?submissionRevision=:revisionId

Retrieve a single historical revision of a submission by its revision `_id`.

Response: the submission document as it existed at that revision, including `metadata` captured at the time.

Errors: `404` if the revision does not exist.

### PATCH {projectUrl}/:formPath/submission/:submissionId

Apply a JSON Patch (RFC 6902) to a submission. Ideal for partial updates without round-tripping the full document.

Request body (JSON array of patch operations):

```json
[
  { "op": "replace", "path": "/data/firstName", "value": "James" },
  { "op": "remove", "path": "/data/lastName" },
  { "op": "add", "path": "/data/lastName", "value": "Thompson" }
]
```

Response: the updated submission document.

Errors: `400` for invalid patch operations or validation failures after the patch is applied; `404` if the submission does not exist; `401`/`403` as above.

Example:

```bash
curl -X PATCH -H "x-jwt-token: $FORMIO_JWT" -H "Content-Type: application/json" \
  -d '[{"op":"replace","path":"/data/firstName","value":"James"}]' \
  "{projectUrl}/onboarding-872/submission/69dd37ba040fa2cea2579ee2"
```

### DELETE {projectUrl}/:formPath/submission/:submissionId

Delete a submission. Hard-deletes the document unless the form configures soft-delete behavior.

Response: empty object `{}` on success.

Errors: `404` if not found; `401`/`403` as above.

Example:

```bash
curl -X DELETE -H "x-jwt-token: $FORMIO_JWT" \
  "{projectUrl}/onboarding-872/submission/69dd37ba040fa2cea2579ee2"
```

## Related Skills

- [project-forms](./project-forms.md) — form definitions these submissions target, including enabling `submissionRevisions`
- [runtime-access-control](./runtime-access-control.md) — own-access and group-permission patterns that filter `GET /submission` results
- [runtime-reports](./runtime-reports.md) — aggregated reports across submissions
