## ADDED Requirements

### Requirement: action_types_list tool is registered

The `action_types_list` tool SHALL be registered on the MCP server with a description and a required `formId` parameter.

#### Scenario: Tool appears in tool listing

- **WHEN** the MCP server is initialized with valid configuration
- **THEN** the `action_types_list` tool is available with a required `formId` parameter

### Requirement: action_types_list retrieves available action types

The `action_types_list` tool SHALL call `GET {projectUrl}/form/{formId}/actions` and return the array of available action type descriptors.

#### Scenario: Successful listing

- **WHEN** `action_types_list` is called with a valid `formId`
- **THEN** it sends a GET request to `/form/{formId}/actions`
- **AND** returns the array of action type objects as MCP text content

#### Scenario: API error

- **WHEN** the Form.io API returns an error (e.g., 404 for invalid formId)
- **THEN** the tool returns an error response with `isError: true` and a descriptive message

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
