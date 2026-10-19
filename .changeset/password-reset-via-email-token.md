---
'@formio/ai': patch
---

Build password reset from the email-token macro and Self Access instead of the Reset Password action.

- `formio-auth`: `email-auth.md` documents the token lifetime (`[[token(data.email=user),30]]`, default 120 minutes, counted from when the email is sent) and a password-reset recipe — a one-field request form with an Email action, and a reset page that signs in with `Formio.setToken()`, saves the new password to the user's own record, and logs out so the link cannot be reused. The description names password reset.
- `formio-actions`: the Reset Password action is no longer documented; password reset points to `formio-auth`.
- `formio-sdk`: `Formio.setToken(token)` resolves the signed-in user and `setToken(null)` resolves `null`.
