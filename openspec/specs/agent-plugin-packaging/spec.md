# agent-plugin-packaging Specification

## Purpose
Defines how the plugin directory is packaged for any coding agent: an Agent Plugins 1.0.0 manifest, a spec-conformant `mcp.json` server declaration, a Cursor manifest that prompts for nothing at install time, and one directory that serves every client.
## Requirements
### Requirement: The plugin directory carries an Agent Plugins 1.0.0 manifest

`plugin/plugin.json` SHALL be a conformant Agent Plugins 1.0.0 manifest declaring `$schema` exactly `https://agent-plugins.org/schemas/1.0.0/plugin.schema.json`, `name` of `formio-ai`, and the optional metadata fields `version`, `description`, `author`, `homepage`, `repository`, `license`, and `keywords`. The `version` SHALL equal the `@formio/ai` package version at build time. No top-level field outside the specification's set SHALL be present except `extensions`.

#### Scenario: Manifest declares the specification schema

- **WHEN** `plugin/plugin.json` is parsed
- **THEN** its `$schema` is `https://agent-plugins.org/schemas/1.0.0/plugin.schema.json`
- **AND** its `name` is `formio-ai`

#### Scenario: Built manifest version tracks the package

- **WHEN** `pnpm build:plugin` runs
- **THEN** `dist/plugin/plugin.json` `version` equals the `version` in `plugin/package.json`

#### Scenario: No unknown top-level fields

- **WHEN** `plugin/plugin.json` keys are compared against the specification set (`$schema`, `name`, `version`, `description`, `author`, `homepage`, `repository`, `license`, `keywords`, `extensions`)
- **THEN** every key is in that set

### Requirement: MCP servers are declared in a spec-conformant mcp.json

`plugin/mcp.json` SHALL declare `$schema` exactly `https://agent-plugins.org/schemas/1.0.0/mcp.schema.json` — the same specification version as `plugin.json` — and an `mcpServers` object with one entry named `formio-mcp` of `type` `stdio`. The entry SHALL launch the published server with `npx -y @formio/mcp@<MAJOR.MINOR.PATCH>` rather than a path into the plugin directory, because a git-installed plugin contains no build output, and SHALL pin the exact `version` in `packages/mcp-server/package.json` rather than launching the package unpinned or with a range — see the Claude manifest requirement for why an unpinned launch chooses the agent's server at run time and why a 0.x line takes neither a floor nor a ceiling in a shipped manifest. Its `env` SHALL NOT reference any placeholder other than `${PLUGIN_ROOT}` or `${PLUGIN_DATA}`, which are the only expansions the specification defines.

#### Scenario: Schema versions agree between the two manifests

- **WHEN** `plugin/plugin.json` and `plugin/mcp.json` are both parsed
- **THEN** the specification version in each `$schema` is the same

#### Scenario: Server launches from npm

- **WHEN** `plugin/mcp.json` is parsed
- **THEN** `mcpServers["formio-mcp"].type` is `stdio`
- **AND** its `command` is `npx` with args containing `-y` and `@formio/mcp@<version>` for the `version` in `packages/mcp-server/package.json`, never the bare `@formio/mcp`

#### Scenario: No unsupported placeholders

- **WHEN** every string value under `mcpServers` is scanned for `${...}` placeholders
- **THEN** each placeholder found is either `${PLUGIN_ROOT}` or `${PLUGIN_DATA}`

#### Scenario: The declared package is this repository's server

- **WHEN** the npm package named in `plugin/mcp.json` args is compared with the `name` in `packages/mcp-server/package.json`
- **THEN** they are the same package

#### Scenario: That server starts and lists tools

- **WHEN** the locally built equivalent of the declared server (`dist/plugin/server/stdio.mjs`) is executed with no Form.io environment variables set
- **THEN** it answers `tools/list` with the full tool set including `project_set`
- **AND** no test spawns `npx` against the public registry, which would assert the behaviour of the last published version rather than this tree

### Requirement: A Cursor plugin manifest prompts for nothing at install time

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
### Requirement: One plugin directory serves every client

The plugin directory SHALL carry all three manifests side by side — `plugin.json` (Agent Plugins), `.cursor-plugin/plugin.json` (Cursor), and `.claude-plugin/plugin.json` (Claude Code) — over a single `skills/` directory and a single `mcp.json`. Skills SHALL NOT be duplicated per client. Each client detects its own manifest by location, so the presence of the others SHALL be inert.

#### Scenario: All three manifests present in source and build output

- **WHEN** `pnpm build:plugin` has run
- **THEN** `dist/plugin/plugin.json`, `dist/plugin/.cursor-plugin/plugin.json`, and `dist/plugin/.claude-plugin/plugin.json` all exist
- **AND** `dist/plugin/mcp.json` exists
- **AND** exactly one `dist/plugin/skills/` tree exists

#### Scenario: Manifests agree on identity

- **WHEN** the three manifests are parsed
- **THEN** each declares the same `name` and the same `version`

