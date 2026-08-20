## MODIFIED Requirements

### Requirement: The project-configuration step is skippable and never blocks setup

After writing the client configuration, `formio-mcp-setup` SHALL run `project get` for the user's working directory and SHALL interview only when that command fails. On success it SHALL report the resolved URLs in one line, including which source supplied them, and proceed. On failure it SHALL ask for the one value the message names, persist it with the `project set` command the message names, and re-run the command until it resolves or the user declines.

When the working directory is inside a git repository, the step SHALL offer the choice of scope in the same round it asks for a URL: `--scope repo` records the target in a committed `formio.json` that travels with the code and is reviewable, and the default `user` scope records it in the machine-local mapping. It SHALL state the consequence in one line rather than explaining the whole precedence order — a committed file is shared with everyone who clones the repository, and it overrides a personal mapping. Outside a git repository the step SHALL NOT offer `repo`, because the file would not be tracked by anything.

The step SHALL NOT restate the URL guidance the server owns — the shapes, the plain-language descriptions, the example values — and SHALL NOT reference another skill's document for that wording. It relays what the command says.

The configuration step SHALL remain optional. `formio-mcp-setup` fires from every Form.io skill's preflight, including requests that need no project at all — an API-reference question, a schema question — and from users who have not created a project yet. The step SHALL therefore state plainly that it can be skipped, and skipping SHALL NOT block the client configuration, the reload instruction, or the handoff back to the calling skill.

When the step is skipped, the skill SHALL say that the first Form.io tool call will raise the same actionable message, and SHALL name `project_set` as what will handle it. It SHALL NOT imply the setup failed.

#### Scenario: Setup probes before interviewing

- **WHEN** `formio-mcp-setup` reaches its project step
- **THEN** it runs `project get` with the user's working directory first
- **AND** it interviews only if that command exits non-zero

#### Scenario: Setup offers the committed scope inside a repository

- **WHEN** the working directory is inside a git repository and no project resolves
- **THEN** the step offers recording the target in a committed `formio.json` alongside the machine-local mapping
- **AND** it states in one line that a committed file is shared with everyone who clones the repository

#### Scenario: Setup does not offer the committed scope outside a repository

- **WHEN** the working directory is not inside a git repository
- **THEN** the step does not offer `--scope repo`

#### Scenario: User has no project yet

- **WHEN** the user cannot supply a Project URL
- **THEN** the step is skipped without an error
- **AND** the client configuration and the reload instruction are still delivered
- **AND** the skill names `project_set` as what will capture the project on the first tool call

#### Scenario: Request needs no project

- **WHEN** setup was reached from a preflight for a request that needs no project, such as an API-reference lookup
- **THEN** the skill presents the configuration step as optional rather than required

#### Scenario: A mapping already exists

- **WHEN** `project get --cwd <path>` already resolves a project for the working directory
- **THEN** the skill reports the resolved project and base URL in one line
- **AND** it does not interview

#### Scenario: A half-configured mapping is completed rather than re-interviewed

- **WHEN** `project get` reports a resolved project URL and an unresolved base URL
- **THEN** the skill asks only for the base URL
- **AND** it persists it with the `project set --base-url` command the message names
- **AND** it does not ask for the project URL again

#### Scenario: The step does not restate the server's URL guidance

- **WHEN** `plugin/skills/formio-mcp-setup/SKILL.md` is inspected
- **THEN** it does not enumerate the three valid URL shapes
- **AND** it does not point at another skill's document as the owner of that wording
- **AND** it contains no link to a `DEPLOYMENT.md`

#### Scenario: The preflight defines the URLs without cataloguing them

- **WHEN** any tool-calling skill's preflight is inspected
- **THEN** it defines the Project URL and the Base URL in one sentence each
- **AND** it names `project get` and `project set`
- **AND** it contains no shape enumeration, example URL values, or validation rules
