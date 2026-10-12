## ADDED Requirements

### Requirement: action_type_list lists the action types a form supports

The server SHALL register `action_type_list` (replacing `action_types_list`), taking `cwd` and `formId`, and returning the whole action-type catalog Form.io reports for that form in the shared list result shape.

#### Scenario: Listing action types

- **WHEN** `action_type_list` is called for a form
- **THEN** it returns each type's `name`, `title` and `description`, with `hasMore: false`

## REMOVED Requirements

### Requirement: action_types_list tool is registered

**Reason**: Renamed to `action_type_list` for singular tool names.
**Migration**: Call `action_type_list`.

### Requirement: action_types_list retrieves available action types

**Reason**: Superseded by `action_type_list`.
**Migration**: Call `action_type_list` with the same `formId`.
