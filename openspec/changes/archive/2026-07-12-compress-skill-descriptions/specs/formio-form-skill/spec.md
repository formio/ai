## ADDED Requirements

### Requirement: formio-form trigger clause uses embed verbs only

The `formio-form` `SKILL.md` frontmatter `description` trigger clause SHALL pair no build/create verbs with new-form nouns — phrases like "build a conditional wizard" SHALL be phrased with embed verbs instead ("make an embedded wizard conditional", "conditional wizard pages"). The spec-mandated `conditional wizard` substring remains. Creation intents stay with `formio-form-builder` (already named in the `Not for:` clause); this skill's verbs are embed, render, add-to-page, pre-fill, show/hide, calculate, validate.

#### Scenario: No build-verb new-form phrases in the trigger clause

- **WHEN** the `formio-form` `SKILL.md` frontmatter trigger clause is inspected
- **THEN** it contains no "build a"/"create a" phrase applied to a form, wizard, or survey noun
- **AND** it still contains the substring `conditional wizard`

#### Scenario: Conditional-wizard embed phrasing routes to formio-form

- **WHEN** the user says "make the second page of my embedded wizard conditional"
- **THEN** `formio-form` activates
- **AND** `formio-form-builder` does not activate
