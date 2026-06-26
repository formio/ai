# Resource-backed authentication

## Overview

Resource-backed authentication is Form.io's first-party identity mechanism. A submission of a Form.io Resource (typically the built-in `user` resource) represents an authenticated user; a Login Action on a login form verifies credentials against that Resource and issues a JWT, and a Role Assignment Action on a registration form attaches a Form.io Role to the new submission immediately on signup. Together they cover the full "log in" and "sign up" surface for any Form.io project that does not rely on an external Identity Provider.

## When to use this

Reach for resource auth when the user wants:

- Email-and-password login backed by a Form.io Resource.
- A self-register flow that assigns an initial role on signup.
- A first-party identity store (no external IdP, no SSO, no Custom JWT).
- Brute-force protection on a login form (allowed attempts, attempt window, lock duration).

Not for:

- Federated identity (OIDC / SAML / LDAP) → see [`sso-oidc.md`](./sso-oidc.md), [`sso-saml.md`](./sso-saml.md), [`sso-ldap.md`](./sso-ldap.md).
- Exchanging an external bearer token for a Form.io JWT → see [`token-swap.md`](./token-swap.md).
- Forging a JWT in your own backend → see [`custom-jwt.md`](./custom-jwt.md).
- Passwordless email-link auth → see [`email-auth.md`](./email-auth.md).

## Configuration

### Six-step Form.io authentication flow

1. **Authentication Method Selection** — pick one of OAuth/OIDC, SAML, LDAP, or Resource-based. For this doc, Resource-based.
2. **Authentication Form Configuration** — build a login form that collects `email` and `password`, plus a registration form that collects the same fields and any profile data.
3. **Authentication Request** — the user submits the login form. The submission payload reaches the Form.io server.
4. **Verification** — the Login Action looks up a matching submission of the configured Resource (`settings.resources`), runs a one-way hash comparison on the password, and gates the submission.
5. **Authentication Success** — Form.io generates a JWT representing the matched user submission, attaches it to the response, and assigns roles via the Role Assignment configured on the user (Resource Role Assignment).
6. **Additional Security Measures** — layer 2FA and reCAPTCHA via [`jwt-and-sessions.md`](./jwt-and-sessions.md) when policy demands them.

### JWT on the wire

Every request to these endpoints MUST include an `x-jwt-token` header holding the user JWT issued by the MCP server's browser-based portal-login flow. The MCP server attaches this header automatically via `formioFetch`; external clients must obtain the JWT through the same portal-login flow. Do not use any other authentication mechanism with these endpoints.

On the renderer side, the response header `x-jwt-token` is persisted into the browser's `localStorage` under the key `formioToken`, and the renderer attaches it to every subsequent Form.io request.

### Login form + Login Action

The login form is a normal Form.io form with two components — `email` (type `email`) and `password` (type `password`, `persistent: false`). It needs:

- `access`: `read_all` for all three default roles (Administrator, Authenticated, Anonymous), so unauthenticated visitors can load the form definition.
- `submissionAccess`: `create_own` for `anonymous` (so visitors can submit it).
- One Login Action attached to the form.

The Login Action's `settings.resources` should be `["user"]` for most cases (or whichever Resource holds the credentials, such as `"admin"` for applications requiring admin logins). `settings.username` names the field that holds the username/email (typically `"email"`); `settings.password` names the password field (typically `"password"`). Brute-force protection is controlled by `allowedAttempts`, `attemptWindow`, and `lockWait`.

For the canonical Login Action JSON shape (priority, handler, method, all field names), see `plugin/skills/formio-resource-planner/references/template-json.md` lines 504–534.

### Registration form + Role Assignment Action

The registration form is a separate form (typically `userRegister`) that writes a new submission into the `user` Resource. It needs:

- A Role Assignment Action (`name: "role"`, `settings.association: "new"`, `settings.type: "add"`, `settings.role: "authenticated"`, `priority: 1`, `handler: ["after"]`) to attach the initial role to the new submission.
- A Login Action immediately afterward (priority 2, `handler: ["before"]`) so the new user is logged in without a second round-trip.

For the canonical Role Assignment Action JSON shape, see `plugin/skills/formio-resource-planner/references/template-json.md` lines 535–553.

### The `user` Resource

The canonical `user` Resource holds `email` (unique, `protected: false`) and `password` (`protected: true`). Its `submissionAccess` grants the administrator full CRUD and the authenticated role `read_own` + `update_own`. See the planner reference at `plugin/skills/formio-resource-planner/references/template-json.md` lines 409–437.

## MCP Tool Preference

Prefer the first-party MCP tools when wiring this auth flow:

- `authenticate` — obtain a Form.io portal JWT for the MCP server itself the first time you connect.
- `role_list`, `role_create`, `role_update` — inspect and create the roles you assign (typically `administrator`, `authenticated`, `anonymous`).
- `form_create`, `form_get`, `form_update` — create the login form, the registration form, and the `user` Resource. Use `form_update` to adjust `access` / `submissionAccess` on each.
- `action_create`, `action_list`, `action_update` — attach the Login Action and Role Assignment Action to the appropriate forms. Use `action_type_get` to inspect each action's `settings` schema before creating.
- `project_export` / `project_import` — round-trip a full project (resources, forms, actions, roles) as a `template.json`. The planner emits this shape and `project_import` consumes it.

If you are seeding a fresh project from a planner-produced `template.json`, `project_import` is the single call that creates the user Resource, the login/registration forms, and all three actions in one shot — no need to drive `form_create` + `action_create` individually.

## See also

- `formio-resource-planner` — owns the canonical JSON shapes for the user Resource, login/registration forms, the Login Action, and the Role Assignment Action. Run the planner first if any of these do not yet exist in the project. See `plugin/skills/formio-resource-planner/SKILL.md` and `plugin/skills/formio-resource-planner/references/template-json.md`.
- [`login-forms.md`](./login-forms.md) — login + registration form shapes in more detail.
- [`roles-and-permissions.md`](./roles-and-permissions.md) — what each role can do and how the eight permission types layer onto these forms.
- [`jwt-and-sessions.md`](./jwt-and-sessions.md) — the JWT payload Form.io returns, `jti` Session ID, logout, 2FA, reCAPTCHA.
