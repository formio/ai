## ADDED Requirements

### Requirement: role_create takes a nested role object

`role_create` SHALL take `cwd` and a `role` object (`title` required; `description`, `default`, `admin` optional), matching `role_update`, and SHALL POST it to `{projectUrl}/role`, returning the created role.

#### Scenario: Creating a role

- **WHEN** `role_create` is called with `role: { title: "Manager" }`
- **THEN** a POST to `/role` carries `{ title: "Manager" }` and the created role is returned

## REMOVED Requirements

### Requirement: role_create creates a new role

**Reason**: The flat `title` / `description` / `default` / `admin` arguments differed from every other create and update tool.
**Migration**: Pass the same fields inside `role`.
