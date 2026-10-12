## Purpose

Defines the MCP tools that discover what actions a connected deployment supports: `action_types_list` for the catalog and `action_type_get` for one type's settings form, including what the latter returns when the action name is unknown.
## Requirements
### Requirement: action_type_get tool is registered

The `action_type_get` tool SHALL be registered on the MCP server with a description that instructs the LLM to call this tool before creating an action to discover the required settings schema. It SHALL accept required `formId` and `actionName` parameters.

#### Scenario: Tool appears in tool listing with discovery guidance

- **WHEN** the MCP server is initialized with valid configuration
- **THEN** the `action_type_get` tool is available with required `formId` and `actionName` parameters
- **AND** the tool description instructs the LLM to call this tool before `action_create` to discover the settings schema

### Requirement: action_type_get retrieves action type info and settings form

The `action_type_get` tool SHALL call `GET {projectUrl}/form/{formId}/actions/{actionName}` and return the action type descriptor including the settingsForm.

#### Scenario: Successful retrieval

- **WHEN** `action_type_get` is called with a valid `formId` and `actionName` (e.g., "email")
- **THEN** it sends a GET request to `/form/{formId}/actions/{actionName}`
- **AND** returns the action type object including settingsForm as MCP text content

### Requirement: action_type_get returns available types on invalid action name

When the requested action type is not available on the connected server, the tool SHALL fetch the action type catalog and return an error listing the available types.

#### Scenario: Unknown action type returns available types

- **WHEN** `action_type_get` is called with `actionName: "oauth"` and the server does not support that type
- **THEN** the tool fetches `GET /form/{formId}/actions` to get the catalog
- **AND** returns an error with `isError: true` containing the message "Action type 'oauth' is not available on this server. Available types: email, login, save, role, resetpass, webhook"

#### Scenario: API error on catalog fetch also handled

- **WHEN** `action_type_get` fails for the requested type and the catalog fetch also fails
- **THEN** the tool returns an error response with `isError: true` and the original error message

### Requirement: action_type_list lists the action types a form supports

The server SHALL register `action_type_list` (replacing `action_types_list`), taking `cwd` and `formId`, and returning the whole action-type catalog Form.io reports for that form in the shared list result shape.

#### Scenario: Listing action types

- **WHEN** `action_type_list` is called for a form
- **THEN** it returns each type's `name`, `title` and `description`, with `hasMore: false`

