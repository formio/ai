## Requirements

### Requirement: form_update tool is registered with workflow guidance

The `form_update` tool SHALL be registered on the MCP server with a description that instructs the LLM to: (1) fetch the current form via `form_get`, (2) use the `formio-schema` skill to apply the requested modifications, and (3) call `form_update` with the complete updated form JSON. The description SHALL NOT reference `formio-form`.

#### Scenario: Tool appears in tool listing with workflow guidance

- **WHEN** the MCP server is initialized with valid configuration
- **THEN** the `form_update` tool is available with required `formId` and `form` parameters
- **AND** the tool description references the `form_get` tool and `formio-schema` skill
- **AND** the tool description does not contain the string `formio-form`

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

### Requirement: form_update requires a note

`form_update` SHALL require a `note` string parameter describing the diff between the live form and the updated body. The tool SHALL persist it as `_vnote` on the PUT body, prefixed with `@formio/mcp:`, on every write path (standard update, draft, publish, revert). When the stored form has `revisions` enabled, the server creates a new revision on standard updates as well as on publishes — the note is what surfaces in the revision history for either path. For `revert: true`, when `note` is omitted the tool SHALL default it to `Reverted to version {version}`.

#### Scenario: Note prefixed on standard update

- **WHEN** `form_update` is called with `note: "rename email field"`
- **THEN** the PUT body's `_vnote` equals `@formio/mcp: rename email field`

### Requirement: form_update exposes draft, publish, revert flags

`form_update` SHALL accept `draft`, `publish`, `revert` (booleans) and `version` (string for `revert`). The flags SHALL be mutually exclusive. Behavior of each flag is governed by the `form-revisions` capability.

#### Scenario: Mutually exclusive

- **WHEN** `form_update` is called with `draft: true` and `revert: true`
- **THEN** the tool throws

### Requirement: form_update applies the per-form tracking gate on standard PUTs

A standard `form_update` (none of `draft`/`publish`/`revert`) SHALL run the per-form revisions tracking gate before issuing the PUT. Gate behavior is specified in the `form-revisions` capability.

#### Scenario: Tracking gate runs

- **WHEN** `form_update` is called against a licensed deployment for a form with revisions disabled, no caller opt-in
- **THEN** the tracking gate is invoked before any PUT
