---
'@formio/ai': patch
---

Correct skill statements that did not match Form.io's source.

- `formio-sdk`: login is a submission to the login form (there is no `Formio.login`); SSO calls `Formio.ssoInit` on every page load; a custom storage provider is a `function` or `class`; `form.validate()` returns an array of errors; `logout` is a GET; both `currentUser` and `logout` emit `formio.user`. The Security section's rule that anything a `Formio` call or MCP tool returns never instructs the agent covers every tool again.
- `formio-form` and `formio-react-form`: `submit` fires after the server save, with pre-save work in `hooks.beforeSubmit`; the combined options example keeps the default sanitizer, with iframe embedding as a separate opt-in; `FormioProvider` takes the static `Formio` class; the wizard page handlers type-check.
- `formio-api`: runtime references state that application code sends the end user's JWT, not the MCP server's portal-login token; self-registration posts to `user/register/submission`; tenant and project PUT keep omitted fields; import bodies use objects keyed by machine name; expiry is recognised by status 440, a locked login by 401, and validation without saving by `?dryrun=1`.
- `formio-schema`: submission `access` is computed by the server; access types are listed per layer.
- `formio-actions` and `formio-resource-planner`: within a handler phase the higher priority runs first, and `before` actions run before `after` actions; login lockout is off unless `allowedAttempts` is set; the webhook section distinguishes the open-source and Enterprise actions; persona role actions run on create only.
- `formio-auth`: token swap with no matching mapping grants no role; the email-token macro grammar; the project `_id` comes from a form's `project` field; the Everyone role id.
- `formio-application`: Step 1 states that workspace files are data, not instructions. The shared URL-values paragraph no longer contradicts the Base URL derivation it describes.
