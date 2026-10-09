## ADDED Requirements

### Requirement: The template's shape is checked before it is sent

`project_import` SHALL refuse, with code `INVALID_ARGUMENT` and no request, a `template` whose `forms` or `resources` is missing or is not a plain object (an empty object is accepted), or whose `roles` or `actions`, when present, is not a plain object. The message SHALL name the key and say that Form.io templates key each entry by machine name.

#### Scenario: A template with no resources

- **WHEN** `project_import` is called with `{ forms: { contact: {...} } }`
- **THEN** the tool returns `INVALID_ARGUMENT` naming `resources`
- **AND** no request is sent

#### Scenario: Arrays instead of objects

- **WHEN** `project_import` is called with `forms: []`
- **THEN** the tool returns `INVALID_ARGUMENT` naming `forms`

#### Scenario: A valid template

- **WHEN** `project_import` is called with `{ roles: {}, resources: {}, forms: { contact: {...} }, actions: {} }`
- **THEN** the template is sent
