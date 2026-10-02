## ADDED Requirements

### Requirement: Five submission tools are registered through the tool registry

The server SHALL register `submission_create`, `submission_get`, `submission_list`, `submission_update`, and `submission_delete` from `registerAllTools`, each with the shared `cwd` parameter and each resolving its project per call like every other project-scoped tool. Every description SHALL state that the tool reaches only submissions this server created and signed for the calling working directory, and SHALL name `plugin/skills/formio-mcp-setup/references/agent-submissions.md` as the rules for using it. The `.mcpb` manifest tool list SHALL include all five.

#### Scenario: The tools appear with their scope stated

- **WHEN** the server lists its tools
- **THEN** all five `submission_*` tools are present, each with `cwd` and a description stating the created-and-signed scope

#### Scenario: An unconfigured directory fails like every other tool

- **WHEN** any `submission_*` tool is called from a directory with no resolvable project
- **THEN** it returns the same unresolved-project error the other project-scoped tools return, naming `project_set`

### Requirement: Annotations match each tool's effect

`submission_get` and `submission_list` SHALL use the `reads` preset, `submission_create` the `creates` preset, `submission_update` the `overwrites` preset, and `submission_delete` the `removes` preset.

#### Scenario: Read tools are marked read-only

- **WHEN** the tool list is inspected
- **THEN** `submission_get` and `submission_list` carry `readOnlyHint: true`, and the three write tools do not

### Requirement: submission_create writes one submission for a stated purpose

`submission_create` SHALL require `formIdOrPath`, `data` (an object), and `purpose` (`"reference-data"` or `"test"`). It SHALL resolve the form to its `_id`, run the dry run, sign, and `POST {projectUrl}/form/{formId}/submission`. It SHALL return the created record in the shape the scope capability defines, plus the names of any actions on the form whose `method` includes `create` — the effects the write triggered.

#### Scenario: Seeding a reference resource

- **WHEN** `submission_create` is called with `formIdOrPath: "category"`, `data: { name: "Hardware" }`, `purpose: "reference-data"`
- **THEN** one dry-run `POST` and one real `POST` are sent to `/form/{categoryId}/submission`, and the result carries the new `_id` and `purpose: "reference-data"`

#### Scenario: A validation failure is reported without a write

- **WHEN** the dry run returns a 400 validation error
- **THEN** no real `POST` is sent and the tool returns `isError: true` with the server's validation details

### Requirement: submission_list returns the calling directory's verified records

`submission_list` SHALL require `formIdOrPath` and accept optional `purpose`, `filters` (an object of `data.*` keys to string values, with the operator suffixes the scope capability allows), `limit` (1–100, default 25), `skip`, and `sort` (a `data.*`, `created`, or `modified` key, optionally prefixed with `-`). It SHALL call `GET {projectUrl}/form/{formId}/submission` with the query the scope capability defines and return the verified records plus `returned` and `dropped` counts.

#### Scenario: Listing test rows for cleanup

- **WHEN** `submission_list` is called with `purpose: "test"`
- **THEN** the query includes `metadata.agent.purpose=test`, and only verified test records are returned

#### Scenario: Dropped records are counted, not described

- **WHEN** two returned records fail verification
- **THEN** the result has `dropped: 2` and no field from either record

### Requirement: submission_get, submission_update, and submission_delete act by id on verified records

`submission_get` SHALL require `formIdOrPath` and `submissionId`, call `GET {projectUrl}/form/{formId}/submission/{submissionId}`, and return the verified record. `submission_update` SHALL require `formIdOrPath`, `submissionId`, and `data`, and SHALL replace the record's `data` with a `PUT` after the dry run and re-signing. `submission_delete` SHALL require `formIdOrPath` and `submissionId` and SHALL send `DELETE` only after verification. Update and delete results SHALL name the actions on the form whose `method` includes `update` or `delete` respectively.

#### Scenario: Deleting an agent test row

- **WHEN** `submission_delete` targets a verified test record
- **THEN** one `GET` and one `DELETE` are sent and the result confirms the deletion

#### Scenario: A 404 from Form.io reads the same as a failed verification

- **WHEN** Form.io returns 404 for the id
- **THEN** the tool returns the same not-found result a failed verification produces

### Requirement: The server instructions state the scope once

The MCP server's `instructions` text SHALL state that the submission tools reach only submissions the server created and signed for the calling directory, that the agent does not read other submissions by any route, and that `action_list` is checked before a submission is written.

#### Scenario: A client without the skills sees the rule

- **WHEN** a client connects and reads the server instructions
- **THEN** the instructions include the scope rule and the `action_list` check
