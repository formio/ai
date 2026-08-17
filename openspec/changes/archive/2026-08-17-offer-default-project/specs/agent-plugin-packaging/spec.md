## MODIFIED Requirements

### Requirement: A Cursor plugin manifest prompts for configuration at install time

`plugin/.cursor-plugin/plugin.json` SHALL declare `name`, `description`, `version`, `author`, `repository`, `license`, `logo`, a `skills` path of `skills`, an `mcpServers` entry equivalent to `mcp.json`'s, and a `variables` JSON Schema declaring `FORMIO_BASE_URL` (with a default of `https://api.form.io`) and `FORMIO_DEFAULT_PROJECT_URL`. Every `${VAR}` placeholder used in the manifest's MCP configuration SHALL be declared in `variables`, and every declared variable SHALL be referenced somewhere — Cursor rejects a mismatch at submission.

The install-time project answer SHALL feed `FORMIO_DEFAULT_PROJECT_URL`, never `FORMIO_PROJECT_URL`. The latter takes precedence over every working-directory mapping, so wiring an install-time prompt to it means a value entered once, at install, silently defeats every later `project_set` call — a conflict the user configures in two different places and can see in neither. The offering variable is surfaced by the server as a suggestion and can be overridden per directory.

Neither variable SHALL be listed in `variables.required`: the server starts with no configuration and raises an actionable error naming `project_set` when a tool needs a project, so an install that skips configuration is a working install rather than a broken one.

#### Scenario: Variables and placeholders match exactly

- **WHEN** the set of `${VAR}` placeholders in `plugin/.cursor-plugin/plugin.json` is compared with the keys of its `variables.properties`
- **THEN** the two sets are equal

#### Scenario: The project answer offers rather than pins

- **WHEN** the manifest's `mcpServers.formio-mcp.env` is inspected
- **THEN** the install-time project placeholder is assigned to `FORMIO_DEFAULT_PROJECT_URL`
- **AND** no install-time placeholder is assigned to `FORMIO_PROJECT_URL`

#### Scenario: Base URL carries the hosted default

- **WHEN** `variables.properties.FORMIO_BASE_URL` is inspected
- **THEN** its `default` is `https://api.form.io`

#### Scenario: Nothing is required at install time

- **WHEN** `variables` is inspected
- **THEN** it declares no `required` entries

#### Scenario: Skills path resolves

- **WHEN** the manifest's `skills` path is resolved relative to the plugin root
- **THEN** the directory exists and every immediate child containing a `SKILL.md` is a skill the library ships
