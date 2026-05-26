## MODIFIED Requirements

### Requirement: form_create tool is registered with skill-referencing description

The `form_create` tool SHALL be registered on the MCP server with a description that instructs the LLM to use the `formio-schema` skill to construct the form JSON definition before calling this tool. The description SHALL reference the skill by name so the LLM knows to invoke it for schema guidance. The description SHALL NOT reference `formio-form`.

#### Scenario: Tool appears in tool listing with skill reference

- **WHEN** the MCP server is initialized with valid configuration
- **THEN** the `form_create` tool is available with a required `form` parameter accepting a JSON object
- **AND** the tool description instructs the LLM to use the `formio-schema` skill to build the form JSON
- **AND** the tool description does not contain the string `formio-form`
