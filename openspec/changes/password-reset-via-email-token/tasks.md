## 1. Password reset through the email token

<!-- depends_on: document-self-access-onboarding -->

### Red

- [x] 1.1 Write failing tests: `formio-actions/SKILL.md` and `references/action-types.md` contain no `resetpass` or `{{ resetlink }}` and `SKILL.md` links to `email-auth.md` for password reset; the `formio-actions` description does not mention reset password; `email-auth.md` has "Token lifetime" (120-minute default, a lifetime example) and "Password reset" (`[[token(data.email=user)]]`, `Formio.setToken`, `Formio.logout`, link to `roles-and-permissions.md`); the `formio-auth` description names password reset

### Green

- [x] 1.2 Remove the Reset Password action from `formio-actions` and point password reset to `formio-auth`; drop it from the description
- [x] 1.3 Add the token-lifetime and password-reset sections to `email-auth.md`; add password reset to the `formio-auth` description and reference list
- [x] 1.4 Add the `password-reset-flow` routing prompt

### Refactor

- [x] 1.5 Run the routing eval on the base and on the change (no prompt that passed before fails after; record both rates in `design.md`); run `pnpm test`, `pnpm lint`, `pnpm format`, and `openspec validate password-reset-via-email-token --strict`
