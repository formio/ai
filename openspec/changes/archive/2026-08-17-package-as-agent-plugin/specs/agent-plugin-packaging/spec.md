## ADDED Requirements

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

`plugin/mcp.json` SHALL declare `$schema` exactly `https://agent-plugins.org/schemas/1.0.0/mcp.schema.json` — the same specification version as `plugin.json` — and an `mcpServers` object with one entry named `formio-mcp` of `type` `stdio`. The entry SHALL launch the published server with `npx -y @formio/mcp` rather than a path into the plugin directory, because a git-installed plugin contains no build output, and SHALL carry no version range — see the Claude manifest requirement for why a 0.x line takes neither a floor nor a ceiling in a shipped manifest. Its `env` SHALL NOT reference any placeholder other than `${PLUGIN_ROOT}` or `${PLUGIN_DATA}`, which are the only expansions the specification defines.

#### Scenario: Schema versions agree between the two manifests

- **WHEN** `plugin/plugin.json` and `plugin/mcp.json` are both parsed
- **THEN** the specification version in each `$schema` is the same

#### Scenario: Server launches from npm

- **WHEN** `plugin/mcp.json` is parsed
- **THEN** `mcpServers["formio-mcp"].type` is `stdio`
- **AND** its `command` is `npx` with args containing `-y` and `@formio/mcp`

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

### Requirement: A Cursor plugin manifest prompts for configuration at install time

`plugin/.cursor-plugin/plugin.json` SHALL declare `name`, `description`, `version`, `author`, `repository`, `license`, `logo`, a `skills` path of `skills`, an `mcpServers` entry equivalent to `mcp.json`'s, and a `variables` JSON Schema declaring `FORMIO_BASE_URL` (with a default of `https://api.form.io`) and `FORMIO_PROJECT_URL`. Every `${VAR}` placeholder used in the manifest's MCP configuration SHALL be declared in `variables`, and every declared variable SHALL be referenced somewhere — Cursor rejects a mismatch at submission.

Neither variable SHALL be listed in `variables.required`: the server starts with no configuration and raises an actionable error naming `project_set` when a tool needs a project, so an install that skips configuration is a working install rather than a broken one.

#### Scenario: Variables and placeholders match exactly

- **WHEN** the set of `${VAR}` placeholders in `plugin/.cursor-plugin/plugin.json` is compared with the keys of its `variables.properties`
- **THEN** the two sets are equal

#### Scenario: Base URL carries the hosted default

- **WHEN** `variables.properties.FORMIO_BASE_URL` is inspected
- **THEN** its `default` is `https://api.form.io`

#### Scenario: Nothing is required at install time

- **WHEN** `variables` is inspected
- **THEN** it declares no `required` entries

#### Scenario: Skills path resolves

- **WHEN** the manifest's `skills` path is resolved relative to the plugin root
- **THEN** the directory exists and every immediate child containing a `SKILL.md` is a skill the library ships

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

### Requirement: Hooks remain a Claude-only component

The `hooks/` directory and its registration SHALL stay declared only in `.claude-plugin/plugin.json`. Agent Plugins 1.0.0 defines no hooks component, and Cursor's hook format differs, so the `verify-project-url` gate SHALL NOT be declared in the other manifests. Correctness for clients without hooks is carried by the server's actionable project-resolution error, not by a ported hook.

#### Scenario: No hooks declared outside the Claude manifest

- **WHEN** `plugin/plugin.json` and `plugin/.cursor-plugin/plugin.json` are parsed
- **THEN** neither declares a `hooks` component

#### Scenario: The Claude manifest still registers the hook

- **WHEN** `plugin/hooks/hooks.json` and `plugin/.claude-plugin/plugin.json` are inspected
- **THEN** the hook remains registered for Claude Code exactly as before this change
