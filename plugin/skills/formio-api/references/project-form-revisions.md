
## Overview

The Form Revisions API gives a project admin a draft/publish workflow for form definitions. Once revisions are enabled on a form, every published change creates a new numbered revision; admins can work on a draft that does not yet affect submissions, publish that draft to create the next revision, and retrieve any historical revision by its version number or revision ID. This skill covers enabling revisions, drafting, publishing, listing revisions, and fetching a specific revision. For non-revisioned form CRUD, see `project-forms.md`.

**Display modes (set via `revisions` on the form doc):**

- `"current"` — historical submissions render in the *latest* form revision.
- `"original"` — each submission renders in the revision it was captured under.
- `""` (empty string) — revisions disabled. Default for new forms.

**Storage model:**

- Form documents live in the `forms` collection. The active revision pointer is the integer `_vid` field on the form doc; the mode is the string `revisions` field.
- Published revisions AND the single active draft live in the `formrevisions` collection — one row per revision plus at most one row per form with `_vid: "draft"` (string sentinel, not an integer). Each row carries `_id`, `_rid` (parent form `_id`), `revisionId` (== `_id`), `_vid`, `_vnote` (note), `_vuser` (publisher's display name, server-set from JWT), `modified`, plus the full form snapshot. Drafts are NOT a separate collection.

## Root URL

All endpoints below are rooted at `${FORMIO_PROJECT_URL}` — the project endpoint, equivalent to `{{baseUrl}}/{{projectName}}` in Postman.

## Authentication

Every request to these endpoints MUST include an `x-jwt-token` header holding the user JWT issued by the MCP server's browser-based portal-login flow. The MCP server attaches this header automatically via `formioFetch`; external clients must obtain the JWT through the same portal-login flow. Do not use any other authentication mechanism with these endpoints.

## MCP Tool Preference

Prefer the first-party MCP tools below over raw HTTP for the operations they cover. The portal-login JWT auth flow described above is applied automatically by these tools.

- `form_revisions_list` — `GET ${FORMIO_PROJECT_URL}/form/:formId/v` (list published revisions as compact summaries — each entry has `vid`, `modified`, `user`, `note`; full form snapshots are stripped to keep the response small. Use `form_revision_get` for a single revision's full body.)
- `form_revision_get` — `GET ${FORMIO_PROJECT_URL}/form/:formId/v/:version` (fetch a form at a specific `_vid` or revision `_id`)
- `form_revisions_set` — `PUT ${FORMIO_PROJECT_URL}/form/:formId` to set the form's `revisions` field. Required `mode: "current" | "original" | ""` with no default — ask the user which value to set. `"current"` and `"original"` enable revisions (display mode for historical submissions); `""` disables (server preserves `_vid` and existing `formrevisions` rows).
- `form_draft_create` — `PUT ${FORMIO_PROJECT_URL}/form/:formId/draft` then a follow-up `GET ${FORMIO_PROJECT_URL}/form/:formId/draft` (save or overwrite the single active draft; optional `note` rides as `_vnote`. The post-PUT GET is a workaround for an upstream Mongoose `findOneAndUpdate` bug that returns the pre-update document — the GET returns ground truth.)
- `form_draft_get` — `GET ${FORMIO_PROJECT_URL}/form/:formId/draft` (fetch the current active draft — the mutable `_vid: "draft"` row; use `form_revision_get` instead for an immutable numbered revision)
- `form_draft_publish` — `PUT ${FORMIO_PROJECT_URL}/form/:formId` (promote the saved draft, or a caller-supplied `definition`, to the next published revision; optional `note` rides as `_vnote`; server auto-clears the draft on success; no-op when the body matches the current published form). The tool strips any `_vnote` from the publish body before the PUT — the published revision's `_vnote` is set EXCLUSIVELY by the explicit `note` argument (matching portal behavior). Do NOT auto-forward the draft's `_vnote` as `note` — draft notes and publish notes are independent.

## Endpoints

### PUT ${FORMIO_PROJECT_URL}/form/:formId

Enable form revisions on an existing form by setting `revisions` on the form document, and (once revisions are on) publish a new revision. This endpoint is the standard form update (see `project-forms.md`); whether a `PUT` enables revisions, publishes a new revision, or no-ops depends on the body and the form's current state:

- **Enable**: when the form's current `revisions` is `""` and the body sets `revisions: "current"` or `"original"`, the same `PUT` flips the mode AND inserts the first `formrevisions` row at `_vid: 1`. No separate seed call is needed — the server handles both writes.
- **Publish (with diff)**: when `revisions` is already on, a `PUT` whose body differs from the current published form (ignoring `_vnote`) bumps `_vid` and inserts a new numeric `formrevisions` row. The server also removes the existing `_vid: "draft"` row automatically.
- **Publish (no diff)**: when the body matches the current published form, the server returns 200 with the form unchanged. No new revision row, no error. The `_vid: "draft"` row, if present, survives.

| Path parameter | Type | Description |
| --- | --- | --- |
| `formId` | string | The MongoDB `_id` of the form to update. |

Request body (JSON): the full form definition, including `_id`, `title`, `name`, `path`, `type`, `display`, `components`, plus a `revisions` field (`"current"` / `"original"` / `""`) and an optional top-level `_vnote` string. The `_vnote` field rides on the publish body and lands on the new `formrevisions` row; the response strips it (not echoed back). `_vuser` is server-set from the JWT and MUST NOT be sent by the caller.

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

Save (or overwrite) the active draft of a revisioned form. Drafts do not affect live submissions; they are a working copy that the admin iterates on until ready to publish. **A form has at most one active draft at a time** — calling this endpoint overwrites any existing draft.

The draft is stored as a single row in the `formrevisions` collection with `_vid: "draft"` (string sentinel, not a number). The form doc is NOT touched by this call; only the draft row is upserted.

| Path parameter | Type | Description |
| --- | --- | --- |
| `formId` | string | The MongoDB `_id` of the form whose draft is being updated. |

Request body (JSON): same shape as the published form body — `_id`, `title`, `name`, `path`, `type`, `display`, `components`, etc. An optional top-level `_vnote` string is persisted on the draft row (drafts carry their own note, distinct from any future publish note).

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

### Publishing a revision

Publishing is NOT a distinct endpoint — it is the same `PUT ${FORMIO_PROJECT_URL}/form/:formId` documented above. When revisions are enabled and the body differs from the current published form, the `PUT` is a publish: it bumps `_vid`, inserts a new numeric `formrevisions` row, and removes the active `_vid: "draft"` row. Publishing does NOT auto-fetch the saved draft — the body sent in the `PUT` is what gets published. The portal UI fetches `GET .../draft` first and sends that body.

Attach a top-level `_vnote` string to the publish body to carry a revision note onto the new `formrevisions` row. The server strips `_vnote` from the response.

When the body matches the current published form (ignoring `_vnote`), the publish is a no-op: server returns 200, no new revision row is created, the existing draft survives.

### GET ${FORMIO_PROJECT_URL}/form/:formId/v

List every published revision of a form. Each entry is a full snapshot of the form definition at publish time. The active draft (`_vid: "draft"`) is NOT included in this listing — fetch it via `GET .../draft`.

| Path parameter | Type | Description |
| --- | --- | --- |
| `formId` | string | The MongoDB `_id` of the form. |

Response: JSON array of form-revision documents. Each entry includes:

- `_id` — revision document `_id` (distinct from the form's `_id`)
- `_rid` — parent form `_id` (back-reference to the `forms` collection)
- `revisionId` — equal to `_id` (server-managed alias)
- `_vid` — sequential version integer (`1`, `2`, ...)
- `_vnote` — revision note captured at publish time (empty string when none provided)
- `_vuser` — display name of the publisher (server-set from the JWT, e.g. `"admin"`)
- `modified` — ISO-8601 timestamp of the publish
- The full form snapshot: `title`, `name`, `path`, `type`, `display`, `tags`, `access`, `submissionAccess`, `owner`, `components`

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
