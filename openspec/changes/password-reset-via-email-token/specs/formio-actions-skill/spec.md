## MODIFIED Requirements

### Requirement: formio-actions claims per-form action mechanics and routes auth architecture to formio-auth

The `formio-actions` `SKILL.md` frontmatter `description` SHALL keep its trigger surface scoped to per-form action mechanics — adding, configuring, or troubleshooting actions on a form, choosing an action type, the action execution lifecycle, action settings/priorities/conditions/handlers, and the per-form shapes of email, login, webhook, role, and save actions. It SHALL NOT name reset-password actions; a password-reset request belongs to `formio-auth`. It SHALL contain a `Not for:` clause naming the backtick-delimited `` `formio-auth` `` for auth-architecture concerns — SSO (OIDC/OAuth/SAML/LDAP), Token Swap, Custom JWT, JWT/session mechanics, 2FA, and RBAC tuning.

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

## ADDED Requirements

### Requirement: formio-actions documents no Reset Password action

`plugin/skills/formio-actions/SKILL.md` and `references/action-types.md` SHALL NOT document the Reset Password action — no `resetpass` row, settings table, JSON example, or `{{ resetlink }}` variable. `SKILL.md` SHALL state that password reset is built from the Email action's `[[token(...)]]` macro and Self Access, linking to `formio-auth`'s `references/email-auth.md` → "Password reset".

#### Scenario: No resetpass documentation

- **WHEN** `formio-actions/SKILL.md` and `references/action-types.md` are read
- **THEN** neither contains `resetpass` or `{{ resetlink }}`
- **AND** `SKILL.md` links to `formio-auth`'s `email-auth.md` for password reset
