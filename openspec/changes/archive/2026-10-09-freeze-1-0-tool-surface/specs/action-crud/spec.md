## ADDED Requirements

### Requirement: action_list pages a form's actions

`action_list` SHALL take `cwd`, `formId`, and the shared list arguments and SHALL return the shared list result of actions.

#### Scenario: More actions than Form.io's default page

- **WHEN** a form has 11 actions and `action_list` is called with no paging arguments
- **THEN** all 11 are returned with `total: 11`

### Requirement: Action tools address forms by ObjectId

Every action tool (`action_list`, `action_get`, `action_create`, `action_update`, `action_delete`, `action_type_list`, `action_type_get`) SHALL take `formId` as a 24-character ObjectId and refuse any other value with code `INVALID_ARGUMENT`, because Form.io's action-type catalog route does not resolve a form path.

#### Scenario: A form path is refused with the remedy

- **WHEN** `action_list` is called with `formId: "user/login"`
- **THEN** the result has code `INVALID_ARGUMENT` and the message tells the agent to read the form's `_id` with `form_get`

## REMOVED Requirements

### Requirement: action_list retrieves actions configured on a form

**Reason**: It sent no `limit`, so Form.io's default of 10 truncated the result; replaced by the shared list contract.
**Migration**: Read `total` and `hasMore` instead of `count`.
