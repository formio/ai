## ADDED Requirements

### Requirement: Access shapes MUST match the server's access schema

- `references/submission/submission-access.md` SHALL state that a submission's `access` is computed by the server — cleared on every create and update and rebuilt from the form's component-level `submissionAccess` — so a client never sets it.
- Submission access examples SHALL use the submission access types `read`, `create`, `update`, `delete`, `write`, and `admin`, keyed by `resources`.
- `references/form/form-definition.md` SHALL list every form access type, including `read_own` and `self`.
- `references/project/project-access.md` SHALL NOT state that every layer uses the same access types: projects and forms use role-keyed types, submissions a resource-keyed set.

#### Scenario: Submission access is server-computed

- **WHEN** `submission-access.md` is read
- **THEN** it states that the server sets `access` and does not present it as a field the client writes

#### Scenario: No read_all in submission access

- **WHEN** the submission definition example is parsed
- **THEN** its `access` entries use the submission access types, not `read_all`
