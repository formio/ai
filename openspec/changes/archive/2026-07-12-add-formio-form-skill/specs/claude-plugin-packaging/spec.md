## MODIFIED Requirements

### Requirement: Plugin bundles the skills library

The plugin source tree SHALL include, and the build SHALL copy to `dist/plugin/skills/`, the full `formio-api` router skill, every `formio-api-<group>` capability-group skill, and the `formio-schema`, `formio-resource-planner`, and `formio-form` skills. (`formio-form` here is the `@formio/js` embed skill introduced by the `formio-form-skill` capability — not the historical schema-reference skill of the same name, which remains merged into `formio-schema`.)

#### Scenario: Installed plugin exposes all skills

- **WHEN** a user installs `@formio/ai` in a Claude Code project
- **THEN** Claude Code discovers every `formio-api`, `formio-schema`, `formio-resource-planner`, and `formio-form` skill from the plugin's `skills/` directory

#### Scenario: Bundled formio-form is the embed skill

- **WHEN** the bundled `skills/formio-form/SKILL.md` is inspected
- **THEN** its frontmatter `name` is `formio-form` and its description claims embed/render triggers for `@formio/js`

### Requirement: Smoke test validates the built plugin over stdio

A `scripts/test-plugin.ts` script SHALL validate that `dist/plugin/` exists, that `plugin.json` contains required fields (`name`, `version`, `description`, at least one `mcpServers` entry), that required skill directories (at minimum `formio-api` and `formio-schema`) are present, and that spawning the bundled server and sending a JSON-RPC `tools/list` request returns a well-formed response.

#### Scenario: Smoke test fails when build is missing

- **WHEN** the smoke test runs without `dist/plugin/` present
- **THEN** it exits non-zero with a message instructing the user to run `pnpm build:plugin`

#### Scenario: Smoke test verifies live MCP server

- **WHEN** the smoke test spawns `dist/plugin/server/stdio.mjs` and sends a `tools/list` JSON-RPC request
- **THEN** the server responds with a `result.tools` array and the test exits zero

#### Scenario: Smoke test asserts on the consolidated schema skill

- **WHEN** the smoke test inspects the bundled `skills/` directory
- **THEN** it SHALL assert `formio-schema` is present
