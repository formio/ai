## ADDED Requirements

### Requirement: formio-actions MUST describe action behaviour as the server implements it

`plugin/skills/formio-actions/SKILL.md` and `references/action-types.md` SHALL state:

- **Priority:** within one handler phase the action with the higher `priority` runs first, and every `before` action runs before every `after` action.
- **Login lockout:** off unless the Login action's `allowedAttempts` is set; once set, the failure after that many within `attemptWindow` locks the account for `lockWait`, and a locked login answers 401 even for the correct password.
- **Webhook:** which behaviour belongs to the open-source action and which to the Enterprise action — the URL interpolation context, the payload shape, whether the response is stored, how a failed request is reported, and the settings only Enterprise offers (method, headers, transform, external id, retries).
- **Email interpolation:** the Email action filters markup from the string values of `data` fields a form component declares; numbers, objects, multi-value arrays, undeclared keys, and values outside `data` reach the template as stored, and the template engine adds no escaping.
- **Blocking webhook response:** on Enterprise the response is stored with the submission only from a `before` handler and is present only on the returned submission from an `after` handler; the open-source action never reads the response and records `{}`.
- **Email template:** an unset or empty `template` sends the message with no wrapper.
- **`action_type_get`:** takes the form's `formId` and the `actionName`.

#### Scenario: Priority runs higher first

- **WHEN** the priority text in `SKILL.md` is read
- **THEN** it states that the higher number runs first and that `before` actions precede `after` actions

#### Scenario: Lockout is opt-in

- **WHEN** the Login action section is read
- **THEN** it states that no lockout applies unless `allowedAttempts` is set

#### Scenario: Webhook names both editions

- **WHEN** the webhook section is read
- **THEN** it names the open-source and Enterprise behaviour separately

#### Scenario: No default email wrapper claim

- **WHEN** `references/action-types.md` is searched for "default wrapper"
- **THEN** no match is found
