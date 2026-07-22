## ADDED Requirements

### Requirement: formio-resource-planner claims planning verbs only and routes build intents to formio-application

The `formio-resource-planner` `SKILL.md` frontmatter `description` SHALL claim only planning-intent triggers — design, architect, model, or plan the resources, schema, data model, or access model. It SHALL NOT claim build-an-app intents: no "build a <kind> app" / "I want to build X" example triggers, and no rule instructing activation whenever the user merely describes an app. The description SHALL contain a `Not for:` pointer naming the backtick-delimited `` `formio-application` `` for building or standing up the app itself (the orchestrator invokes this planner internally as its planning step).

#### Scenario: Planner description names formio-application

- **WHEN** the `formio-resource-planner` `SKILL.md` frontmatter is inspected
- **THEN** its `description` contains a `Not for:` clause naming `` `formio-application` ``
- **AND** its trigger clause contains no "build me"/"build a <kind> app" claim

#### Scenario: Build-an-app phrasing routes to the orchestrator, not the planner

- **WHEN** the user says "build me a task manager" or "I want to build a CRM in Form.io"
- **THEN** `formio-application` activates (and invokes the planner internally)
- **AND** `formio-resource-planner` does not activate directly

#### Scenario: Plan-only phrasing still routes to the planner

- **WHEN** the user says "design the resources for a task manager" or "plan the data model for my CRM"
- **THEN** `formio-resource-planner` activates
- **AND** `formio-application` does not activate
