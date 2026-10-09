## ADDED Requirements

### Requirement: Saving without revision history is an explicit argument, not a prompt

`form_create` and `form_update` SHALL accept an optional `acceptNoHistory: boolean`. A write that would save a form without revision history — on a deployment without the revisions licence, or to a form whose stored `revisions` setting is off when the caller does not enable it — SHALL proceed only when `acceptNoHistory` is `true`. Otherwise the tool SHALL make no write and return `isError: true` with code `HISTORY_NOT_ACCEPTED` and a message stating why the save would have no history, telling the agent to ask the user and retry with `acceptNoHistory: true`, or (for a licensed deployment) with `form.revisions` set to `"original"` or `"current"` to enable history. No tool SHALL open an elicitation request or a local browser page to ask this, and no answer SHALL be persisted between calls.

#### Scenario: Unlicensed deployment without acceptance

- **WHEN** `form_create` is called on a deployment without the revisions licence and no `acceptNoHistory`
- **THEN** no POST is sent
- **AND** the result has code `HISTORY_NOT_ACCEPTED` and a message telling the agent to ask the user

#### Scenario: Unlicensed deployment with acceptance

- **WHEN** `form_create` is called on that deployment with `acceptNoHistory: true`
- **THEN** the form is created without a `revisions` setting

#### Scenario: A licensed form with revisions off

- **WHEN** `form_update` saves a form whose stored `revisions` is empty, without `acceptNoHistory` and without `form.revisions`
- **THEN** no PUT is sent and the result has code `HISTORY_NOT_ACCEPTED`
- **AND WHEN** the call is retried with `form.revisions: "original"`
- **THEN** the PUT enables revisions and saves

#### Scenario: Nothing prompts

- **WHEN** any form write runs in a client that supports elicitation
- **THEN** no elicitation request is sent and no local page is opened
