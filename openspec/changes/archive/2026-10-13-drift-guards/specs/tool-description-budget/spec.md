## MODIFIED Requirements

### Requirement: The tool list fits a measured budget

The serialized `tools/list` result SHALL NOT exceed 42,000 characters, and a test SHALL measure it. No input or output schema in it SHALL carry a `$schema` key: it names the JSON Schema draft on every schema and tells a caller nothing it acts on. The `cwd` argument description SHALL NOT exceed 100 characters, and SHALL state that the argument is optional and that it defaults to the client's workspace root; when to pass it, and the order a directory is chosen in, SHALL be stated in the server instructions, which every client receives once. A tool description SHALL carry what a caller acts on — when to use the tool, what it requires, what it returns, and the refusals it can raise — and SHALL NOT carry change history or design rationale, which belong in the README or code comments.

#### Scenario: The budget is enforced

- **WHEN** the test suite lists every registered tool
- **THEN** the serialized result is at most 42,000 characters

#### Scenario: The cwd description is short

- **WHEN** any tool's `cwd` argument is inspected
- **THEN** its description is at most 100 characters, says the argument is optional, and says it defaults to the client's workspace root

#### Scenario: The full cwd rules stay in the server instructions

- **WHEN** the server instructions are read
- **THEN** they state the order a directory is chosen in and that a caller passes `cwd` when `project_get` reports `cwdSource` `"server"` or `"claude-project-dir"`, or to target another directory

#### Scenario: No per-schema $schema key

- **WHEN** `tools/list` is serialized
- **THEN** no input or output schema carries a `$schema` key
