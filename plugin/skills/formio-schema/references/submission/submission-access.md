# Submission Access Reference

`access` on a submission is a row-level access-control override applied to that specific submission. It uses the same `Access` entry shape as the form's `submissionAccess`, but it lives on the individual record rather than the form definition, so it overrides the form-level rule for that one submission.

## Access entry shape

| Property    | Type       | Required | Description                                                                                       |
| ----------- | ---------- | -------- | ------------------------------------------------------------------------------------------------- |
| `type`      | `string`   | **Yes**  | One of the AccessType values listed below.                                                        |
| `roles`     | `string[]` | **Yes**  | Role IDs granted this access type for the submission.                                             |
| `resources` | `string[]` | No       | Resource (form) IDs limiting the scope of the grant — used by team and self-referential access types. |

The `access` field on the Submission envelope is an array of these entries. Each entry maps one access type to the set of roles that get it.

## AccessType values

| Value          | Meaning                                                                                                              |
| -------------- | -------------------------------------------------------------------------------------------------------------------- |
| `self`         | Grants access to the user whose user-resource submission is referenced by `owner`. Used to express "the submitter can read/update their own record." |
| `create_own`   | Grants creation rights to roles, but only for records whose `owner` is the requester's own user submission.          |
| `create_all`   | Grants unrestricted creation rights to roles.                                                                        |
| `read_own`     | Grants read rights to roles, but only for records whose `owner` matches the requester.                               |
| `read_all`     | Grants unrestricted read rights to roles.                                                                            |
| `update_own`   | Grants update rights to roles, but only for records the requester owns.                                              |
| `update_all`   | Grants unrestricted update rights to roles.                                                                          |
| `delete_own`   | Grants delete rights to roles, but only for records the requester owns.                                              |
| `delete_all`   | Grants unrestricted delete rights to roles.                                                                          |
| `team_read`    | Grants read rights to members of the listed teams (Team plan / Enterprise).                                          |
| `team_write`   | Grants read + update rights to team members.                                                                         |
| `team_admin`   | Grants full read + update + delete rights to team members.                                                           |
| `team_access`  | Grants access to a specific resource (form) the team has been granted access to — used in combination with `resources`. |

## Layering with form-level submissionAccess

The form definition can carry its own `submissionAccess` array (form-level rule that applies to every submission against that form — see `references/form/form-definition.md`). The submission's own `access` array (this reference) is checked on top of the form-level rule. Where both define the same `type`, the submission's row-level entry wins for that specific record. Where only one defines a `type`, that single source applies. This lets a form's default be "owners read their own" while a specific record opens itself up to a broader audience without changing the form definition.

## Worked example

A submission that overrides the form-level access to additionally grant read access to a manager role for this specific record:

```json
{
  "_id": "5f8d0c4e9b1e8a0017a1b2c3",
  "owner": "5f8d0c4e9b1e8a0017a1aaaa",
  "access": [
    { "type": "read_all", "roles": ["5f8d0c4e9b1e8a0017a1man1"] },
    { "type": "update_own", "roles": ["5f8d0c4e9b1e8a0017a1emp1"] }
  ]
}
```

## See also

- `references/form/form-definition.md` for the form-level `access` and `submissionAccess` arrays.
- The `formio-api` skill's `runtime-access-control` reference for how the server resolves these entries on a request.
