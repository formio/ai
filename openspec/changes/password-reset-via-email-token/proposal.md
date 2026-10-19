## Why

Password reset in Form.io applications is better built from the Email action's `[[token(...)]]` macro than from the Reset Password action. The macro mints a sign-in link whose lifetime the application chooses (default 120 minutes), lands on a page the application owns, and — with the Self Access guidance from `document-self-access-onboarding` — lets the signed-in user change their own password with an ordinary update of their own record. The same page serves first-time onboarding ("set your password"). The Reset Password action's link lifetime is fixed at five minutes and its two-phase form rewriting is not something the application controls, so the skills should not offer it.

Verified against nirvana `apps/formio-server`: `src/util/util.js` (`tokenRegex`, `ssoTokens` — lifetime default 120), `src/hooks/alter/email.js` (token signed with `expiresIn: expireTime * 60`, a session per token), `src/middleware/logout.js` (logout marks the request's session ended), `src/hooks/settings.js` `invalidateTokens` and `node_modules/formio/src/actions/fields/password.js` (a password change ends every other session of the user).

## What Changes

- **`formio-actions`**: remove the Reset Password action — the quick-reference row, the "Password reset flow" section, and the `action-types.md` section and table-of-contents entry. `SKILL.md` points password reset to `formio-auth`. The description no longer claims reset-password actions.
- **`formio-auth`**: `email-auth.md` gains a "Token lifetime" section and a "Password reset" section (request form, Email action, reset page, session behaviour, security notes). The description names password reset.
- **`formio-angular`**: `AUTH.md` mounts the email-token reset page on the `resetpass` route `FormioAuthRoutes()` already provides, instead of the stock page.
- **`formio-sdk`**: `setToken(token)` resolves the signed-in user (it calls `currentUser`) and `setToken(null)` resolves `null`, not `void`; `auth.md` and `setup.md` say so, pinned by a test.
- **Routing eval**: a `password-reset-flow` prompt expecting `formio-auth`.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `formio-actions-skill`: the description scope requirement drops reset-password actions; a requirement that the skill documents no Reset Password action.
- `formio-auth-skill`: a requirement for the token-lifetime and password-reset sections.
- `formio-angular-skill`: a requirement that the `resetpass` route hosts the email-token reset page.
- `formio-sdk-skill`: a requirement that `setToken` is documented as resolving the signed-in user.

## Impact

- `plugin/skills/formio-actions/SKILL.md`, `plugin/skills/formio-actions/references/action-types.md`, `plugin/skills/formio-auth/SKILL.md`, `plugin/skills/formio-auth/references/email-auth.md`, `plugin/skills/formio-sdk/references/auth.md`, `plugin/skills/formio-sdk/references/setup.md`, `plugin/skills/formio-angular/AUTH.md`.
- New tests in `packages/skill-tests/src/source-facts/`.
- `packages/skill-tests/evals/skill-routing/evals.json`; the description snapshot fixture `descriptions-before-preflight.json` records the two description changes.
- The MCP server still lists `resetpass` from `action_type_list` when the deployment offers it; nothing in the server changes.
