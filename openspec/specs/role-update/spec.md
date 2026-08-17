## Purpose

Defines the `role_update` MCP tool: validating the role ID, sending the `PUT` request, and the MCP content it returns.

## Requirements

### Requirement: role_update tool is registered

The `role_update` tool SHALL be registered on the MCP server with a description and parameter schema.

#### Scenario: Tool appears in tool listing

- **WHEN** the MCP server is initialized with valid configuration
- **THEN** the `role_update` tool is available with a required `roleId` parameter and a `role` object parameter

### Requirement: role_update validates roleId format

The `role_update` tool SHALL validate that `roleId` is a 24-character hex string (MongoDB ObjectId) before making the API call.

#### Scenario: Invalid roleId rejected

- **WHEN** `role_update` is called with `roleId: "not-valid"`
- **THEN** the tool returns an error response with `isError: true`
- **AND** the error message indicates the ID format is invalid

### Requirement: role_update sends PUT request

The `role_update` tool SHALL call `PUT {projectUrl}/role/{roleId}` with the role document in the request body. This is a full replacement — all fields in the body replace the existing role document.

#### Scenario: Update role title

- **WHEN** `role_update` is called with `roleId: "69d68310040fa2cea2572945"` and `role: { title: "Senior Employee", description: "Updated role" }`
- **THEN** it sends `PUT /role/69d68310040fa2cea2572945` with the role object as the body
- **AND** returns the updated role document as MCP text content

### Requirement: role_update returns MCP-formatted content

The tool SHALL return results as MCP text content containing the updated role document.

#### Scenario: Successful update

- **WHEN** the Form.io API returns the updated role document
- **THEN** the tool returns `{ content: [{ type: "text", text: <JSON string> }] }`

#### Scenario: API error

- **WHEN** the Form.io API returns an error (e.g., 404 for non-existent role)
- **THEN** the tool returns an error response with `isError: true` and a descriptive message
