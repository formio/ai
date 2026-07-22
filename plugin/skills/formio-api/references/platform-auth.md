## Overview

Platform-scope authentication covers the operations a _platform administrator_ performs against the Form.io portal user base: logging in to the platform as an admin, provisioning a new platform user, retrieving the currently logged-in user, logging out, and redirecting to configured identity providers (OIDC/SAML). These are distinct from `project-auth.md` (project admin login) and `runtime-auth.md` (end-user auth for a specific project).

## Root URL

All endpoints below are rooted at `${FORMIO_BASE_URL}` — the platform deployment endpoint, equivalent to bare `{{baseUrl}}/` in Postman.

## Authentication

Every request to these endpoints MUST include an `x-jwt-token` header holding the user JWT issued by the MCP server's browser-based portal-login flow. The MCP server attaches this header automatically via `formioFetch`; external clients must obtain the JWT through the same portal-login flow. Do not use any other authentication mechanism with these endpoints.

Note: `POST ${FORMIO_BASE_URL}/formio/user/login` is the endpoint that _issues_ a JWT. Clients that already hold a valid platform-admin JWT via the portal-login flow do not need to call it; only call it when you are exchanging email/password for a fresh JWT outside the portal-login flow. The returned JWT is delivered in the `x-jwt-token` response header.

## MCP Tool Preference

No MCP tool covers this operation — use the HTTP endpoint directly.

## Endpoints

### POST ${FORMIO_BASE_URL}/formio/user/login

Exchange platform-admin credentials for a JWT. The Portal Base project (`formio`) owns the user resource used by all platform admins.

Request body:

```json
{
  "data": {
    "email": "admin@example.com",
    "password": "CHANGEME"
  }
}
```

Response: the admin's user submission document. The JWT is returned in the `x-jwt-token` response header — consume it from there, not from the body.

Errors: `401` for invalid credentials; `400` for malformed body.

```bash
curl -D - -X POST -H "Content-Type: application/json" \
  -d '{"data":{"email":"admin@example.com","password":"CHANGEME"}}' \
  "${FORMIO_BASE_URL}/formio/user/login"
```

### POST ${FORMIO_BASE_URL}/formio/user

Create a new platform user (a standard, non-admin portal user). A platform admin JWT is required to invoke this.

Request body:

```json
{
  "data": {
    "fullName": "Developer",
    "email": "user@example.com",
    "password": "CHANGEME"
  }
}
```

Response: the created user submission document. The new user receives the default authenticated role for the platform project.

Errors: `400` on duplicate email or missing fields; `401`/`403` if the caller lacks permission to create platform users.

### POST ${FORMIO_BASE_URL}/formio/user/login (as a platform user)

Same endpoint as the admin login above, but invoked with a regular platform user's credentials. Form.io does not distinguish admin vs user at the endpoint level — role membership in the response body determines capability.

### GET ${FORMIO_BASE_URL}/current

Return the submission document for the currently authenticated platform user.

Response: the user's submission document (same shape as login response, minus JWT issuance). `401` if the `x-jwt-token` header is missing or expired.

```bash
curl -H "x-jwt-token: $FORMIO_JWT" "${FORMIO_BASE_URL}/current"
```

### GET ${FORMIO_BASE_URL}/formio/logout

Invalidate the current platform session on the server side. The client should also discard its cached JWT.

Response: `200 OK` with body `OK`.

```bash
curl -H "x-jwt-token: $FORMIO_JWT" "${FORMIO_BASE_URL}/formio/logout"
```

### Using Identity Providers

Form.io supports OIDC and SAML via the Portal Base project's configured SSO settings. The Postman documentation does not expose a single URL for this — instead, clients initiate a browser redirect to the configured provider. Consult the Portal Base project's Admin → Login Form settings for the exact provider-specific URLs. Response shape inferred from Form.io conventions: after successful SSO the provider posts back to the Form.io callback and Form.io issues a platform JWT through the standard `/formio/user/login` flow.

## Related Skills

- [project-auth](./project-auth.md) — project-admin authentication (distinct user base, project-scoped)
- [runtime-auth](./runtime-auth.md) — end-user authentication within a specific project
- [platform-projects](./platform-projects.md) — project CRUD once authenticated as a platform admin
- [platform-teams](./platform-teams.md) — team membership for platform users
