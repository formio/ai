## ADDED Requirements

### Requirement: form_update tool is registered with workflow guidance

The `form_update` tool SHALL be registered on the MCP server with a description that instructs the LLM to: (1) fetch the current form via `form_get`, (2) use the `formio-form` skill to apply the requested modifications, and (3) call `form_update` with the complete updated form JSON.

#### Scenario: Tool appears in tool listing with workflow guidance

- **WHEN** the MCP server is initialized with valid configuration
- **THEN** the `form_update` tool is available with required `formId` and `form` parameters
- **AND** the tool description references the `form_get` tool and `formio-form` skill

### Requirement: form_update accepts a form ID and updated form definition

The `form_update` tool SHALL require a `formId` string parameter and a `form` object parameter containing the complete updated form definition with at least `components`.

#### Scenario: Update with modified components

- **WHEN** `form_update` is called with `formId: "67890abcdef012345678abcd"` and `form: { title: "Updated Form", components: [...] }`
- **THEN** it sends a PUT request to `/form/67890abcdef012345678abcd` with the form definition as the JSON body

#### Scenario: Update with changed settings

- **WHEN** `form_update` is called with `formId` and a form definition including modified `settings`, `tags`, or `display`
- **THEN** all provided fields are included in the PUT request body

### Requirement: form_update saves the form via PUT /form/{formId}

The `form_update` tool SHALL call `PUT {projectUrl}/form/{formId}` with the `x-token` header and the form definition as the JSON body.

#### Scenario: Successful update

- **WHEN** the Form.io API returns a 200 response with the updated form JSON
- **THEN** the tool returns `{ content: [{ type: "text", text: <JSON string of updated form> }] }`

#### Scenario: API error on update

- **WHEN** the Form.io API returns an error (e.g., 404 Not Found for invalid form ID)
- **THEN** the tool returns an error response with `isError: true` and a descriptive message
