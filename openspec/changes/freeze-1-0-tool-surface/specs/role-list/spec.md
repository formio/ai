## ADDED Requirements

### Requirement: role_list pages the project's roles

`role_list` SHALL take `cwd` and the shared list arguments and SHALL return the shared list result of roles.

#### Scenario: All roles are reachable

- **WHEN** a project has 12 roles and `role_list` is called with no arguments
- **THEN** all 12 are returned with `total: 12`

## REMOVED Requirements

### Requirement: role_list retrieves all project roles

**Reason**: It sent no `limit`, so Form.io's default of 10 truncated the result; replaced by the shared list contract.
**Migration**: Read `total` and `hasMore` instead of `count`.
