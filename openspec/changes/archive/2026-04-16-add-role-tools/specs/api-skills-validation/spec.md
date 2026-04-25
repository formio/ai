## MODIFIED Requirements

### Requirement: Automated validation suite

The repository SHALL include an automated validation suite that verifies every skill file in `skills/formio-api/` against the authoring rules. The suite SHALL run as part of `pnpm test` and SHALL fail the test run if any skill violates the rules.

When a skill's `## MCP Tool Preference` section references MCP tools (e.g., `role_list`, `role_create`, `role_update`), the validation suite SHALL accept the tool references as valid content for that section.

#### Scenario: Validation runs under pnpm test

- **WHEN** a developer runs `pnpm test` from the repository root
- **THEN** the skills-library validation suite executes
- **AND** its pass/fail status affects the overall exit code

#### Scenario: Validation fails loudly on violation

- **WHEN** any skill file has a missing frontmatter key, wrong `auth` value, missing required section, or forbidden legacy reference
- **THEN** the validation suite fails
- **AND** the failing test output names the skill file and the specific rule violated

#### Scenario: Skill with MCP tool references passes validation

- **WHEN** a skill's `## MCP Tool Preference` section references specific MCP tool names instead of stating "No MCP tool covers this operation"
- **THEN** the validation suite passes for that skill
