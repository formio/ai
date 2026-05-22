# Email-token authentication

## Overview

Email-token (passwordless) authentication issues a one-time login link via email instead of asking the user for a password. The user submits a form with their email address; Form.io's Email Authentication action generates a short-lived token, emails it to the user as a magic link, and on click the token is exchanged for a Form.io JWT. The result is a regular Form.io session indistinguishable from Resource-backed login or SSO.

## When to use this

Reach for email-token auth when:

- The product wants a passwordless onboarding or sign-in flow.
- Account verification on first login should be free (the email click proves the address belongs to the user).
- The user population is comfortable with magic-link UX (consumer apps, light-touch B2B portals).

Not for:

- Backend service authentication → use [`custom-jwt.md`](./custom-jwt.md) or [`token-swap.md`](./token-swap.md).
- High-friction enterprise environments with mandatory IdP federation → see [`sso-oidc.md`](./sso-oidc.md), [`sso-saml.md`](./sso-saml.md), [`sso-ldap.md`](./sso-ldap.md).
- Per-submission anonymous verification (e.g. "confirm your email before this form's submission counts") — that is a separate workflow, not a login.

## Configuration

### The two-form pattern

Email-token auth uses two cooperating forms:

1. **Send-link form** — collects the user's email address. The Email Authentication action on this form generates the magic-link token and emails it. The form responds with "Check your inbox," not a JWT.
2. **Verify-link form** — the URL embedded in the email points here, with the token in the URL. The Email Authentication action on this form consumes the token, locates or creates the matching `user` submission, and issues a Form.io JWT in the `x-jwt-token` response header.

Both forms have anonymous `create_own` `submissionAccess` so unauthenticated visitors can post them.

### The Email Authentication action

The Email Authentication action carries:

- `settings.resources` — the user Resource(s) to look up by email (typically `["user"]`).
- `settings.username` — the field that holds the email address (typically `"email"`).
- `settings.transport` — email transport configuration (SMTP host, sender address). Usually inherits from the project's email settings.
- `settings.template` — the email body template, including the magic link with the token placeholder.
- `settings.expiration` — token lifetime in seconds (typical 15 minutes; tight enough to limit replay, loose enough to survive an inbox delay).

For action shape conventions in `template.json`, see `plugin/skills/formio-resource-planner/references/template-json.md` for general action authoring patterns. The Email Authentication action is configured most easily via the Form.io project portal because of the transport and template fields.

### Auto-create vs require-pre-existing user

The action can be set to auto-create a `user` submission on first verification (so a brand-new email becomes a Form.io user on click) or to require an existing `user` submission (so unknown emails simply fail to log in). Pick based on whether self-service onboarding is acceptable.

### Role assignment on first verification

When auto-create is enabled, attach a Role Assignment action to the verify-link form (priority 1, `handler: ["after"]`, `settings.association: "new"`, `settings.role: "authenticated"`) so first-time users land with a default role. For the canonical Role Assignment Action JSON shape see `plugin/skills/formio-resource-planner/references/template-json.md` lines 535–553.

### Security considerations

- Set a short `settings.expiration` (15 minutes is a sane default). Tokens that linger in email forever are a credential.
- Bind the token to the originating IP / user agent if the deployment allows it — Form.io's transport layer will log replays but does not by default reject token re-use across devices.
- Use HTTPS everywhere. A token traveling over plaintext is identical in value to a password.
- Rate-limit the send-link form (an `attemptWindow` / `allowedAttempts` style guard) to slow inbox-flood abuse.

## MCP Tool Preference

- `form_create` / `form_update` — create the send-link form and the verify-link form, including their `access` and `submissionAccess` arrays.
- `action_create` — attach the Email Authentication action to each form. Use `action_type_get` on the `email` action type first to inspect its current `settings` schema (transport and template fields evolve faster than other actions, so prefer a runtime introspection over hard-coded settings).
- `action_list` / `action_update` — adjust transport, template, or expiration after the fact.
- `role_create` / `role_list` — for the Role Assignment that fires on first verification.

For SMTP transport secrets (host, port, credentials), use the Form.io project portal — those values are not exposed as MCP tools today.

## See also

- `formio-resource-planner` — owns the canonical Role Assignment Action shape used by the verify-link form. Use the planner to design the underlying `user` Resource and Role Assignment shape if they are not yet in place. See `plugin/skills/formio-resource-planner/references/template-json.md`.
- [`resource-auth.md`](./resource-auth.md) — the underlying six-step Form.io auth flow that email-token auth slots into.
- [`jwt-and-sessions.md`](./jwt-and-sessions.md) — the JWT the verify step returns and how sessions / logout work after that.
- [`roles-and-permissions.md`](./roles-and-permissions.md) — what the assigned default role can do.
