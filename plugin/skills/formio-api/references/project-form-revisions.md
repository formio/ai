
## Overview

The Form Revisions API gives a project admin a draft/publish workflow for form definitions. Once revisions are enabled on a form, every published change creates a new numbered revision; admins can work on a draft that does not yet affect submissions, publish that draft to create the next revision, and retrieve any historical revision by its version number or revision ID. This skill covers enabling revisions, drafting, publishing, listing revisions, and fetching a specific revision. For non-revisioned form CRUD, see `project-forms.md`.

## Root URL

All endpoints below are rooted at `${FORMIO_PROJECT_URL}` — the project endpoint, equivalent to `{{baseUrl}}/{{projectName}}` in Postman.

## Authentication

Every request to these endpoints MUST include an `x-jwt-token` header holding the user JWT issued by the MCP server's browser-based portal-login flow. The MCP server attaches this header automatically via `formioFetch`; external clients must obtain the JWT through the same portal-login flow. Do not use any other authentication mechanism with these endpoints.

## Key Behaviors

- **Every form created via `form_create` defaults to `revisions: 'original'`** on a licensed deployment. The caller may override by passing `revisions: 'current'` or `revisions: ''` on the form body, but the tool's default is `original` so submission history is preserved out of the box. On unlicensed deployments, `revisions` is stripped from the body entirely.
- **Every `form_update` call writes a revision note (`note`).** The caller passes one for standard updates, drafts, publishes, and explicit revert notes; for `revert: true` the tool defaults `note` to `Reverted to version {version}` when the caller omits it. The note is prefixed (`@formio/mcp:`) and persisted on the revision document — never skipped.

## MCP Tool Preference

Prefer the MCP server's first-party tools for every operation on this page; fall back to the raw HTTP endpoints only if the tool cannot satisfy the request.

- **List revisions** (`GET /form/:id/v`) — use `form_revisions_list`. Accepts the form by `_id` or path alias.
- **Get a single revision** (`GET /form/:id/v/:version`) — use `form_revision_get`. `version` may be the sequential `_vid` or the revision document's `_id`.
- **Inspect the current draft** (`GET /form/:id/draft`) — use `form_get` with `draft: true`. Accepts the form by `_id` or path alias. The underlying endpoint falls back to the live form when no draft exists; the tool distinguishes by checking `_vid === 'draft'` and throws a clear "no draft exists" error when the fallback fires.
- **Enable or change revisions setting** (`PUT /form/:id` with `revisions`) — use `form_update` and pass `revisions: "current" | "original" | ""` on the form body. Omitting `revisions` on `form_update` leaves the stored value unchanged; when the stored form has revisions disabled and the caller did NOT opt in via `revisions: 'original' | 'current'`, the tool prompts (elicitation, with a browser fallback) for the per-form mode before applying the update.
- **Save a draft** (`PUT /form/:id/draft`) — use `form_update` with `draft: true`. Caller `form` fields merge on top of the existing draft (caller wins), preserving prior unpublished edits.
- **Publish the current draft** (`PUT /form/:id` from `/draft` body) — use `form_update` with `publish: true`. The tool fetches the staged draft and the live form, then PUTs the live form overlaid with a strict revision-field allowlist from the draft: `components`, `settings`, `tags`, `properties`, `controller`, `esign`, `display`. All other fields (`title`, `name`, `path`, `type`, `access`, `submissionAccess`, `submissionRevisions`, `owner`, `project`, `revisions`, identity/server-managed fields) keep their live values. The caller's `form` argument is ignored in this mode; `note` must still describe the actual diff between the live form and the draft (generic placeholders like "publishing changes" are forbidden).
- **Revert to a prior revision** — use `form_update` with `revert: true` and `version: "<vid>"` (a sequential `_vid` like `"3"`) or `version: "<revisionDocId>"` (the 24-char hex revision document `_id`). The tool fetches that revision and the live form, then PUTs live overlaid with a narrower revert allowlist: `components`, `tags`, `properties`, `display`. All other fields keep their live values; the caller's `form` argument is ignored. Inspect the target revision via `form_revision_get` first so `note` can describe what reverting restores (e.g. `Revert to v3: rollback bad release`); when omitted, the tool defaults `note` to `Reverted to version {version}`. `draft`, `publish`, and `revert` are mutually exclusive — pass at most one (the tool throws when more than one is set).

`note` is required on every `form_update` call EXCEPT `revert: true` (which defaults the note to `Reverted to version {version}` when the caller omits it). The LLM SHALL generate it by diffing the prior state against the new body — no action preambles (`Published draft:`, `Saved draft:`, `Reverted:`).

### License gating

`draft`, `publish`, and `revert` require the Security Module on the deployment's license. When the deployment is unlicensed:

- `draft` / `publish` / `revert` — the tool throws immediately telling the caller to drop the flag and call `form_update` as a standard update.
- Standard updates — the tool prompts once per deployment for "continue without revision tracking" consent (cached across sessions in `~/.formio/revisions-license-consent.json`). On consent, the `revisions` field is stripped from the body so the API doesn't silently write a value it can't honor.

### Per-form revisions-mode gate

Distinct from the deployment-level license gate above, this gate asks "for THIS specific form, how should revisions be tracked." It fires on a standard `form_update` ONLY when ALL of the following hold:

1. The deployment IS licensed for revisions.
2. The stored form has `revisions` disabled (falsy).
3. The caller did NOT opt in by passing `revisions: 'original' | 'current'` on the body. Passing `revisions: ''` mirrors the disabled stored state and does NOT bypass the prompt — that loophole would let an LLM silently skip the audit-trail decision on every form by always echoing the disabled value.
4. The user has not already approved "proceed without history" for this form in the current process (session-scoped cache).

When all conditions hold, the tool prompts (elicitation, with a browser fallback) with three choices:

- **Enable revisions (original)** — submissions render against the form version active when they were submitted. Tool sets `revisions: 'original'` on the PUT body.
- **Enable revisions (current)** — submissions always render against the latest form version. Tool sets `revisions: 'current'` on the PUT body.
- **Proceed without history (not tracked)** — tool strips any caller-supplied `revisions` from the PUT body and remembers the approval for this `formId` for the rest of the process so the user is asked only once per form.

On cancel, the tool throws and no update is performed.

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
