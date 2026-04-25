## ADDED Requirements

### Requirement: form_create tool is registered with skill-referencing description

The `form_create` tool SHALL be registered on the MCP server with a description that instructs the LLM to use the `formio-form` skill to construct the form JSON definition before calling this tool. The description SHALL reference the skill by name so the LLM knows to invoke it for schema guidance.

#### Scenario: Tool appears in tool listing with skill reference

- **WHEN** the MCP server is initialized with valid configuration
- **THEN** the `form_create` tool is available with a required `form` parameter accepting a JSON object
- **AND** the tool description instructs the LLM to use the `formio-form` skill to build the form JSON

### Requirement: form_create accepts a form definition with required fields

The `form_create` tool SHALL require `title`, `name`, `path`, and `components` in the form definition and accept optional fields.

#### Scenario: Minimum valid form definition

- **WHEN** `form_create` is called with `form: { title: "My Form", name: "myForm", path: "myform", components: [] }`
- **THEN** it sends a POST request to `/form` with the form definition as the JSON body

#### Scenario: Full form definition with optional fields

- **WHEN** `form_create` is called with `form: { title: "My Form", name: "myForm", path: "myform", type: "form", display: "wizard", tags: ["test"], components: [...] }`
- **THEN** it sends a POST request to `/form` with all provided fields in the JSON body

### Requirement: form_create creates the form via POST /form

The `form_create` tool SHALL call `POST {projectUrl}/form` with the `x-token` header and the form definition as the JSON body.

#### Scenario: Successful creation

- **WHEN** the Form.io API returns a 201 response with the created form JSON
- **THEN** the tool returns `{ content: [{ type: "text", text: <JSON string of created form> }] }`

#### Scenario: API error

- **WHEN** the Form.io API returns an error (e.g., 400 Bad Request for invalid form)
- **THEN** the tool returns an error response with `isError: true` and a descriptive message
