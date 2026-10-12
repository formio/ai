## Purpose

Defines the `role_create` MCP tool: creating a project role and the MCP content it returns.
## Requirements
### Requirement: role_create tool is registered

The `role_create` tool SHALL be registered on the MCP server with a description and parameter schema.

#### Scenario: Tool appears in tool listing

- **WHEN** the MCP server is initialized with valid configuration
- **THEN** the `role_create` tool is available with parameters for title (required), description, default, and admin

### Requirement: role_create returns MCP-formatted content

The tool SHALL return results as MCP text content containing the created role document.

#### Scenario: Successful creation

- **WHEN** the Form.io API returns the created role document
- **THEN** the tool returns `{ content: [{ type: "text", text: <JSON string> }] }`

#### Scenario: API error

- **WHEN** the Form.io API returns an error (e.g., 400 for missing title)
- **THEN** the tool returns an error response with `isError: true` and a descriptive message

### Requirement: role_create takes a nested role object

`role_create` SHALL take `cwd` and a `role` object (`title` required; `description`, `default`, `admin` optional), matching `role_update`, and SHALL POST it to `{projectUrl}/role`, returning the created role.

#### Scenario: Creating a role

- **WHEN** `role_create` is called with `role: { title: "Manager" }`
- **THEN** a POST to `/role` carries `{ title: "Manager" }` and the created role is returned

