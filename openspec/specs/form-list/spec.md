## Purpose

Defines the `form_list` MCP tool: retrieving form summaries for the active project and the MCP content it returns.

## Requirements

### Requirement: form_list tool is registered

The `form_list` tool SHALL be registered on the MCP server with a description and parameter schema.

#### Scenario: Tool appears in tool listing

- **WHEN** the MCP server is initialized with valid configuration
- **THEN** the `form_list` tool is available with parameters for type, limit, skip, sort, select, and tags

### Requirement: form_list retrieves form summaries

The `form_list` tool SHALL call `GET {projectUrl}/form` with the `x-token` header and return a JSON array of form summaries.

#### Scenario: Default invocation with no parameters

- **WHEN** `form_list` is called with no arguments
- **THEN** it requests `/form` with query `select=_id,title,name,path,type,tags&limit=20`
- **AND** returns the JSON array as MCP text content

#### Scenario: Filter by type

- **WHEN** `form_list` is called with `type: "resource"`
- **THEN** the request includes `type=resource` in the query parameters

#### Scenario: Custom limit

- **WHEN** `form_list` is called with `limit: 5`
- **THEN** the request includes `limit=5` in the query parameters

#### Scenario: Pagination with skip

- **WHEN** `form_list` is called with `skip: 20, limit: 10`
- **THEN** the request includes `skip=20&limit=10` in the query parameters

#### Scenario: Custom sort order

- **WHEN** `form_list` is called with `sort: "-created"`
- **THEN** the request includes `sort=-created` in the query parameters

#### Scenario: Custom field selection overrides default

- **WHEN** `form_list` is called with `select: "_id,title,components"`
- **THEN** the request uses `select=_id,title,components` instead of the default fields

#### Scenario: Filter by tags

- **WHEN** `form_list` is called with `tags: ["survey", "public"]`
- **THEN** the request includes `tags=survey,public` in the query parameters

### Requirement: form_list returns MCP-formatted content

The tool SHALL return results as MCP text content containing the JSON array.

#### Scenario: Successful response

- **WHEN** the Form.io API returns a JSON array of forms
- **THEN** the tool returns `{ content: [{ type: "text", text: <JSON string> }] }`

#### Scenario: API error

- **WHEN** the Form.io API returns an error
- **THEN** the tool returns an error response with `isError: true` and a descriptive message
