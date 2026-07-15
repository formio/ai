## MODIFIED Requirements

### Requirement: Plugin bundles the skills library

The plugin source tree SHALL include, and the build SHALL copy to `dist/plugin/skills/`, the full `formio-api` router skill, every `formio-api-<group>` capability-group skill, and the `formio-schema`, `formio-resource-planner`, `formio-form`, and `formio-form-builder` skills. (`formio-form` is the `@formio/js` embed skill; `formio-form-builder` is the build-a-form orchestrator introduced by the `formio-form-builder-skill` capability.) The plugin build test's skill-inclusion assertions (`packages/mcp-server/src/__tests__/plugin-build.test.ts`) SHALL assert `formio-form-builder` is present in the bundled `skills/` directory.

#### Scenario: Installed plugin exposes all skills

- **WHEN** a user installs `@formio/ai` in a Claude Code project
- **THEN** Claude Code discovers every `formio-api`, `formio-schema`, `formio-resource-planner`, `formio-form`, and `formio-form-builder` skill from the plugin's `skills/` directory

#### Scenario: Bundled formio-form-builder is the orchestrator skill

- **WHEN** the bundled `skills/formio-form-builder/SKILL.md` is inspected
- **THEN** its frontmatter `name` is `formio-form-builder` and its description claims single-form creation triggers

#### Scenario: Build test asserts inclusion, not a stale exclusion

- **WHEN** the plugin build test suite runs against a built `dist/plugin/`
- **THEN** it asserts `formio-form-builder` is present in `dist/plugin/skills/`
- **AND** no assertion excludes `formio-form-builder` from the bundle
