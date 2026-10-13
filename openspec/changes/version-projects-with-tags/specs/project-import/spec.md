## MODIFIED Requirements

### Requirement: project_import tool is registered with skill-referencing description

The `project_import` tool SHALL be registered on the MCP server with a description that instructs the LLM to use the `formio-resource-planner` skill to construct the template JSON before calling this tool. The description SHALL state what the import replaces — every form it names is updated in place with its actions deleted and recreated from the template, and a template's `access` replaces the project's access lists — and that it is for a first build into a project with no content of its own; later changes are made with the form, role, and action tools. It SHALL NOT describe the import as a merge that does not replace.

#### Scenario: Tool appears in tool listing with skill reference

- **WHEN** the MCP server is initialized with valid configuration
- **THEN** the `project_import` tool is available with a required `template` parameter accepting a JSON object
- **AND** the tool description references the `formio-resource-planner` skill
