
## Overview

The Form Revisions API gives a project admin a draft/publish workflow for form definitions. Once revisions are enabled on a form, every published change creates a new numbered revision; admins can work on a draft that does not yet affect submissions, publish that draft to create the next revision, and retrieve any historical revision by its version number or revision ID. This skill covers enabling revisions, drafting, publishing, listing revisions, and fetching a specific revision. For non-revisioned form CRUD, see `project-forms.md`.

## Root URL

All endpoints below are rooted at `${FORMIO_PROJECT_URL}` — the project endpoint, equivalent to `{{baseUrl}}/{{projectName}}` in Postman.

## Authentication

Every request to these endpoints MUST include an `x-jwt-token` header holding the user JWT issued by the MCP server's browser-based portal-login flow. The MCP server attaches this header automatically via `formioFetch`; external clients must obtain the JWT through the same portal-login flow. Do not use any other authentication mechanism with these endpoints.

## MCP Tool Preference

No MCP tool covers this operation — use the HTTP endpoint directly.

## Endpoints

### PUT ${FORMIO_PROJECT_URL}/form/:formId

Enable form revisions on an existing form by setting `revisions` on the form document. This endpoint is the standard form update (see `project-forms.md`), but when a form is saved with `revisions` turned on, subsequent draft/publish operations become available on that form. Once enabled, every `PUT` to this path creates a new published revision.

| Path parameter | Type | Description |
| --- | --- | --- |
| `formId` | string | The MongoDB `_id` of the form to update. |

Request body (JSON): the full form definition, including `_id`, `title`, `name`, `path`, `type`, `display`, `components`, and (to enable the feature) a `revisions` flag per the form's settings.

```json
{
  "_id": "69d69ce1040fa2cea2572c71",
  "title": "Example Form 8",
  "name": "example",
  "path": "example",
  "type": "form",
  "display": "form",
  "tags": [],
  "owner": "69d6813b040fa2cea257285a",
  "components": [
    { "type": "textfield", "label": "First Name", "key": "firstName", "validate": { "required": true } },
    { "type": "textfield", "label": "Last Name", "key": "lastName", "validate": { "required": true } },
    { "type": "email", "label": "Email", "key": "email", "validate": { "required": true } }
  ]
}
```

Response: the updated form document. The server bumps `_vid` (version ID) and records a revision entry accessible via `GET .../v`.

Errors: `400` for validation errors; `404` if the form does not exist; `409` if a concurrent edit has already advanced `_vid`; `401`/`403` as above.

Example:

```bash
curl -X PUT -H "x-jwt-token: $FORMIO_JWT" -H "Content-Type: application/json" \
  -d @form.json \
  "${FORMIO_PROJECT_URL}/form/69d69ce1040fa2cea2572c71"
```

### PUT ${FORMIO_PROJECT_URL}/form/:formId/draft

Save an in-progress draft of a revisioned form. Drafts do not affect live submissions; they are a working copy that the admin iterates on until ready to publish.

| Path parameter | Type | Description |
| --- | --- | --- |
| `formId` | string | The MongoDB `_id` of the form whose draft is being updated. |

Request body (JSON): same shape as the published form body — `_id`, `title`, `name`, `path`, `type`, `display`, `components`, etc.

Response: the saved draft document (same shape as a form document). Subsequent calls to `GET .../draft` will return this state until publish or overwrite.

Errors: `400` for validation errors; `404` if the form does not exist or revisions are not enabled; `401`/`403` as above.

Example:

```bash
curl -X PUT -H "x-jwt-token: $FORMIO_JWT" -H "Content-Type: application/json" \
  -d @draft.json \
  "${FORMIO_PROJECT_URL}/form/69d69ce1040fa2cea2572c71/draft"
```

### GET ${FORMIO_PROJECT_URL}/form/:formId/draft

Retrieve the current draft for a revisioned form.

| Path parameter | Type | Description |
| --- | --- | --- |
| `formId` | string | The MongoDB `_id` of the form. |

Response: the draft form document, including `_id`, `title`, `name`, `path`, `components`, `access`, `submissionAccess`, and any in-progress edits.

Errors: `404` if no draft exists or the form has no revisions enabled; `401`/`403` as above.

Example:

```bash
curl -H "x-jwt-token: $FORMIO_JWT" \
  "${FORMIO_PROJECT_URL}/form/69d69ce1040fa2cea2572c71/draft"
```

### PUT ${FORMIO_PROJECT_URL}/form/:formId

Publish a draft. Publishing is done by issuing a standard `PUT` to the form endpoint with the desired definition — Form.io treats that save as the next published revision when revisions are enabled. After publishing, the draft is cleared and the new revision is appended to the revision list.

| Path parameter | Type | Description |
| --- | --- | --- |
| `formId` | string | The MongoDB `_id` of the form being published. |

Request body (JSON): the full form definition to publish. Typically the admin fetches `GET .../draft`, makes any last edits, then `PUT`s that body here.

Response: the published form document with an incremented `_vid` and a new entry in `GET .../v`.

Errors: `400` for validation errors; `404` if the form does not exist; `409` on `_vid` conflicts; `401`/`403` as above.

Example:

```bash
curl -X PUT -H "x-jwt-token: $FORMIO_JWT" -H "Content-Type: application/json" \
  -d @published.json \
  "${FORMIO_PROJECT_URL}/form/69d69ce1040fa2cea2572c71"
```

### GET ${FORMIO_PROJECT_URL}/form/:formId/v

List every revision of a form, ordered oldest to newest. Each revision is a full snapshot of the form definition at publish time.

| Path parameter | Type | Description |
| --- | --- | --- |
| `formId` | string | The MongoDB `_id` of the form. |

Response: JSON array of form-revision documents. Each entry includes `_id` (revision ID, distinct from the form's `_id`), `title`, `name`, `path`, `type`, `display`, `tags`, `access`, `submissionAccess`, `owner`, and `components`. The revision's sequential version number is implied by array order and by the URL used to retrieve it.

Errors: `404` if the form does not exist or has no revisions; `401`/`403` as above.

Example:

```bash
curl -H "x-jwt-token: $FORMIO_JWT" \
  "${FORMIO_PROJECT_URL}/form/69d69ce1040fa2cea2572c71/v"
```

### GET ${FORMIO_PROJECT_URL}/form/:formId/v/:version

Retrieve a specific form revision by sequential version number (`1`, `2`, ...) or by revision `_id`.

| Path parameter | Type | Description |
| --- | --- | --- |
| `formId` | string | The MongoDB `_id` of the form. |
| `version` | string | Either the sequential version number (e.g., `2`) or the revision document's `_id`. Form.io accepts both in the same path segment. |

Response: the full revision document (same shape as a published form). Useful for diffing, rolling back, or rehydrating a past form definition when replaying submissions.

Errors: `404` if no matching revision exists; `401`/`403` as above.

Examples:

```bash
# by sequential version number
curl -H "x-jwt-token: $FORMIO_JWT" \
  "${FORMIO_PROJECT_URL}/form/69d69ce1040fa2cea2572c71/v/2"

# by revision _id
curl -H "x-jwt-token: $FORMIO_JWT" \
  "${FORMIO_PROJECT_URL}/form/69d69ce1040fa2cea2572c71/v/69d69df5040fa2cea2572ce4"
```

## Related Skills

- [project-forms](./project-forms.md) — base form CRUD; enabling revisions is done via the standard form update
- [project-actions](./project-actions.md) — actions attached to a form (actions themselves are not revisioned)
- [project-roles](./project-roles.md) — roles referenced by the `access` blocks captured in each revision
