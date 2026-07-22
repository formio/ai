## ADDED Requirements

### Requirement: formio-schema bare-noun triggers are scoped to Form.io JSON contexts

The `formio-schema` `SKILL.md` frontmatter `description` SHALL scope its noun triggers (form components, wizards, resources, submissions, project settings, component `type` names) to constructing, editing, or interpreting Form.io JSON — it SHALL NOT claim those nouns as blanket triggers outside a JSON/schema context, and SHALL NOT claim standalone build-a-form or plan-an-app intents (those belong to `formio-form-builder` / `formio-application` / `formio-resource-planner`). The spec-mandated form-builder vocabulary (`components`, `wizard`, `textfield`, `datagrid`) remains in the trigger clause, qualified by the JSON/schema context.

#### Scenario: JSON-context phrasing routes to formio-schema

- **WHEN** the user says "what does the datagrid component JSON look like" or is editing a form definition returned by `form_get`
- **THEN** `formio-schema` activates

#### Scenario: Bare build phrasing does NOT route to formio-schema

- **WHEN** the user says "build me a wizard" or "I need resources for a task manager" with no Form.io JSON in play
- **THEN** `formio-form-builder` (or `formio-resource-planner`) activates
- **AND** `formio-schema` does not activate directly

#### Scenario: No blanket even-without-Form.io claim

- **WHEN** the `formio-schema` `SKILL.md` frontmatter is inspected
- **THEN** its `description` contains no blanket claim to trigger on the bare nouns when the user has not said Form.io and no Form.io JSON context exists
