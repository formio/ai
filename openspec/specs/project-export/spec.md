## Purpose

Defines the `project_export` MCP tool: its description and the `GET /export` call it makes to snapshot the active project.
## Requirements
### Requirement: project_export tool is registered with descriptive text

The `project_export` tool SHALL be registered on the MCP server with a description that explains it exports the project's complete template (roles, resources, forms, actions) as a portable JSON document. The description SHALL say that with `tag` it exports the template a version tag stored, which is how a workspace's `template.json` is refreshed, and that the project-level access in a tag export comes from the project's current access, because Form.io does not store it with a tag.

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

#### Scenario: Export of a named tag

- **WHEN** `project_export` is called with `tag: "1.2.0"`
- **THEN** it finds that tag's id from `GET {projectUrl}/tag` and returns the `template` that `GET {projectUrl}/tag/:id` stores
- **AND** when the stored template's `access` is an empty array, it is replaced with the `access` of the project's current export
- **AND** a tag name not in the project family returns `NOT_FOUND` naming the tag

