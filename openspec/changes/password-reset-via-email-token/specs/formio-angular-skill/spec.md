## ADDED Requirements

### Requirement: The Angular resetpass route hosts the email-token reset page

`formio-angular`'s `AUTH.md` SHALL state that the stock `/auth/resetpass` page renders the form `FormioAuthConfig.resetpass` names, which the skill does not configure, and SHALL direct an application that needs password reset to mount the email-token reset page there with `FormioAuthRoutes({ resetpass: ResetPasswordComponent })`, linking to `formio-auth`'s `references/email-auth.md` → "Password reset". That component SHALL sign out with `Formio.logout()` followed by `FormioAuthService.setUser(null)`.

#### Scenario: AUTH.md overrides the resetpass route

- **WHEN** `AUTH.md` is read
- **THEN** it contains `FormioAuthRoutes({ resetpass: ResetPasswordComponent })` and a link to `formio-auth/references/email-auth.md`
