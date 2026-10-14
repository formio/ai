## ADDED Requirements

### Requirement: The action tools accept every condition shape Form.io stores

`action_create` and `action_update` SHALL accept, and send unchanged, a `condition` of any shape Form.io stores:

- a `conjunction` of `''`, `all`, or `any`;
- `conditions` rows with a component, one of the server's operators, and a value;
- a `custom` string holding a JavaScript or JSON Logic condition;
- legacy keys such as `field` and `eq`;
- `null`.

`settings` may be `null`. No key of a condition SHALL be dropped.

#### Scenario: A portal-built action round-trips

- **WHEN** an action read with `action_get` has `condition: {conjunction: '', conditions: [], custom: 'show = data.amount > 100;'}` and is sent back unchanged with `action_update`
- **THEN** the update is accepted
- **AND** the stored condition still holds the same `custom`

#### Scenario: A custom condition is not dropped on create

- **WHEN** `action_create` is called with `condition: {conjunction: 'all', conditions: [], custom: 'show = true;'}`
- **THEN** the posted action carries `custom` unchanged
