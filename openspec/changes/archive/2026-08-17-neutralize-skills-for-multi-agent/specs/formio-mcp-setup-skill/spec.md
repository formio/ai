## ADDED Requirements

### Requirement: Setup offers to configure the project before the reload

After writing the client configuration and before telling the user to reload, `formio-mcp-setup` SHALL offer to capture the Form.io project configuration, so the server resolves a project on its very first tool call instead of raising a "no project configured" error the user then has to resolve.

The step SHALL ask for the Project URL and the Base URL in one question round, reusing the plain-language descriptions and example values that `formio-application/DEPLOYMENT.md` already carries, and referencing that document by file path rather than duplicating its wording. It SHALL apply the answers by running the server's own command — `npx -y @formio/mcp project set --project-url <url> --base-url <url> --cwd <absolute path>` — and SHALL NOT edit `~/.formio/projects.json` directly and SHALL NOT write `FORMIO_PROJECT_URL` into any client configuration file's `env` block, because an environment value takes precedence over the mapping and would pin the server against every later `project_set`.

The step SHALL confirm the result by running `npx -y @formio/mcp project get --cwd <absolute path>` and reporting the resolved URLs, rather than asserting success.

The `project` invocations the skill documents SHALL carry no version range: `@formio/mcp` is a 0.x line, so a hard-coded floor in shipped prose goes stale at the next release. The command shipped in `@formio/mcp` 0.9.0, and an older binary ignores the arguments, starts its stdio server, reads end-of-input and exits **0 with no output** — so `project get` reports success while finding nothing and `project set` reports success while writing nothing. The skill SHALL therefore treat a zero-exit run that prints nothing as "no project is configured", and SHALL NOT report a mapping it did not read in the output or claim a project was persisted when `project set` printed nothing.

#### Scenario: URLs captured, mapping written, first tool call resolves

- **WHEN** the user supplies both URLs
- **THEN** the skill runs `project set` with them and the absolute working directory
- **AND** it confirms with `project get` and reports the resolved project and base URL
- **AND** the reload instruction that follows notes that no further project setup is needed

#### Scenario: Configuration is applied through the server's command

- **WHEN** the skill applies the captured URLs
- **THEN** it invokes the `formio-mcp` bin's `project set` command
- **AND** it does not edit `~/.formio/projects.json` itself
- **AND** it does not add `FORMIO_PROJECT_URL` or `FORMIO_BASE_URL` to any client configuration file

### Requirement: The project-configuration step is skippable and never blocks setup

The configuration step SHALL be optional. `formio-mcp-setup` fires from every Form.io skill's preflight, including requests that need no project at all — an API-reference question, a schema question — and from users who have not created a project yet. The step SHALL therefore state plainly that it can be skipped, and skipping SHALL NOT block the client configuration, the reload instruction, or the handoff back to the calling skill.

When the step is skipped, the skill SHALL say that the first Form.io tool call will ask for the project, and SHALL name `project_set` as what will handle it. It SHALL NOT imply the setup failed.

An existing mapping SHALL short-circuit the step: when `project get` already resolves a project for the working directory, the skill SHALL report the resolved URLs in one line and SHALL NOT interview.

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
- **AND** it does not ask for URLs

#### Scenario: The project command is unavailable

- **WHEN** `project set` fails because `npx` cannot fetch `@formio/mcp`, or because the registry is unreachable
- **THEN** the skill reports what failed in one line
- **AND** it names `project_set` as what will capture the project on the first tool call
- **AND** it still delivers the reload instruction and the handoff, treating the outcome as a skipped step rather than a failed setup

#### Scenario: Skipping does not read as failure

- **WHEN** the step is skipped
- **THEN** the skill's closing message describes setup as complete
- **AND** it does not tell the user something went wrong
