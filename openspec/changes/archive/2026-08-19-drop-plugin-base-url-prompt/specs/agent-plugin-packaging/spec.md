## MODIFIED Requirements

### Requirement: A Cursor plugin manifest prompts for configuration at install time

`plugin/.cursor-plugin/plugin.json` SHALL declare `name`, `description`, `version`, `author`, `repository`, `license`, `logo`, a `skills` path of `skills`, and an `mcpServers` entry equivalent to `mcp.json`'s.

It SHALL declare no `variables` schema and SHALL pass no `env` block to the server: the manifest prompts for nothing at install time. Every `${VAR}` placeholder used in the manifest SHALL still be declared in `variables` — an invariant Cursor enforces at submission, and one that now holds over two empty sets, so adding a placeholder without declaring it remains a failure.

An install-time prompt for either URL is the wrong scope for both. A Form.io project is one-to-one with the application built against it, so a project answer typed once at install is right for one directory and wrong for every later one. A deployment answer is no better placed: the base URL is derived per project from the project URL's shape when it can be, the environment is the weakest resolution source and so cannot override a committed `formio.json` or a working-directory mapping, and on a self-hosted install a single global silently satisfied the base URL for every project including ones on another deployment. Both values are therefore captured per directory — by `project_set`, or by a committed `formio.json` that travels with the application's own source.

Nothing is required at install time, and an install that configures nothing is a working install rather than a broken one: the server starts with no configuration and raises an actionable error naming `project_set` when a tool needs a project, or naming `project set --base-url` when a base URL cannot be determined.

#### Scenario: Variables and placeholders match exactly

- **WHEN** the set of `${VAR}` placeholders in `plugin/.cursor-plugin/plugin.json` is compared with the keys of its `variables.properties`, treating an absent `variables` as an empty set
- **THEN** the two sets are equal

#### Scenario: The manifest prompts for nothing

- **WHEN** `plugin/.cursor-plugin/plugin.json` is parsed
- **THEN** it declares no `variables` schema
- **AND** its `mcpServers.formio-mcp` entry has no `env` block
- **AND** no `${VAR}` placeholder appears anywhere in the manifest

#### Scenario: Neither URL is prompted for at install time

- **WHEN** the manifest is searched for `FORMIO_PROJECT_URL`, `FORMIO_DEFAULT_PROJECT_URL`, and `FORMIO_BASE_URL`
- **THEN** none appears
- **AND** the project and the deployment are captured per directory instead

#### Scenario: An unconfigured install still works

- **WHEN** a user installs the Cursor plugin and configures nothing
- **THEN** the server starts and serves its full tool list
- **AND** the first project-scoped tool call raises the actionable resolution error rather than failing opaquely
