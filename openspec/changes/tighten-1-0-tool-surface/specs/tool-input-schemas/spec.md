## ADDED Requirements

### Requirement: Tools refuse undeclared top-level arguments

Every registered tool's input schema SHALL be a strict object at the top level, so a call naming an argument the tool does not declare is refused and makes no request. The refusal SHALL name the undeclared argument. Object-valued arguments that carry a Form.io document — a form, an action, a role, a template — SHALL stay open to fields the schema does not list.

#### Scenario: A misplaced argument is refused

- **WHEN** `form_update` is called with a `projectUrl` argument
- **THEN** the call is refused naming `projectUrl`
- **AND** no request reaches the deployment

#### Scenario: Every tool is strict

- **WHEN** `tools/list` is read
- **THEN** every tool's input schema declares `additionalProperties: false` at the top level

#### Scenario: Document bodies stay open

- **WHEN** `form_update` is called with a `form` carrying a field its schema does not list
- **THEN** the call is accepted and the field is sent
