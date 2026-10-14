## ADDED Requirements

### Requirement: project_import is not annotated idempotent

`project_import` SHALL carry `idempotentHint: false`: each import recreates the actions of every form it names under new ids, and a timed-out import is not retried blind.

#### Scenario: Annotation

- **WHEN** `tools/list` is read
- **THEN** `project_import`'s annotations have `idempotentHint: false`
