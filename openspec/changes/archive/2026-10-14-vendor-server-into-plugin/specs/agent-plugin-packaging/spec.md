## MODIFIED Requirements

### Requirement: MCP servers are declared in a spec-conformant mcp.json

`plugin/mcp.json` SHALL declare `$schema` exactly `https://agent-plugins.org/schemas/1.0.0/mcp.schema.json` — the same specification version as `plugin.json` — and an `mcpServers` object with one entry named `formio-mcp` of `type` `stdio`. The entry SHALL launch the published server with `npx -y @formio/mcp@<MAJOR.MINOR.PATCH>` rather than a path into the plugin directory, because a client reading the Agent Plugins layout performs no dependency install from the plugin's lockfile, and SHALL pin the exact `version` in `packages/mcp-server/package.json` rather than launching the package unpinned or with a range — see the Claude manifest requirement for why an unpinned launch chooses the agent's server at run time and why a shipped manifest takes neither a floor nor a ceiling. Its `env` SHALL NOT reference any placeholder other than `${PLUGIN_ROOT}` or `${PLUGIN_DATA}`, which are the only expansions the specification defines.

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

- **WHEN** the locally built equivalent of the declared server (the vendored `server/stdio.js`, run against dependencies installed from the plugin's lockfile) is executed with no Form.io environment variables set
- **THEN** it answers `tools/list` with the full tool set including `project_set`
- **AND** no test spawns `npx` against the public registry, which would assert the behaviour of the last published version rather than this tree
