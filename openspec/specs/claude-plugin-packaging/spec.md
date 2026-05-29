## ADDED Requirements

### Requirement: Marketplace manifest advertises the plugin

The repository SHALL publish a Claude Code marketplace manifest at `.claude-plugin/marketplace.json` that lists the `formio-ai` plugin sourced from npm as `@formio/ai`.

#### Scenario: Marketplace manifest is valid

- **WHEN** a Claude Code user adds the Form.io marketplace from this repository
- **THEN** Claude Code reads `.claude-plugin/marketplace.json` and discovers a plugin named `formio-ai` whose source is the npm package `@formio/ai`

### Requirement: Plugin manifest declares stdio MCP server

The plugin SHALL provide a `plugin/.claude-plugin/plugin.json` manifest that declares a single MCP server named `formio-mcp` launched by `node ${CLAUDE_PLUGIN_ROOT}/server/stdio.mjs`.

#### Scenario: Plugin manifest is loaded

- **WHEN** Claude Code installs the `formio-ai` plugin
- **THEN** it reads `plugin.json`, registers the `formio-mcp` MCP server, and launches it over stdio using the bundled `server/stdio.mjs` entrypoint

### Requirement: Plugin npm package publishes the built tree

The `plugin/package.json` SHALL set `name` to `@formio/ai`, `publishConfig.access` to `public`, and `publishConfig.directory` to `../dist/plugin` so that `npm publish` uploads the built plugin tree rather than the source tree.

#### Scenario: Publishing uploads the built tree

- **WHEN** `pnpm release:plugin` runs from `plugin/`
- **THEN** npm publishes the contents of `dist/plugin/` (bundled server, manifest, skills) under the `@formio/ai` package name with public access

### Requirement: Plugin bundles the skills library

The plugin source tree SHALL include, and the build SHALL copy to `dist/plugin/skills/`, the full `formio-api` router skill, every `formio-api-<group>` capability-group skill, and the `formio-schema` and `formio-resource-planner` skills. The bundled set SHALL NOT include `formio-form`.

#### Scenario: Installed plugin exposes all skills

- **WHEN** a user installs `@formio/ai` in a Claude Code project
- **THEN** Claude Code discovers every `formio-api`, `formio-schema`, and `formio-resource-planner` skill from the plugin's `skills/` directory
- **AND** no skill named `formio-form` is present in the bundled `skills/` directory

### Requirement: Build script produces a self-contained plugin tree

A `scripts/build-plugin.ts` script SHALL clean `dist/plugin/`, copy the `plugin/` source tree into it, sync the plugin manifest `version` field from `plugin/package.json`, and bundle `packages/mcp-server/src/stdio.ts` into `dist/plugin/server/stdio.mjs` as an executable ESM Node.js bundle targeting Node 20 with a CommonJS-compatibility banner that provides `require`, `__filename`, and `__dirname`.

#### Scenario: Build produces the expected layout

- **WHEN** `pnpm build:plugin` runs
- **THEN** `dist/plugin/.claude-plugin/plugin.json`, `dist/plugin/package.json`, `dist/plugin/skills/`, and an executable `dist/plugin/server/stdio.mjs` all exist, and the manifest `version` matches `plugin/package.json`

#### Scenario: Bundled server resolves CommonJS dependencies

- **WHEN** `dist/plugin/server/stdio.mjs` is executed with `node`
- **THEN** CommonJS dependencies bundled into the ESM output (e.g. `express`) resolve successfully via the banner-provided `require`, and the MCP server starts on stdio

### Requirement: Smoke test validates the built plugin over stdio

A `scripts/test-plugin.ts` script SHALL validate that `dist/plugin/` exists, that `plugin.json` contains required fields (`name`, `version`, `description`, at least one `mcpServers` entry), that required skill directories (at minimum `formio-api` and `formio-schema`) are present, and that spawning the bundled server and sending a JSON-RPC `tools/list` request returns a well-formed response. The smoke test SHALL NOT require `formio-form` to be present.

#### Scenario: Smoke test fails when build is missing

- **WHEN** the smoke test runs without `dist/plugin/` present
- **THEN** it exits non-zero with a message instructing the user to run `pnpm build:plugin`

#### Scenario: Smoke test verifies live MCP server

- **WHEN** the smoke test spawns `dist/plugin/server/stdio.mjs` and sends a `tools/list` JSON-RPC request
- **THEN** the server responds with a `result.tools` array and the test exits zero

#### Scenario: Smoke test asserts on the consolidated schema skill

- **WHEN** the smoke test inspects the bundled `skills/` directory
- **THEN** it SHALL assert `formio-schema` is present
- **AND** it SHALL NOT assert `formio-form` is present

### Requirement: Plugin ships a README documenting environment variables

The plugin source tree SHALL include `plugin/README.md` — copied by the build into `dist/plugin/README.md` and therefore published with `@formio/ai` — that documents every environment variable the bundled MCP server reads, marking each as required or optional and stating its default. At minimum the README SHALL list `FORMIO_PROJECT_URL` (required, no default), `FORMIO_API_KEY` (optional, default `undefined`), and `FORMIO_LOGIN_FORM` (optional, default `${FORMIO_PROJECT_URL}/user/login`), and SHALL describe the API-key vs. JWT authentication modes selected by presence/absence of `FORMIO_API_KEY`.

#### Scenario: README is published with the plugin

- **WHEN** `pnpm build:plugin` runs
- **THEN** `dist/plugin/README.md` exists and documents `FORMIO_PROJECT_URL`, `FORMIO_API_KEY`, and `FORMIO_LOGIN_FORM` with their required/optional status and defaults

#### Scenario: README stays in sync with server-config env vars

- **WHEN** the plugin-build test runs
- **THEN** it verifies `plugin/README.md` references every environment variable declared in the `server-config` capability (`FORMIO_PROJECT_URL`, `FORMIO_API_KEY`, `FORMIO_LOGIN_FORM`) and fails if any are missing

### Requirement: Example app demonstrates plugin configuration

The repository SHALL ship `examples/basic-app/` with a `README.md`, a `.claude/settings.json`, and an `.env.example` that together demonstrate how a Claude Code project enables the `formio-ai` plugin and supplies the required Form.io environment variables.

#### Scenario: Example app is consistent with plugin manifest

- **WHEN** the plugin-example-app test runs
- **THEN** it verifies that `examples/basic-app/.claude/settings.json` references the plugin name declared in `plugin/.claude-plugin/plugin.json` and that `.env.example` documents the environment variables the bundled MCP server requires

### Requirement: Plugin build and example app are covered by Vitest

Vitest suites under `packages/mcp-server/src/__tests__/` SHALL include `plugin-build.test.ts` asserting the `dist/plugin/` layout produced by `buildPlugin()` and `plugin-example-app.test.ts` asserting the example app stays consistent with the plugin manifest. Both tests MUST run as part of `pnpm test`.

#### Scenario: Plugin build regressions are caught by CI

- **WHEN** `pnpm test` runs
- **THEN** `plugin-build.test.ts` and `plugin-example-app.test.ts` execute and fail if the plugin build output or example-app wiring drifts from the manifest
