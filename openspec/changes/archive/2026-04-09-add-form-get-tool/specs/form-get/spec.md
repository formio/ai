## ADDED Requirements

### Requirement: form_get tool is registered

The `form_get` tool SHALL be registered on the MCP server with a description and parameter schema.

#### Scenario: Tool appears in tool listing

- **WHEN** the MCP server is initialized with valid configuration
- **THEN** the `form_get` tool is available with a required `formIdOrPath` parameter and an optional `select` parameter

### Requirement: form_get retrieves a single form by ID or path alias

The `form_get` tool SHALL call `GET {projectUrl}/form/{id}` when the input is a MongoDB ObjectId (24-character hex string), and `GET {projectUrl}/{alias}` when the input is a path alias. The `x-token` header SHALL be set and the complete form JSON returned.

#### Scenario: Fetch form by MongoDB ID

- **WHEN** `form_get` is called with `formIdOrPath: "67890abcdef012345678abcd"`
- **THEN** it requests `/form/67890abcdef012345678abcd` with the `x-token` header
- **AND** returns the full form JSON as MCP text content

#### Scenario: Fetch form by multi-segment path alias

- **WHEN** `form_get` is called with `formIdOrPath: "user/login"`
- **THEN** it requests `/user/login` with the `x-token` header
- **AND** returns the full form JSON as MCP text content

#### Scenario: Fetch form by single-segment path alias

- **WHEN** `form_get` is called with `formIdOrPath: "example"`
- **THEN** it requests `/example` with the `x-token` header
- **AND** returns the full form JSON as MCP text content

### Requirement: form_get supports field selection

The `form_get` tool SHALL accept an optional `select` parameter to limit the returned fields.

#### Scenario: Custom field selection

- **WHEN** `form_get` is called with `formIdOrPath: "67890abc"` and `select: "_id,title,components"`
- **THEN** the request includes `select=_id,title,components` in the query parameters

#### Scenario: No select parameter returns full form

- **WHEN** `form_get` is called with only `formIdOrPath: "67890abc"`
- **THEN** the request does not include a `select` query parameter
- **AND** the full form JSON is returned

### Requirement: form_get returns MCP-formatted content

The tool SHALL return results as MCP text content containing the JSON object.

#### Scenario: Successful response

- **WHEN** the Form.io API returns a JSON form object
- **THEN** the tool returns `{ content: [{ type: "text", text: <JSON string> }] }`

#### Scenario: API error

- **WHEN** the Form.io API returns an error (e.g., 404 Not Found)
- **THEN** the tool returns an error response with `isError: true` and a descriptive message
