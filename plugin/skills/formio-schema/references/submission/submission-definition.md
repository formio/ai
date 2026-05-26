# Submission Definition Reference

Top-level shape of a Form.io submission — the JSON object the platform creates when a user submits a form (or saves an in-progress draft) and the object the runtime submission endpoints return. Load this file when interpreting a submission payload returned by `/{projectName}/{formPath}/submission`, when constructing one to `POST` or `PUT`, or when modeling submissions in a downstream system.

A submission is a discrete record of values submitted to a single form or resource. Form definitions describe what fields exist; submissions are the data those fields collected. One form has many submissions; each submission belongs to exactly one form within exactly one project.

## Submission object

| Property         | Type                  | Required | Description                                                                                                                                          |
| ---------------- | --------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `_id`            | `string`              | No       | MongoDB ObjectId assigned by the server. Absent on a new submission being created; populated on every read.                                          |
| `_fvid`          | `number`              | No       | Form-revision ID this submission was captured against. Tracks which form-definition revision the `data` shape was validated under.                   |
| `form`           | `string`              | No       | Form ID this submission belongs to. Server-populated from the request path.                                                                          |
| `project`        | `string`              | No       | Project ID containing the parent form. Server-populated.                                                                                             |
| `owner`          | `string`              | No       | Submission ID of the user that created this submission — the foreign key to a user-resource submission in the same project.                          |
| `roles`          | `string[]`            | No       | Role IDs assigned to this submission when the submission represents a user (i.e., when the parent form is a user resource). See `submission-access.md`. |
| `state`          | `'draft' \| 'submitted'` | No    | Lifecycle state of the submission. See `submission-state.md` for when each value is written.                                                         |
| `access`         | `Access[]`            | No       | Row-level access overrides applied to this specific submission. See `submission-access.md` for the entry shape and the layering rules with form-level `submissionAccess`. |
| `metadata`       | `SubmissionMetadata`  | No       | Bag of contextual values captured at submit time — timezone, browser, headers, etc. See `submission-metadata.md`.                                    |
| `data`           | `object`              | No       | The actual submitted values, keyed by each input component's `key`. See `submission-data.md` for how the form definition shapes this object.         |
| `externalIds`    | `unknown[]`           | No       | Identifiers from external systems (e.g., OAuth provider IDs) attached to this submission by integrations or actions.                                 |
| `externalTokens` | `unknown[]`           | No       | Bearer tokens or refresh tokens from external systems associated with this submission. Typically populated by OAuth-style login actions.             |
| `permission`     | `string`              | No       | Effective permission string the caller has on this submission, computed by the server and returned on read.                                          |
| `created`        | `string` (ISO date)   | No       | Server-assigned creation timestamp.                                                                                                                  |
| `modified`       | `string` (ISO date)   | No       | Server-assigned timestamp of the most recent update.                                                                                                 |
| `deleted`        | `string` (ISO date)   | No       | Soft-delete timestamp. Non-null indicates the submission has been deleted but is still recoverable; `null` or absent indicates active.               |

## Worked example

```json
{
  "_id": "5f8d0c4e9b1e8a0017a1b2c3",
  "_fvid": 7,
  "form": "5f8d0c4e9b1e8a0017a1b200",
  "project": "5f8d0c4e9b1e8a0017a10000",
  "owner": "5f8d0c4e9b1e8a0017a1aaaa",
  "roles": ["5f8d0c4e9b1e8a0017a10001"],
  "state": "submitted",
  "access": [{ "type": "read_all", "roles": ["5f8d0c4e9b1e8a0017a10002"] }],
  "metadata": {
    "timezone": "America/Chicago",
    "browserName": "Chrome",
    "origin": "https://app.example.com"
  },
  "data": {
    "firstName": "Ada",
    "lastName": "Lovelace",
    "email": "ada@example.com"
  },
  "externalIds": [],
  "externalTokens": [],
  "created": "2026-05-26T18:04:11.000Z",
  "modified": "2026-05-26T18:04:11.000Z"
}
```

## Related references

- `submission-state.md` — what `state` values mean and when each is written.
- `submission-metadata.md` — documented `metadata` keys and the extension contract.
- `submission-access.md` — row-level `access` array, all `AccessType` values, layering with form-level `submissionAccess`.
- `submission-data.md` — how the `data` object is shaped by the parent form's `components`, with cross-links to the form-domain references for per-component value shapes.
