## Purpose

Defines the trigger boundaries of the `formio-resource-planner` skill: it claims planning verbs only, routes build intents to `formio-application`, and routes standalone single-form creation to `formio-form-builder`.

## Requirements

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
