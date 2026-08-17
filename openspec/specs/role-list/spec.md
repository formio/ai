## Requirements

### Requirement: role_list tool is registered

The `role_list` tool SHALL be registered on the MCP server with a description and parameter schema.

#### Scenario: Tool appears in tool listing

- **WHEN** the MCP server is initialized with valid configuration
- **THEN** the `role_list` tool is available with an optional `select` parameter

### Requirement: role_list retrieves all project roles

The `role_list` tool SHALL call `GET {projectUrl}/role` with the `x-jwt-token` header and return a JSON array of role documents.

#### Scenario: Default invocation with no parameters

- **WHEN** `role_list` is called with no arguments
- **THEN** it requests `/role` with no query parameters
- **AND** returns the JSON array as MCP text content

#### Scenario: Custom field selection

- **WHEN** `role_list` is called with `select: "_id,title"`
- **THEN** the request includes `select=_id,title` in the query parameters

### Requirement: role_list returns MCP-formatted content

The tool SHALL return results as MCP text content containing the JSON array.

#### Scenario: Successful response

- **WHEN** the Form.io API returns a JSON array of roles
- **THEN** the tool returns `{ content: [{ type: "text", text: <JSON string> }] }`

#### Scenario: API error

- **WHEN** the Form.io API returns an error
- **THEN** the tool returns an error response with `isError: true` and a descriptive message
