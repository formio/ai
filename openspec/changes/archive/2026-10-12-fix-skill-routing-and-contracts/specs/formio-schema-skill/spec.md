## ADDED Requirements

### Requirement: Writes to a saved form go through formio-form-builder

`formio-schema/SKILL.md`'s body SHALL state that it documents shapes and that a change to a saved form is written through `formio-form-builder`'s edit lane, not by calling `form_update` from this skill.

#### Scenario: Schema does not write saved forms itself

- **WHEN** `formio-schema/SKILL.md` is read
- **THEN** it does not say to modify forms "via the MCP server tools" directly
- **AND** it routes saved-form changes to `formio-form-builder`

