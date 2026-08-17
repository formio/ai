## Requirements

### Requirement: action_create tool is registered

The `action_create` tool SHALL be registered on the MCP server with a description that instructs the LLM to call `action_type_get` first to discover the settings schema. It SHALL accept required `formId` and `action` parameters.

#### Scenario: Tool appears in tool listing with discovery guidance

- **WHEN** the MCP server is initialized with valid configuration
- **THEN** the `action_create` tool is available with required `formId` and `action` parameters
- **AND** the tool description instructs the LLM to call `action_type_get` first

### Requirement: action_create accepts an action definition

The `action_create` tool SHALL require `name`, `title`, `handler`, and `method` in the action definition. It SHALL accept `settings` as a flexible record and `condition` as an optional conjunction-based object. `priority` SHALL be optional.

#### Scenario: Minimum valid action definition

- **WHEN** `action_create` is called with `action: { name: "email", title: "Email", handler: ["after"], method: ["create"] }`
- **THEN** it sends a POST request to `/form/{formId}/action` with the action definition as the JSON body

#### Scenario: Action with settings and condition

- **WHEN** `action_create` is called with `action: { name: "email", title: "Email", handler: ["after"], method: ["create"], priority: 0, settings: { transport: "default", from: "no-reply@example.com", emails: ["user@example.com"], subject: "New submission", message: "{{ submission }}" }, condition: { conjunction: "all", conditions: [{ component: "status", operator: "isEqual", value: "approved" }] } }`
- **THEN** it sends a POST request to `/form/{formId}/action` with all provided fields in the JSON body

### Requirement: action_create validates action type against server catalog

Before creating the action, the tool SHALL validate that the `name` field matches an available action type on the server.

#### Scenario: Valid action type proceeds

- **WHEN** `action_create` is called with `name: "email"` and the server supports "email"
- **THEN** the action is created via POST

#### Scenario: Invalid action type returns available types

- **WHEN** `action_create` is called with `name: "oauth"` and the server does not support "oauth"
- **THEN** the tool returns an error with `isError: true` listing available action types

### Requirement: action_create creates the action via POST

The `action_create` tool SHALL call `POST {projectUrl}/form/{formId}/action` with the action definition as the JSON body.

#### Scenario: Successful creation

- **WHEN** the Form.io API returns a success response with the created action JSON
- **THEN** the tool returns `{ content: [{ type: "text", text: <JSON string of created action> }] }`

#### Scenario: API error

- **WHEN** the Form.io API returns an error (e.g., 400 Bad Request)
- **THEN** the tool returns an error response with `isError: true` and a descriptive message

### Requirement: action_list tool is registered

The `action_list` tool SHALL be registered on the MCP server with a required `formId` parameter.

#### Scenario: Tool appears in tool listing

- **WHEN** the MCP server is initialized with valid configuration
- **THEN** the `action_list` tool is available with a required `formId` parameter

### Requirement: action_list retrieves actions configured on a form

The `action_list` tool SHALL call `GET {projectUrl}/form/{formId}/action` and return the array of action instances.

#### Scenario: Successful listing

- **WHEN** `action_list` is called with a valid `formId`
- **THEN** it sends a GET request to `/form/{formId}/action`
- **AND** returns the array of action objects as MCP text content

#### Scenario: API error

- **WHEN** the Form.io API returns an error
- **THEN** the tool returns an error response with `isError: true` and a descriptive message

### Requirement: action_get tool is registered

The `action_get` tool SHALL be registered on the MCP server with required `formId` and `actionId` parameters.

#### Scenario: Tool appears in tool listing

- **WHEN** the MCP server is initialized with valid configuration
- **THEN** the `action_get` tool is available with required `formId` and `actionId` parameters

### Requirement: action_get retrieves a single action

The `action_get` tool SHALL call `GET {projectUrl}/form/{formId}/action/{actionId}` and return the action document.

#### Scenario: Successful retrieval

- **WHEN** `action_get` is called with valid `formId` and `actionId`
- **THEN** it sends a GET request to `/form/{formId}/action/{actionId}`
- **AND** returns the action JSON as MCP text content

#### Scenario: API error

- **WHEN** the Form.io API returns an error (e.g., 404 Not Found)
- **THEN** the tool returns an error response with `isError: true` and a descriptive message

### Requirement: action_update tool is registered

The `action_update` tool SHALL be registered on the MCP server with required `formId`, `actionId`, and `action` parameters. The `action` parameter accepts the same shape as `action_create`.

#### Scenario: Tool appears in tool listing

- **WHEN** the MCP server is initialized with valid configuration
- **THEN** the `action_update` tool is available with required `formId`, `actionId`, and `action` parameters

### Requirement: action_update updates an action via PUT

The `action_update` tool SHALL call `PUT {projectUrl}/form/{formId}/action/{actionId}` with the action definition as the JSON body.

#### Scenario: Successful update

- **WHEN** the Form.io API returns a success response with the updated action JSON
- **THEN** the tool returns `{ content: [{ type: "text", text: <JSON string of updated action> }] }`

#### Scenario: API error

- **WHEN** the Form.io API returns an error (e.g., 404 Not Found)
- **THEN** the tool returns an error response with `isError: true` and a descriptive message

### Requirement: action_delete tool is registered

The `action_delete` tool SHALL be registered on the MCP server with required `formId` and `actionId` parameters.

#### Scenario: Tool appears in tool listing

- **WHEN** the MCP server is initialized with valid configuration
- **THEN** the `action_delete` tool is available with required `formId` and `actionId` parameters

### Requirement: action_delete removes an action via DELETE

The `action_delete` tool SHALL call `DELETE {projectUrl}/form/{formId}/action/{actionId}`.

#### Scenario: Successful deletion

- **WHEN** the Form.io API returns a success response
- **THEN** the tool returns `{ content: [{ type: "text", text: "OK" }] }`

#### Scenario: API error

- **WHEN** the Form.io API returns an error (e.g., 404 Not Found)
- **THEN** the tool returns an error response with `isError: true` and a descriptive message
