## ADDED Requirements

### Requirement: The tool list fits a measured budget

The serialized `tools/list` result SHALL NOT exceed 50,000 characters, and a test SHALL measure it. The `cwd` argument description SHALL NOT exceed 200 characters, and SHALL state what to pass (the user's working directory, absolute) and where the full rules are (the server instructions and `project_set`). A tool description SHALL carry what a caller acts on — when to use the tool, what it requires, what it returns, and the refusals it can raise — and SHALL NOT carry change history or design rationale, which belong in the README or code comments.

#### Scenario: The budget is enforced

- **WHEN** the test suite lists every registered tool
- **THEN** the serialized result is at most 50,000 characters

#### Scenario: The cwd description is short

- **WHEN** any tool's `cwd` argument is inspected
- **THEN** its description is at most 200 characters and names the user's working directory
