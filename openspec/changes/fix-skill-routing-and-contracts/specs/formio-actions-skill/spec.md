## ADDED Requirements

### Requirement: The registration pattern saves users to the user resource

`formio-actions`' registration pattern SHALL update the Save action a new form receives by default so that `settings.resource` is the project's user resource `_id` and `settings.fields` maps the form's keys to that resource's keys, because a default Save stores submissions on the registration form itself, where Login — which searches only its `settings.resources` — never finds them. It SHALL add a Role Assignment action only when the user resource does not already assign the role, and SHALL route to `formio-resource-planner` when the project has no user resource. `formio-auth/references/login-forms.md` SHALL describe the same pattern.

#### Scenario: Registration Save points at the user resource

- **WHEN** the registration pattern in `formio-actions/SKILL.md` is read
- **THEN** it updates the default Save action's `settings.resource` to the user resource
- **AND** it does not describe Save as built-in and already correct

