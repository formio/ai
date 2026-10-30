## ADDED Requirements

### Requirement: formio-form hands agent work to formio-uag

`formio-form`'s `SKILL.md` SHALL carry a section that keeps rendering for a person in `formio-form` and hands a form that fills itself in, a chat, or use by an AI agent to `formio-uag`.

#### Scenario: Prefill from a description

- **WHEN** an embed request asks for the form to fill itself in from what the person describes
- **THEN** the agent hands that part to `formio-uag`
