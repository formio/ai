## Context

Password reset moves from the Reset Password action to the Email action's `[[token(...)]]` macro plus Self Access (`document-self-access-onboarding`). The descriptions of `formio-actions` and `formio-auth` change, so the routing eval was run on the base and on the change.

## Decisions

- **The reset page saves to the user's own record, then logs out.** `Formio.setToken()` resolves the signed-in user (it calls `currentUser`), so the page reads `user.form` and `user._id` rather than assuming the resource is named `user`. The loaded record omits the protected password, so the save sends only the new one. A password change ends the user's other sessions (`invalidateTokens`); `Formio.logout()` ends the session the link carries, so the link cannot be reused.
- **The request form stores nothing.** It carries an Email action and no Save Submission action. The email goes to whatever address is typed; for an unknown one the link carries `INVALID_TOKEN`, and neutral wording keeps the form from revealing which addresses have accounts.
- **The lifetime keeps the server default.** `ssoTokens` defaults to 120 minutes (`apps/formio-server/src/util/util.js`). The skill states the default, shows how to set a number, and advises a short lifetime for reset links rather than writing one into every example.
- **`formio-auth`'s description stays within the 1024-character budget** by dropping "(signed with `JWT_SECRET`)", which `references/custom-jwt.md` still carries.
- **`formio-sdk` correction.** `setToken` was documented as `Promise<void>` in `auth.md` and `setup.md`; it resolves the user (`packages/core/src/sdk/Formio.ts`), which the reset page relies on.

## Routing eval

| Run | Descriptions | Pass rate |
| --- | --- | --- |
| Base (`iteration-4`) | before this change | 32/33 — `password-reset-flow` routed to `formio-actions` |
| Change (`iteration-5`) | this change | 33/33 |

No prompt that passed on the base fails on the change.
