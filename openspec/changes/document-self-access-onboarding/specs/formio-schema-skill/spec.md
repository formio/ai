## ADDED Requirements

### Requirement: The self access type is described

`references/form/form-definition.md` SHALL describe what the `self` access type does, and `references/submission/submission-definition.md` SHALL state beside the `owner` property that a user's access to their own record comes from Self Access, linking to `formio-auth`'s `roles-and-permissions.md`.

#### Scenario: Form definition describes self

- **WHEN** `form-definition.md` is read
- **THEN** it describes `self` as giving a user access to their own record
