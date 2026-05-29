## MODIFIED Requirements

### Requirement: form_update tool is registered with workflow guidance

The `form_update` tool SHALL be registered on the MCP server with a description that instructs the LLM to: (1) fetch the current form via `form_get`, (2) use the `formio-schema` skill to apply the requested modifications, and (3) call `form_update` with the complete updated form JSON. The description SHALL NOT reference `formio-form`.

#### Scenario: Tool appears in tool listing with workflow guidance

- **WHEN** the MCP server is initialized with valid configuration
- **THEN** the `form_update` tool is available with required `formId` and `form` parameters
- **AND** the tool description references the `form_get` tool and `formio-schema` skill
- **AND** the tool description does not contain the string `formio-form`
