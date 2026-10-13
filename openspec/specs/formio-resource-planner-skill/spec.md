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

### Requirement: The planner MUST describe action order as the server runs it

`references/template-json.md` and `references/phase-b-emission.md` SHALL state that within one handler phase the action with the higher `priority` runs first, and that every `before` action runs before every `after` action. The order they describe for a register form SHALL be the order the emitted numbers and handlers produce: Save (before), Login (before), then Role Assignment (after). The emitted priority values are unchanged.

#### Scenario: No "higher runs later"

- **WHEN** `template-json.md` is searched for "higher runs later"
- **THEN** no match is found

#### Scenario: Described order matches emitted values

- **WHEN** the register-form order in `phase-b-emission.md` is compared with the handlers and priorities `template-json.md` emits
- **THEN** the described order is the order the server runs them in

### Requirement: Persona Role Assignment actions are documented as create-only

Every document that describes the conditional `user:role<Persona>` actions SHALL state that they run on create only, by design, and SHALL NOT say they cover users who are edited.

#### Scenario: No "created or edited"

- **WHEN** the planner's and `formio-actions`' persona-action text is read
- **THEN** it states create-only and does not say "created or edited"

### Requirement: The planner does not invoke formio-auth

`formio-resource-planner` SHALL NOT invoke `formio-auth`: auth configuration needs the imported project, which the planner never creates. When the approved map names an auth concern beyond resource-backed login with Role and Group Assignment, the planner's Next-steps menu SHALL list configuring auth with `formio-auth` after the template is imported.

#### Scenario: Standalone planning lists auth as a next step

- **WHEN** a standalone planner run's approved map names Custom JWT
- **THEN** the Next-steps menu lists configuring auth with `formio-auth` after import
- **AND** the planner does not hand off to `formio-auth` itself

### Requirement: The planner plans a change against an existing project

`formio-resource-planner` SHALL support a change mode, entered when it is given a baseline template (the project's current export or its current tag's template). In change mode Phase A presents the existing resources and roles from the baseline and marks what the change adds or modifies; Phase B SHALL append a dated change section to `template.md` and emit `changes.json`, which holds, in the template's own shape, only the roles, resources, forms, and actions the change creates, plus an `updates` list naming each existing form to change and the components or settings to add or alter. `changes.json` SHALL carry no top-level `access`, SHALL reference existing resources and roles by their machine names in the baseline, and SHALL NOT repeat an unchanged entity. The planner SHALL NOT emit a template meant for `project_import` in change mode.

#### Scenario: Also track vendors

- **WHEN** the planner is given a baseline with `user` and `order` resources and asked to also track vendors on orders
- **THEN** `changes.json` creates a `vendor` resource and lists an update to `order` adding a select referencing `vendor`
- **AND** it carries no `access` key and does not repeat `user`

### Requirement: Change-mode eval cases hold the planner's baseline

The planner's eval harness SHALL gain change-mode cases, each with a baseline template fixture, graded on `changes.json`: no unchanged entity repeated, no top-level `access`, references to existing entities by baseline machine names, and dependency-complete new entities. The existing full-plan cases SHALL score at or above their pass rate on the base commit, recorded in this change's `design.md`.

#### Scenario: Harness covers change mode

- **WHEN** the planner harness's `evals.json` is read
- **THEN** it contains change-mode cases with baseline fixtures

#### Scenario: Full-plan baseline holds

- **WHEN** the existing cases are run on the base commit and on the change
- **THEN** the change's pass rate is at least the base commit's

