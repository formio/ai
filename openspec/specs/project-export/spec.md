## Requirements

### Requirement: project_export tool is registered with descriptive text

The `project_export` tool SHALL be registered on the MCP server with a description that explains it exports the project's complete template (roles, resources, forms, actions) as a portable JSON document. The description SHALL mention using this to snapshot a project before importing changes.

#### Scenario: Tool appears in tool listing

- **WHEN** the MCP server is initialized with valid configuration
- **THEN** the `project_export` tool is available with no required parameters

### Requirement: project_export calls GET /export

The `project_export` tool SHALL call `GET {projectUrl}/export` with the authentication header.

#### Scenario: Successful export

- **WHEN** the Form.io API returns a 200 response with the project template JSON
- **THEN** the tool returns `{ content: [{ type: "text", text: <JSON string of template> }] }`

#### Scenario: API error

- **WHEN** the Form.io API returns an error (e.g., 401 Unauthorized)
- **THEN** the tool returns an error response with `isError: true` and a descriptive message
