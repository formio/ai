## Purpose

Defines the `form_update` MCP tool: the form ID and definition it accepts, the `PUT /form/{formId}` call it makes, the note it requires, its draft, publish, and revert flags, and the per-form tracking gate applied to standard writes.
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

### Requirement: form_update saves a form or its draft from the body it is given

`form_update` SHALL take `cwd`, `formId` (a 24-character ObjectId), `form`, a required `note`, an optional `draft: boolean`, and an optional `acceptNoHistory: boolean`. Without `draft` it SHALL PUT the form. With `draft: true` it SHALL save the draft from the allowlisted draft fields of `form` (`components`, `settings`, `tags`, `properties`, `controller`, `esign`, `display`). It SHALL ignore the server-owned fields `form_get` returns (`_id`, `_vid`, `_rid`, `revisionId`, `created`, `modified`, `owner`, `project`, `machineName`, and the like), and SHALL ignore a caller-editable non-draft field (`title`, `name`, `path`, `type`, `action`, `access`, `submissionAccess`, `fieldMatchAccess`, `revisions`, `submissionRevisions`, `pdfComponents`, `translationsUrl`) whose value equals the stored one — the stored draft's, or the live form's where a draft exists. A caller-editable non-draft field whose value differs from both SHALL be refused with code `INVALID_ARGUMENT`, naming the field and saying to save it with `form_update` without `draft`, and nothing SHALL be written. It SHALL NOT accept `publish`, `revert` or `version`; publishing and reverting are `form_publish` and `form_revert`.

#### Scenario: Saving a draft from form_get's output

- **WHEN** `form_update` is called with `draft: true` and a `form` returned by `form_get` (carrying `_id`, `title`, `path`, `created`)
- **THEN** the draft is saved with that form's allowlisted fields
- **AND** no error is returned for the other fields

#### Scenario: A changed non-draft field in a draft body is refused

- **WHEN** `form_update` is called with `draft: true` and a `form` whose `title` or `path` differs from the stored form's
- **THEN** the tool returns `isError: true` with `_meta["io.form/error"].code` `INVALID_ARGUMENT`, naming the field and `form_update` without `draft`
- **AND** nothing is written

#### Scenario: Publish and revert are separate tools

- **WHEN** `form_update` is listed
- **THEN** its input schema has no `publish`, `revert` or `version` argument

