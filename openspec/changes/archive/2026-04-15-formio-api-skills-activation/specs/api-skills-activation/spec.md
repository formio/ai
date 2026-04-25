## ADDED Requirements

### Requirement: Skill descriptions MUST contain a trigger clause

Every capability-group skill's frontmatter `description` field SHALL contain the phrase `use when` (case-insensitive). The trigger clause SHALL follow the capability statement and list 3–6 action verbs a user might say when they want this skill to activate.

The router skill is exempt from this requirement because Claude does not select the router for endpoint operations.

#### Scenario: Capability-group skill with a valid trigger clause passes validation

- **WHEN** a skill's description is `"Project-scope Forms API — list, filter, create, update, import, and export forms and resources within a Form.io project as a project admin. Use when the user asks to create, list, update, export, import, or rename forms, resources, or form definitions. Not for: form submissions (see formio-api/references/runtime-submissions)."`
- **THEN** `validateDescriptionTriggers` SHALL NOT emit any issue for that skill

#### Scenario: Capability-group skill missing "use when" fails validation

- **WHEN** a skill's description is `"Project-scope Forms API — list, filter, create, update, and export forms."`
- **THEN** `validateDescriptionTriggers` SHALL emit a `description.trigger_phrase` issue naming the file and the missing phrase

#### Scenario: Router skill is exempt from the trigger requirement

- **WHEN** the router skill at `.claude/skills/formio-api/SKILL.md` is validated
- **THEN** `validateDescriptionTriggers` SHALL NOT emit an issue even if `use when` is absent from its description

### Requirement: Project-scope and runtime-scope skills MUST contain a negative-trigger clause

Every capability-group skill whose frontmatter `scope` is `project` or `runtime` SHALL contain the phrase `not for:` (case-insensitive) in its `description`. The clause SHALL name at least one sibling skill by its `formio-api-` prefixed identifier.

`platform` and `pdf` scoped skills MAY include a negative-trigger clause but are not required to.

#### Scenario: Project-scope skill with a negative-trigger clause passes

- **WHEN** a `scope: project` skill's description contains `"Not for: form submissions (see formio-api/references/runtime-submissions)"`
- **THEN** `validateDescriptionNegativeTrigger` SHALL NOT emit an issue

#### Scenario: Runtime-scope skill without a negative-trigger clause fails

- **WHEN** a `scope: runtime` skill's description contains no occurrence of `not for:`
- **THEN** `validateDescriptionNegativeTrigger` SHALL emit a `description.negative_trigger` issue naming the file

#### Scenario: Platform-scope skill without a negative-trigger clause passes

- **WHEN** a `scope: platform` skill's description contains no occurrence of `not for:`
- **THEN** `validateDescriptionNegativeTrigger` SHALL NOT emit an issue

### Requirement: Every capability-group skill MUST include an `## MCP Tool Preference` section

Every capability-group skill SHALL contain a top-level section whose heading is exactly `## MCP Tool Preference`. The section SHALL appear after `## Authentication` and before `## Endpoints` in the body.

The section SHALL instruct the reader to prefer matching first-party MCP tools (`form_create`, `form_get`, `form_list`, `form_update`) over direct HTTP calls when both paths exist.

If no first-party MCP tool covers any operation in the skill, the section SHALL contain exactly one sentence: `No MCP tool covers this operation — use the HTTP endpoint directly.`

If at least one operation has a first-party MCP tool, the section SHALL contain a Markdown table mapping each such operation to the preferred tool and its fallback endpoint.

The router skill is exempt from this requirement.

#### Scenario: Skill with a matching MCP tool includes the mapping table

- **WHEN** the `formio-api/references/project-forms` `SKILL.md` is parsed
- **THEN** a section heading `## MCP Tool Preference` SHALL appear between `## Authentication` and `## Endpoints`
- **AND** the section SHALL contain a Markdown table naming `form_create`, `form_get`, `form_list`, and `form_update` as preferred tools for their respective operations

#### Scenario: Skill without any matching MCP tool includes the uniform fallback sentence

- **WHEN** the `formio-api/references/runtime-reports` `SKILL.md` is parsed
- **THEN** a section heading `## MCP Tool Preference` SHALL appear between `## Authentication` and `## Endpoints`
- **AND** the section body SHALL contain the sentence `No MCP tool covers this operation — use the HTTP endpoint directly.`

#### Scenario: Missing `## MCP Tool Preference` section fails validation

- **WHEN** a capability-group skill lacks a `## MCP Tool Preference` heading
- **THEN** `validateRequiredHeadings` SHALL emit a `headings.missing` issue naming the section

#### Scenario: Out-of-order `## MCP Tool Preference` section fails validation

- **WHEN** `## MCP Tool Preference` appears before `## Authentication` or after `## Endpoints` in a skill body
- **THEN** `validateRequiredHeadings` SHALL emit a `headings.order` issue describing the misordering

### Requirement: The validator MUST expose the new rules through `validateSkillContent`

`packages/mcp-server/src/skills-validator.ts` SHALL compose `validateDescriptionTriggers` and `validateDescriptionNegativeTrigger` into the default `validateSkillContent` pipeline so that `pnpm test` exercises them against every capability-group skill.

#### Scenario: Vitest suite invokes the new description rules

- **WHEN** `pnpm test --filter @formio/mcp` is run
- **THEN** the skills-library test suite SHALL exercise `validateDescriptionTriggers` and `validateDescriptionNegativeTrigger`
- **AND** failures from either rule SHALL fail the test run

#### Scenario: `REQUIRED_HEADINGS` includes `## MCP Tool Preference` in the correct position

- **WHEN** the exported `REQUIRED_HEADINGS` constant is inspected
- **THEN** it SHALL contain the entry `## MCP Tool Preference`
- **AND** that entry SHALL appear immediately after `## Authentication` and immediately before `## Endpoints`
