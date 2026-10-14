## Purpose

Defines the `project_import` MCP tool: the template object it accepts and the `POST /import` call that merges roles, resources, forms, and actions into the active project.
## Requirements
### Requirement: project_import tool is registered with skill-referencing description

The `project_import` tool SHALL be registered on the MCP server with a description that instructs the LLM to use the `formio-resource-planner` skill to construct the template JSON before calling this tool. The description SHALL state what the import replaces — every form it names is updated in place with its actions deleted and recreated from the template, and a template's `access` replaces the project's access lists — and that it is for a first build into a project with no content of its own; later changes are made with the form, role, and action tools. It SHALL NOT describe the import as a merge that does not replace.

#### Scenario: Tool appears in tool listing with skill reference

- **WHEN** the MCP server is initialized with valid configuration
- **THEN** the `project_import` tool is available with a required `template` parameter accepting a JSON object
- **AND** the tool description references the `formio-resource-planner` skill

### Requirement: project_import accepts a template object

The `project_import` tool SHALL accept a `template` parameter containing the template JSON object with `title`, `name`, `version`, `roles`, `resources`, `forms`, and `actions` fields. The tool SHALL wrap this in `{ "template": ... }` before sending to the API.

#### Scenario: Minimum valid template

- **WHEN** `project_import` is called with `template: { title: "My App", name: "myApp", version: "2.0.0", roles: {}, resources: {}, forms: {}, actions: {} }`
- **THEN** it sends a POST request to `/import` with body `{ "template": <the template object> }`

### Requirement: project_import creates resources via POST /import

The `project_import` tool SHALL call `POST {projectUrl}/import` with the authentication header and the wrapped template as the JSON body.

#### Scenario: Successful import

- **WHEN** the Form.io API returns a 200 response with text "Ok"
- **THEN** the tool returns `{ content: [{ type: "text", text: "Ok" }] }`

#### Scenario: Malformed template

- **WHEN** the Form.io API returns a 400 response for a malformed or incompatible template
- **THEN** the tool returns an error response with `isError: true` and a descriptive message

#### Scenario: API error

- **WHEN** the Form.io API returns an error (e.g., 401 Unauthorized)
- **THEN** the tool returns an error response with `isError: true` and a descriptive message

### Requirement: The template's shape is checked before it is sent

`project_import` SHALL refuse, with code `INVALID_ARGUMENT` and no request, a `template` whose `forms` or `resources` is missing or is not a plain object (an empty object is accepted), or whose `roles` or `actions`, when present, is not a plain object. The message SHALL name the key and say that Form.io templates key each entry by machine name.

#### Scenario: A template with no resources

- **WHEN** `project_import` is called with `{ forms: { contact: {...} } }`
- **THEN** the tool returns `INVALID_ARGUMENT` naming `resources`
- **AND** no request is sent

#### Scenario: Arrays instead of objects

- **WHEN** `project_import` is called with `forms: []`
- **THEN** the tool returns `INVALID_ARGUMENT` naming `forms`

#### Scenario: A valid template

- **WHEN** `project_import` is called with `{ roles: {}, resources: {}, forms: { contact: {...} }, actions: {} }`
- **THEN** the template is sent

### Requirement: project_import is not annotated idempotent

`project_import` SHALL carry `idempotentHint: false`: each import recreates the actions of every form it names under new ids, and a timed-out import is not retried blind.

#### Scenario: Annotation

- **WHEN** `tools/list` is read
- **THEN** `project_import`'s annotations have `idempotentHint: false`

