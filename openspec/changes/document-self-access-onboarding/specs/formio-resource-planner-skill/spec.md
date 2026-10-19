## ADDED Requirements

### Requirement: The canonical user resource carries Self Access

The canonical `user` resource in `references/template-json.md` SHALL include `{ "type": "self", "roles": [] }` in its `submissionAccess`, SHALL state that the entry stays whenever the resource grants `update_own` (so a user can update their own record however the account was created), and the template self-check SHALL include a line for it. When the plan has the application create user records directly on the user resource, the planner SHALL emit an unconditional `user:role` Role Assignment on that resource unless the multi-role `user:role<Persona>` set already covers it.

The planner's example templates under `references/examples/` SHALL carry the same entry on their user resource.

#### Scenario: Canonical user resource has the self entry

- **WHEN** the canonical `user` resource block in `template-json.md` is read
- **THEN** its `submissionAccess` contains `{ "type": "self", "roles": [] }`
