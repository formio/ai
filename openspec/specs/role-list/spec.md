## Purpose

Defines the `role_list` MCP tool: retrieving every role on the active project and the MCP content it returns.
## Requirements
### Requirement: role_list tool is registered

The `role_list` tool SHALL be registered on the MCP server with a description and parameter schema.

#### Scenario: Tool appears in tool listing

- **WHEN** the MCP server is initialized with valid configuration
- **THEN** the `role_list` tool is available with an optional `select` parameter

### Requirement: role_list returns MCP-formatted content

The tool SHALL return results as MCP text content containing the JSON array.

#### Scenario: Successful response

- **WHEN** the Form.io API returns a JSON array of roles
- **THEN** the tool returns `{ content: [{ type: "text", text: <JSON string> }] }`

#### Scenario: API error

- **WHEN** the Form.io API returns an error
- **THEN** the tool returns an error response with `isError: true` and a descriptive message

### Requirement: role_list pages the project's roles

`role_list` SHALL take `cwd` and the shared list arguments and SHALL return the shared list result of roles.

#### Scenario: All roles are reachable

- **WHEN** a project has 12 roles and `role_list` is called with no arguments
- **THEN** all 12 are returned with `total: 12`

