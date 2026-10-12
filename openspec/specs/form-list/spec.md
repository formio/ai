## Purpose

Defines the `form_list` MCP tool: retrieving form summaries for the active project and the MCP content it returns.
## Requirements
### Requirement: form_list tool is registered

The `form_list` tool SHALL be registered on the MCP server with a description and parameter schema.

#### Scenario: Tool appears in tool listing

- **WHEN** the MCP server is initialized with valid configuration
- **THEN** the `form_list` tool is available with parameters for type, limit, skip, sort, select, and tags

### Requirement: form_list returns MCP-formatted content

The tool SHALL return results as MCP text content containing the JSON array.

#### Scenario: Successful response

- **WHEN** the Form.io API returns a JSON array of forms
- **THEN** the tool returns `{ content: [{ type: "text", text: <JSON string> }] }`

#### Scenario: API error

- **WHEN** the Form.io API returns an error
- **THEN** the tool returns an error response with `isError: true` and a descriptive message

### Requirement: form_list pages forms and filters by tags

`form_list` SHALL take `cwd`, an optional `type` (`form` or `resource`), an optional `tags` array, and the shared list arguments, and SHALL return the shared list result of form summaries. `tags` SHALL match forms that carry every given tag.

#### Scenario: Two tags

- **WHEN** `form_list` is called with `tags: ["crm", "intake"]`
- **THEN** the request filters with `tags__all=crm,intake`
- **AND** only forms carrying both tags are returned

