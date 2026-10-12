## Purpose

Defines the boundary the `formio-actions` skill holds: it claims per-form action mechanics and routes authentication architecture to `formio-auth`.
## Requirements
### Requirement: formio-actions claims per-form action mechanics and routes auth architecture to formio-auth

The `formio-actions` `SKILL.md` frontmatter `description` SHALL keep its trigger surface scoped to per-form action mechanics — adding, configuring, or troubleshooting actions on a form, choosing an action type, the action execution lifecycle, action settings/priorities/conditions/handlers, and the per-form shapes of email, login, webhook, role, save, and reset-password actions. It SHALL contain a `Not for:` clause naming the backtick-delimited `` `formio-auth` `` for auth-architecture concerns — SSO (OIDC/OAuth/SAML/LDAP), Token Swap, Custom JWT, JWT/session mechanics, 2FA, and RBAC tuning.

#### Scenario: Actions description names formio-auth

- **WHEN** the `formio-actions` `SKILL.md` frontmatter is inspected
- **THEN** its `description` contains a `Not for:` clause naming `` `formio-auth` ``

#### Scenario: Per-form action phrasing routes to formio-actions

- **WHEN** the user says "send an email when someone submits" or "what priority should this webhook action run at"
- **THEN** `formio-actions` activates
- **AND** `formio-auth` does not activate

#### Scenario: Auth-architecture phrasing does NOT route to formio-actions

- **WHEN** the user says "set up OIDC SSO with role mapping" or "how do Form.io sessions and the x-jwt-token work"
- **THEN** `formio-auth` activates
- **AND** `formio-actions` does not activate

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

