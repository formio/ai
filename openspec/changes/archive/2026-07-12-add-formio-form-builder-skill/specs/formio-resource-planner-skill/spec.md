## ADDED Requirements

### Requirement: formio-resource-planner description routes standalone single-form creation to formio-form-builder

The `formio-resource-planner` `SKILL.md` frontmatter `description` SHALL contain a `Not for:` pointer at `` `formio-form-builder` `` for standalone single-form creation requests — building or creating one form (a survey, contact form, intake form, registration form, questionnaire, wizard, or PDF form) without designing a data model, resources, or permissions. The planner keeps claiming data-model, resource, and app-planning triggers; only the single-form creation intent is excluded.

#### Scenario: Planner description names formio-form-builder

- **WHEN** the `formio-resource-planner` `SKILL.md` frontmatter is inspected
- **THEN** its `description` contains a `Not for:` pointer naming the backtick-delimited `` `formio-form-builder` `` for standalone single-form creation requests

#### Scenario: Single-form phrasing does NOT route through the planner

- **WHEN** the user says "build me a contact form" or "create a survey" (no data model, resources, or app requested)
- **THEN** `formio-form-builder` activates
- **AND** `formio-resource-planner` does not activate

#### Scenario: Data-model phrasing still routes through the planner

- **WHEN** the user says "design the resources for a task manager" or "plan the schema for my CRM"
- **THEN** `formio-resource-planner` activates
- **AND** `formio-form-builder` does not activate
