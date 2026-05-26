# Project Access Reference

Project-level access controls who can see and modify the project document itself — its settings, its forms, its roles. This is a separate concern from form-level access (who can read / edit the form definition) and submission-level access (who can read / edit submission records). All three layers use the same `Access` entry shape (`{ type, roles, resources? }`), but they live on different documents and govern different operations.

## Access layers — quick comparison

| Layer       | Where it lives                                  | What it gates                                              | Reference                                                  |
| ----------- | ----------------------------------------------- | ---------------------------------------------------------- | ---------------------------------------------------------- |
| Project     | `Project.access` (top-level on the project doc) | Who can see/modify the project itself, settings, role list | This file                                                  |
| Form        | `Form.access` (on the form definition)          | Who can see/modify the form definition (form-level)        | `references/form/form-definition.md`                       |
| Submission  | `Form.submissionAccess` + `Submission.access`   | Who can create/read/update/delete submission records       | `references/form/form-definition.md`, `submission/submission-access.md` |

A consumer can hold project-level access without form-level access (e.g., a developer who can see the project's portal but cannot edit a specific locked-down form). The three layers are checked independently.

## Project access entries

The `Project.access` field is an array of `Access` entries. Each entry maps an access type to a set of role IDs. See `submission/submission-access.md` for the full `AccessType` enumeration and per-value semantics — the access types themselves are the same set used at every layer.

```json
{
  "access": [
    { "type": "create_all", "roles": ["5f8d0c4e9b1e8a0017a10001"] },
    { "type": "read_all",   "roles": ["5f8d0c4e9b1e8a0017a10002"] },
    { "type": "team_admin", "roles": ["5f8d0c4e9b1e8a0017a10003"] }
  ]
}
```

## Supporting types

The `Project` envelope ships with a small family of types that describe project access in aggregate (used by import/export and admin endpoints).

### ProjectRole

| Property      | Type      | Description                                                                                              |
| ------------- | --------- | -------------------------------------------------------------------------------------------------------- |
| `_id`         | `string`  | Role ID (MongoDB ObjectId).                                                                              |
| `title`       | `string`  | Display title of the role.                                                                               |
| `description` | `string`  | Free-text description.                                                                                   |
| `admin`       | `boolean` | `true` if the role grants administrative privileges within the project.                                  |
| `default`     | `boolean` | `true` if this role is assigned by default to new users created in this project.                         |

`ProjectRole` is the same role document shipped by the project-roles API; it is reproduced here as a convenience type for the `ProjectAccessInfo.roles` map.

### ProjectFormAccess

| Property           | Type        | Description                                                                                            |
| ------------------ | ----------- | ------------------------------------------------------------------------------------------------------ |
| `_id`              | `string`    | Form ID.                                                                                               |
| `title`            | `string`    | Form title.                                                                                            |
| `name`             | `string`    | Form machine name.                                                                                     |
| `path`             | `string`    | Form URL path.                                                                                         |
| `access`           | `Access[]`  | Form-level access entries (who can see/modify the form definition).                                    |
| `submissionAccess` | `Access[]`  | Submission-level access entries (who can create/read/update/delete submissions against the form).      |

`ProjectFormAccess` is the per-form access summary the platform uses when reporting "what does the access matrix look like across this project's forms" — used by admin tooling.

### ProjectAccessInfo

| Property | Type                                       | Description                                                                                            |
| -------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| `roles`  | `Record<string, ProjectRole>`              | Map of role ID → `ProjectRole` for every role defined in the project.                                  |
| `forms`  | `Record<string, ProjectFormAccess>`        | Map of form ID → `ProjectFormAccess` for every form whose access matrix is being reported.             |

`ProjectAccessInfo` is the project-wide access snapshot — `roles` lists every role available to be granted, and `forms` lists each form's access posture. Useful when implementing project-admin UIs or when verifying an import/export round-trip.

## See also

- `project-definition.md` — where `access` sits on the Project envelope.
- `submission/submission-access.md` — full `AccessType` value enumeration and per-value semantics.
- `references/form/form-definition.md` — form-level `access` and `submissionAccess` arrays.
