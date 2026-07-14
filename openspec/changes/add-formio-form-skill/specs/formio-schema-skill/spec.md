## MODIFIED Requirements

### Requirement: Consolidated Form.io JSON schema skill

The `formio-schema` skill SHALL be the single Form.io JSON schema reference skill in the library. The historical form-schema reference skill once named `formio-form` SHALL remain merged into `formio-schema`; the `formio-form` name is now used by the separate embed skill (see the `formio-form-skill` capability), whose scope is rendering/embedding with `@formio/js`, not JSON schema authoring.

`plugin/skills/formio-schema/SKILL.md` SHALL be the router entry point, carrying YAML frontmatter with at least `name: formio-schema` and a `description` that:

1. States the skill covers Form.io JSON schemas for project, form (and resource), and submission documents. It SHALL NOT claim to cover action or role JSON — action JSON is owned by the dedicated `formio-actions` skill, and role JSON is handled by `formio-api`'s `project-roles` reference.
2. Includes a "Use when…" trigger clause listing the form-builder phrases that previously activated the historical `formio-form` schema skill (e.g., `components`, `wizard`, `textfield`, `datagrid`) so existing form-authoring prompts still activate the skill.
3. Includes a "Not for:" negative-trigger clause disambiguating from `formio-api`, `formio-actions`, `formio-resource-planner`, and `formio-application`.

#### Scenario: formio-form directory hosts only the embed skill

- **WHEN** the repository is inspected
- **THEN** `plugin/skills/formio-form/SKILL.md` describes the `@formio/js` embed skill (per the `formio-form-skill` capability)
- **AND** no schema-reference content (project/form/submission JSON schema authoring) lives under `plugin/skills/formio-form/`

#### Scenario: formio-schema router has multi-domain description

- **WHEN** `plugin/skills/formio-schema/SKILL.md` is parsed
- **THEN** its frontmatter `name` SHALL equal `formio-schema`
- **AND** its frontmatter `description` SHALL mention the domains "submission" and "project" alongside "form"
- **AND** its frontmatter `description` SHALL include a "Not for:" clause that names `formio-api`, `formio-actions`, `formio-resource-planner`, and `formio-application`
- **AND** its frontmatter `description` SHALL NOT contain the string `formio-form` (the embed skill claims its own triggers; the schema skill never routes through it)
