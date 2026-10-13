## ADDED Requirements

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
