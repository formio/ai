## ADDED Requirements

### Requirement: form_create tool is registered with skill-referencing description

The `form_create` tool SHALL be registered on the MCP server with a description that instructs the LLM to use the `formio-schema` skill to construct the form JSON definition before calling this tool. The description SHALL reference the skill by name so the LLM knows to invoke it for schema guidance. The description SHALL NOT reference `formio-form`.

#### Scenario: Tool appears in tool listing with skill reference

- **WHEN** the MCP server is initialized with valid configuration
- **THEN** the `form_create` tool is available with a required `form` parameter accepting a JSON object
- **AND** the tool description instructs the LLM to use the `formio-schema` skill to build the form JSON
- **AND** the tool description does not contain the string `formio-form`

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

### Requirement: form_create defaults revisions to 'original' on licensed deployments

On a licensed deployment, `form_create` SHALL default the POST body to `revisions: 'original'` when the caller does not specify `revisions`. A caller-supplied `revisions` value SHALL override the default. On an unlicensed deployment, `revisions` SHALL be stripped from the body and the license gate SHALL prompt once per `baseUrl`.

#### Scenario: Licensed default

- **WHEN** `form_create` is called on a licensed deployment with `form: { title, name, path, components: [] }` (no `revisions`)
- **THEN** the POST body contains `revisions: 'original'`

#### Scenario: Caller override

- **WHEN** `form_create` is called with `form: { ..., revisions: 'current' }` on a licensed deployment
- **THEN** the POST body contains `revisions: 'current'`

#### Scenario: Unlicensed strips revisions

- **WHEN** `form_create` is called on an unlicensed deployment after the user consents to continue
- **THEN** the POST body does not include `revisions`

### Requirement: form_create persists the note as _vnote

When `note` is provided, `form_create` SHALL include `_vnote` in the POST body prefixed with `@formio/mcp:`.

#### Scenario: Note prefixed

- **WHEN** `form_create` is called with `note: "initial"`
- **THEN** the POST body's `_vnote` equals `@formio/mcp: initial`
