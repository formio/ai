## MODIFIED Requirements

### Requirement: SKILL.md description MUST use the three-clause template

The `description` field of `plugin/skills/formio-sdk/SKILL.md` SHALL contain three clauses:

1. A capability statement naming `@formio/js` and `@formio/js/utils` and asserting the skill is source-derived from the Form.io source code.
2. A trigger clause beginning with the substring `Use when the user asks to`.
3. A negative-trigger clause beginning with the substring `Not for:` that names `formio-api`, `formio-application`, `formio-resource-planner`, `formio-angular`, and `formio-form` — with `formio-form` cited for task-oriented "embed/render a form in my page or app" requests (`formio-sdk` remains the raw SDK/Utils API reference).

#### Scenario: Missing trigger clause fails

- **WHEN** the description lacks `Use when the user asks to`
- **THEN** `validateFormioSdkSkill` SHALL emit a `formio_sdk.description_clause` issue with `clause: "trigger"`

#### Scenario: Missing negative-trigger clause fails

- **WHEN** the description lacks `Not for:`
- **THEN** `validateFormioSdkSkill` SHALL emit a `formio_sdk.description_clause` issue with `clause: "negative"`

#### Scenario: Negative clause omits a sibling skill name fails

- **WHEN** the `Not for:` clause is missing the literal `formio-api`
- **THEN** `validateFormioSdkSkill` SHALL emit a `formio_sdk.description_clause` issue with `clause: "negative"` naming the missing sibling

#### Scenario: Negative clause routes embed tasks to formio-form

- **WHEN** the `formio-sdk` `SKILL.md` frontmatter is inspected
- **THEN** its `Not for:` clause contains the literal substring `formio-form`
- **AND** a user request like "embed this form in my web page" activates `formio-form`, not `formio-sdk`
