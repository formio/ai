## ADDED Requirements

### Requirement: email-auth.md MUST document password reset and the token lifetime

`plugin/skills/formio-auth/references/email-auth.md` SHALL contain a "Token lifetime" section stating that a number after the macro's closing parenthesis sets the lifetime in minutes (`[[token(data.email=user),30]]`), that the default is 120 minutes, and that the lifetime runs from when the email is sent.

It SHALL contain a "Password reset" section that builds password reset from: Self Access on the user resource (linking to `roles-and-permissions.md`); a request form with one email field, Anonymous `create_own`, an Email action whose **To** is the address typed and whose message carries a link with `[[token(data.email=user)]]`, and no Save Submission action; and a reset page that reads the token with `Formio.pageQuery()`, clears any stored session with `Formio.setToken(null)` (with a user stored, `setToken` resolves it without checking the new token), signs in with `Formio.setToken()`, saves only `data` with the new password to the signed-in user's own record, and then calls `Formio.logout()`. The callback-page example SHALL clear the stored session the same way. It SHALL state that saving a new password ends the user's other sessions and that the logout ends the session the link carries.

The `formio-auth` `SKILL.md` description SHALL name password reset among the auth concerns it covers.

#### Scenario: Reset recipe uses the token and Self Access

- **WHEN** the "Password reset" section of `email-auth.md` is read
- **THEN** it contains `[[token(data.email=user)]]`, `Formio.setToken`, `Formio.logout`, and a link to `roles-and-permissions.md`

#### Scenario: Lifetime is stated

- **WHEN** the "Token lifetime" section of `email-auth.md` is read
- **THEN** it states the 120-minute default and shows a macro with a lifetime number
