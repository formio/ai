## ADDED Requirements

### Requirement: Initial reference data is not an administrator-only portal task

`formio-resource-planner/references/phase-b-emission.md` and `references/template-json.md` SHALL state that the initial rows of a reference-data Resource can be created by the agent at build time through `submission_create`, under `agent-submissions.md`, and SHALL keep ongoing administration — later reference-data edits, group-membership rows, role assignment, and reviewing or moderating submissions — as work done by an administrator in the project portal. The planner SHALL mark in `template.md` which Resources a `select` reads and need seed rows before the app is usable.

#### Scenario: The planner marks a seedable Resource

- **WHEN** a plan has a `category` Resource read by a `select` on the Ticket form
- **THEN** `template.md` marks `category` as needing seed rows, and the references name `submission_create` for the initial rows
