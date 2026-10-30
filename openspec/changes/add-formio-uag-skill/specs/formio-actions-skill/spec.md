## ADDED Requirements

### Requirement: formio-actions hands Agent: Run task to formio-uag

The `formio-actions` description's `Not for:` clause SHALL name `formio-uag` for the UAG's "Agent: Run task" action, and its Action Types section SHALL state that Form.io's catalog does not list `agentRunTask`, that `action_create` refuses it, and that `formio-uag` owns it.

#### Scenario: A Run task request

- **WHEN** the user asks to add an "Agent: Run task" action to a form
- **THEN** `formio-uag` activates, not `formio-actions`
