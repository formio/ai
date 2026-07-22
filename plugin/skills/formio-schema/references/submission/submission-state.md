# Submission State Reference

`state` records where a submission sits in its lifecycle. Two values appear in production data and in the Form.io user guide:

| Value | When it's written | Meaning |
| --- | --- | --- |
| `"draft"` | A user opens a form, fills in some fields, and the platform persists the in-progress data without finalizing it (Save Draft action / SaveState button / form-level draft setting). | The submission is incomplete and can still be edited by the user before final submit. Validation rules that require values are NOT enforced on a draft. |
| `"submitted"` | The user completes the form and submits. The server runs all validations, executes Submit-time actions, and writes the final record. | The submission is finalized. Subsequent edits go through `PUT /submission/{_id}` (with permission) but the state stays `"submitted"`. |

A submission record may transition `draft` → `submitted` exactly once during its lifetime. There is no reverse transition; reopening a submitted record for editing does NOT move it back to `draft`.

## Note on the upstream TypeScript type

The TypeScript declaration in the Form.io platform source currently narrows `SubmissionState` to `'submitted'` only. This is a known narrowing gap — the runtime, the user guide, and production data all treat `'draft'` as a valid state value. Consumers reading submission JSON SHOULD accept both `'draft'` and `'submitted'` as valid `state` values; consumers writing submission JSON SHOULD use `'submitted'` for finalized records and `'draft'` for partial saves.

## Worked examples

A draft submission produced by a Save-Draft action:

```json
{
  "_id": "5f8d0c4e9b1e8a0017a1b2c3",
  "form": "5f8d0c4e9b1e8a0017a1b200",
  "state": "draft",
  "data": {
    "firstName": "Ada"
  }
}
```

The same submission once the user finalizes it:

```json
{
  "_id": "5f8d0c4e9b1e8a0017a1b2c3",
  "form": "5f8d0c4e9b1e8a0017a1b200",
  "state": "submitted",
  "data": {
    "firstName": "Ada",
    "lastName": "Lovelace",
    "email": "ada@example.com"
  }
}
```

## See also

- `submission-definition.md` — full Submission envelope including `state`.
- The `formio-api` skill's `runtime-submissions` reference for how `state` interacts with the `/submission` endpoints (filtering by state, retrieving drafts, etc.).
