## Overview

The runtime authentication API covers end-user (application user) account lifecycle inside a Form.io project: registering a new user through the default `user/register` form, logging in, retrieving the currently authenticated user, logging out, and recognizing an expired session. This skill documents the default `userRegister`/`userLogin` endpoints — for custom user types (e.g., `employee`) and role assignment wiring, see `runtime-custom-users.md`. For platform-admin auth use the `platform-auth` skill; for project-admin auth use `project-auth`.

## Root URL

All endpoints below are rooted at `{projectUrl}` — the project endpoint, equivalent to `{{baseUrl}}/{{projectName}}` in Postman.

## Authentication

Application code calling these endpoints at runtime sends the end user's JWT in the `x-jwt-token` header — the token the login form's Login action, or an SSO flow, returns in its `x-jwt-token` response header — or no token where the Anonymous role holds the permission. The JWT from the MCP server's browser-based portal-login flow authorizes only the server's own tool calls; application code neither receives nor sends it.

Note: the `Register` and `User Login` endpoints below are called without a token and are themselves the producers of a user JWT — on a successful response Form.io returns an `x-jwt-token` response header whose value is the user's JWT. Subsequent requests use that JWT in the request `x-jwt-token` header.

## MCP Tool Preference

No MCP tool covers these operations, and none should: they are **runtime** endpoints. The MCP tools exist for **build-time** work — creating and updating forms, actions, roles, and project settings while the application is being built. The endpoints below are called by the finished application, on behalf of the person using it, with that person's own token.

So this document is a specification for the code you write — the app's login, registration, and current-user calls at runtime — not a set of calls to make now. Do not authenticate as an end user yourself; the MCP server has its own build-time authentication, and it is separate from the one you are wiring up here.

## Endpoints

### POST {projectUrl}/user/register/submission

Register a new end user by submitting to the default `userRegister` form (path `user/register`). Its Save Submission action creates the `user` resource submission, the Role Assignment action on `user` adds the Authenticated role, and its Login action authenticates the new user. The default template grants Anonymous `create_own` on this form and no create permission on the `user` resource itself, so `POST {projectUrl}/user/submission` from an anonymous caller returns 401 — and, because the `user` resource carries no Login action, returns no token for any caller.

Request body (JSON):

```json
{
  "data": {
    "email": "Minerva.Sipes@yahoo.com",
    "password": "CHANGEME"
  }
}
```

Required fields: `data.email`, `data.password`. Additional fields are accepted when the register form and the `user` resource have been extended with matching components.

Response: the new user's submission document, including `_id`, `form` (the `user` resource ID), `owner`, `roles` (the default Authenticated role), `access`, `metadata`, and `data` (with the password stripped). The `x-jwt-token` response header carries the new user's JWT.

Errors: `400` if email/password are missing or the email is already taken; `401` if the project does not grant Anonymous create on the register form.

Example:

```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{"data":{"email":"new.user@example.com","password":"CHANGEME"}}' \
  "{projectUrl}/user/register/submission"
```

### POST {projectUrl}/user/login/submission

Authenticate an existing end-user against the default `userLogin` form. On success, Form.io validates the credentials against the `user` resource and issues a JWT.

Request body (JSON):

```json
{
  "data": {
    "email": "Minerva.Sipes@yahoo.com",
    "password": "CHANGEME"
  }
}
```

Required fields: `data.email`, `data.password`.

Response: the user submission document for the authenticated user (same shape as the create response — `_id`, `form`, `owner`, `roles`, `access`, `metadata`, `data`). The JWT is returned in the `x-jwt-token` response header; clients MUST persist this value for subsequent authenticated requests.

Errors: `400` for malformed bodies; `401` for invalid credentials or locked accounts (if the Login action has `allowedAttempts`/`lockWait` configured).

Example:

```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{"data":{"email":"new.user@example.com","password":"CHANGEME"}}' \
  "{projectUrl}/user/login/submission"
```

### GET {projectUrl}/current

Return the currently authenticated user's submission document. Used to rehydrate user state on app start or to check that a stored JWT is still valid.

Response: the full user submission document (same shape as the login response). Fields include `_id`, `form`, `owner`, `roles`, `access`, `metadata`, and `data`.

Errors: see the session-expired subsection below — status `440` indicates the JWT has expired or its session has ended.

Example:

```bash
curl -H "x-jwt-token: $FORMIO_JWT" \
  "{projectUrl}/current"
```

### GET {projectUrl}/logout

Invalidate the current user session. Form.io clears the JWT server-side so it can no longer be used.

Response: plain text `OK` on success.

Errors: generally idempotent — calling `logout` with an invalid or missing JWT still returns `OK`.

Example:

```bash
curl -H "x-jwt-token: $FORMIO_JWT" \
  "{projectUrl}/logout"
```

### GET {projectUrl}/current (session expired)

Same endpoint as `Get Current User`, but documents the expired-session behavior. When the supplied `x-jwt-token` has expired or its session has ended, Form.io answers with HTTP status `440` and a plain-text reason that varies with the cause — `Token Expired` (the JWT is past its `exp`), `Session no longer valid.` (after logout), `Session expired.` (the session lifetime was exceeded), `Token No Longer Valid` (the password changed after the token was issued). Key on the `440` status, not the text: clear the locally stored JWT and send the user to the login flow. A malformed token returns `400 Bad Token`.

Example:

```bash
curl -H "x-jwt-token: $EXPIRED_JWT" \
  "{projectUrl}/current"
```

## Related Skills

- [runtime-custom-users](./runtime-custom-users.md) — custom user types, custom roles, and Role Assignment actions for non-default auth flows
- [runtime-submissions](./runtime-submissions.md) — submitting form data after the user has authenticated
- [project-auth](./project-auth.md) — project-admin authentication (distinct from end-user auth)
- [project-roles](./project-roles.md) — configuring the roles that are assigned to authenticated users
