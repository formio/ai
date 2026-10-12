## ADDED Requirements

### Requirement: The planner MUST describe action order as the server runs it

`references/template-json.md` and `references/phase-b-emission.md` SHALL state that within one handler phase the action with the higher `priority` runs first, and that every `before` action runs before every `after` action. The order they describe for a register form SHALL be the order the emitted numbers and handlers produce: Save (before), Login (before), then Role Assignment (after). The emitted priority values are unchanged.

#### Scenario: No "higher runs later"

- **WHEN** `template-json.md` is searched for "higher runs later"
- **THEN** no match is found

#### Scenario: Described order matches emitted values

- **WHEN** the register-form order in `phase-b-emission.md` is compared with the handlers and priorities `template-json.md` emits
- **THEN** the described order is the order the server runs them in

### Requirement: Persona Role Assignment actions are documented as create-only

Every document that describes the conditional `user:role<Persona>` actions SHALL state that they run on create only, by design, and SHALL NOT say they cover users who are edited.

#### Scenario: No "created or edited"

- **WHEN** the planner's and `formio-actions`' persona-action text is read
- **THEN** it states create-only and does not say "created or edited"
