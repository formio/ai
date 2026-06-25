# Login and registration forms

## Overview

Login and registration forms are the user-facing surface of resource-backed authentication. Both are standard Form.io forms — the difference is in their access rules, the components they expose, and which Actions they carry. A login form gates an existing user submission and issues a JWT; a registration form writes a new submission into the `user` Resource and (typically) issues a JWT immediately after.

## When to use this

Reach for this reference when the user wants to:

- Build a login form from scratch.
- Add a self-register flow with anonymous create access.
- Tighten or loosen `access` / `submissionAccess` on an existing login form.
- Configure brute-force protection on a login form.

Not for:

- The Login Action's role in the six-step Form.io auth flow → see [`resource-auth.md`](./resource-auth.md).
- Assigning roles or extending the permission matrix → see [`roles-and-permissions.md`](./roles-and-permissions.md).
- Federated identity → see [`sso-oidc.md`](./sso-oidc.md), [`sso-saml.md`](./sso-saml.md), [`sso-ldap.md`](./sso-ldap.md).

## Configuration

### Login form

Components:

- `email` (type `email`, required).
- `password` (type `password`, `persistent: false` so it is not stored on the submission).
- A submit `button`.

Access:

- `access`: `read_all` granted to all three default roles (Administrator, Authenticated, Anonymous), so anonymous visitors can load the form definition.
- `submissionAccess`: `create_own` granted to Anonymous so visitors can post the form.

Actions:

- One Login Action with `settings.resources: ["user"]`, `settings.username: "email"`, `settings.password: "password"`, plus brute-force settings:
  - `allowedAttempts` — typically 5.
  - `attemptWindow` — seconds during which `allowedAttempts` is counted (typical 30).
  - `lockWait` — seconds the account stays locked after exceeding `allowedAttempts` (typical 1800 = 30 minutes).

For the full Login Action JSON shape (priority, handler, method, settings), see `plugin/skills/formio-resource-planner/references/template-json.md` lines 504–534.

### Registration form

Components:

- `email` (type `email`, required, `persistent: true`).
- `password` (type `password`, required, `persistent: true` — this row is the credential row).
- Any additional profile fields you want to capture at signup.
- A submit `button`.

Access:

- `access`: `read_all` to all three default roles.
- `submissionAccess`: `create_own` to Anonymous.

Actions (order matters because `priority` is the tie-breaker among handlers at the same phase):

1. **Save Submission** (built-in) — persists the new submission. Priority 10, `handler: ["before"]`.
2. **Role Assignment Action** — `settings.association: "new"`, `settings.type: "add"`, `settings.role: "authenticated"`. Priority 1, `handler: ["after"]`. Runs after the save so the new submission already has an `_id`.
3. **Login Action** — `settings.resources: ["user"]`, same field names as the login form. Priority 2, `handler: ["before"]`. Issues the JWT immediately so the new user is logged in without a second round-trip.

If the prompt specifically requires "admins" log into the application, then you may include `"admin"` in the Login Action's `settings.resources`. It should be noted, however, that most administrative work is performed via the Form.io project portal.

For the canonical action JSON shapes, see `plugin/skills/formio-resource-planner/references/template-json.md` lines 504–553.

### Anonymous vs admin write paths

The Resource Map terminology used by the planner:

- **Anonymous self-register**: registration form has `submissionAccess: create_own` for Anonymous. End users sign themselves up.
- **Admin-issued accounts**: registration form has `submissionAccess: create_all` for Administrator only. Admins seed users via the Form.io project portal (not via the app's UI). The login form is the only user-facing form.

## MCP Tool Preference

- `form_create` — create the login form and the registration form. Each form's `access` and `submissionAccess` arrays are part of the form payload.
- `form_get`, `form_update` — inspect or change `access` / `submissionAccess` on an existing form.
- `action_create` — attach the Login Action to the login form, and the Role Assignment + Login Actions to the registration form.
- `action_type_get` — inspect the Login Action and Role Assignment Action `settings` schemas before creating.
- `project_import` — when you are seeding from a planner-produced `template.json`, this single call creates both forms and all three actions at once. Prefer it over driving `form_create` + `action_create` individually for greenfield projects.

## See also

- `formio-resource-planner` — owns the canonical login and registration form JSON shapes plus the Login Action and Role Assignment Action shapes. Use the planner first if the forms do not yet exist. See `plugin/skills/formio-resource-planner/references/template-json.md` lines 504–553 and `plugin/skills/formio-resource-planner/references/examples/task-manager/template.json` for a working end-to-end example.
- [`resource-auth.md`](./resource-auth.md) — the six-step auth flow, the `x-jwt-token` header, and the `user` Resource shape.
- [`roles-and-permissions.md`](./roles-and-permissions.md) — what `access` and `submissionAccess` actually permit, and how the eight permission types interact.
- [`jwt-and-sessions.md`](./jwt-and-sessions.md) — the JWT that the Login Action returns and how the renderer carries it.
