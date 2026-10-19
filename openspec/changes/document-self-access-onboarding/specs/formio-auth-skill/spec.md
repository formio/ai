## ADDED Requirements

### Requirement: formio-auth MUST document Self Access without an owner requirement

`references/roles-and-permissions.md` SHALL describe Self Access as the `{ "type": "self" }` entry in a user-type resource's `submissionAccess` (the portal's "Self Access" checkbox), SHALL state that it lets a user signed in as a record of that resource exercise their role's `*_own` permissions on that record whatever the record's `owner` holds, and SHALL state that the record needs a role holding `read_own` / `update_own` from a Role Assignment action — on the user resource itself for records created directly there. It SHALL state that a create needs no `owner` field. It SHALL NOT tell the reader to write the submission's own `_id` into `owner`, and no document in the library SHALL ask for an `owner` value (`''` or `null`) to make Self Access work.

`references/email-auth.md`'s onboarding workflow SHALL name Self Access on the user resource and a Role Assignment action.

#### Scenario: Self Access names the entry, the role, and no owner value

- **WHEN** the "Self Access and user onboarding" section of `roles-and-permissions.md` is read
- **THEN** it contains `{ "type": "self" }`, `update_own`, and Role Assignment
- **AND** it states that a create needs no `owner` field

#### Scenario: Onboarding workflow carries Self Access and a role

- **WHEN** the "Typical user onboarding workflow" section of `email-auth.md` is read
- **THEN** it names Self Access and a Role Assignment action
