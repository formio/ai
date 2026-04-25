## ADDED Requirements

### Requirement: role_create tool is registered

The `role_create` tool SHALL be registered on the MCP server with a description and parameter schema.

#### Scenario: Tool appears in tool listing

- **WHEN** the MCP server is initialized with valid configuration
- **THEN** the `role_create` tool is available with parameters for title (required), description, default, and admin

### Requirement: role_create creates a new role

The `role_create` tool SHALL call `POST {projectUrl}/role` with the role document in the request body and return the created role.

#### Scenario: Create role with title only

- **WHEN** `role_create` is called with `title: "Employee"`
- **THEN** it sends `POST /role` with body `{"title": "Employee"}`
- **AND** returns the created role document as MCP text content

#### Scenario: Create role with all fields

- **WHEN** `role_create` is called with `title: "Manager"`, `description: "A management role"`, `default: false`, `admin: false`
- **THEN** the request body includes all four fields

#### Scenario: Create role with default flag

- **WHEN** `role_create` is called with `title: "Member"`, `default: true`
- **THEN** the request body includes `"default": true`

### Requirement: role_create returns MCP-formatted content

The tool SHALL return results as MCP text content containing the created role document.

#### Scenario: Successful creation

- **WHEN** the Form.io API returns the created role document
- **THEN** the tool returns `{ content: [{ type: "text", text: <JSON string> }] }`

#### Scenario: API error

- **WHEN** the Form.io API returns an error (e.g., 400 for missing title)
- **THEN** the tool returns an error response with `isError: true` and a descriptive message
