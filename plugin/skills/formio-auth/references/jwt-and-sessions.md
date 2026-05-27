# JWT and sessions

## Overview

Every authenticated Form.io request rides a JSON Web Token (JWT) on the `x-jwt-token` header. The JWT is the unifying currency of every auth method in this skill: Resource login, OIDC SSO, SAML SSO, LDAP, Token Swap, Custom JWT, and email-token auth all return one to the caller. This reference documents the payload, the Session ID, the on-the-wire header, the logout semantics that invalidate a session, and the two additional security controls (2FA and reCAPTCHA) that layer on top of any underlying auth method.

## When to use this

Reach for this reference when:

- You need to know what's in the JWT (decode the payload, name the claims, explain `jti`).
- You need to know which header carries it and when.
- You need to invalidate a session (logout one device or all devices).
- You need to add 2FA or reCAPTCHA.
- You need to integrate Form.io auth with another system that consumes JWTs.

Not for:

- Choosing an auth mechanism in the first place — that's the rest of `formio-auth`'s reference docs.
- Designing role-keyed access — see [`roles-and-permissions.md`](./roles-and-permissions.md).

## Configuration

### The on-the-wire header

Every request to these endpoints MUST include an `x-jwt-token` header holding the user JWT issued by the MCP server's browser-based portal-login flow. The MCP server attaches this header automatically via `formioFetch`; external clients must obtain the JWT through the same portal-login flow. Do not use any other authentication mechanism with these endpoints.

The same header is used by the in-browser renderer, by service-to-service callers, and by Custom JWTs forged on a customer's backend. The token is also persisted by the renderer into `localStorage` under the key `formioToken`; the renderer re-attaches it on every subsequent Form.io request.

### JWT payload

A decoded Form.io JWT looks like this:

```json
{
  "user": { "_id": "5e5411ba1e29ee1aab5031d9" },
  "iss":  "https://api.form.io:3000",
  "sub":  "5e5411ba1e29ee1aab5031d9",
  "jti":  "5fffbb5646d76c292a7b5df1",
  "iat":  1610595158,
  "exp":  1610609558
}
```

Claim semantics:

- `user._id` — MongoDB ID of the user submission when the identity is backed by a `user` Resource row (Resource login). For SSO (Remote Authentication) and Custom JWTs there is no Resource row — the user is ephemeral and `user._id` is the `"external"` sentinel.
- `iss` — issuer; the Form.io API base URL.
- `sub` — subject; same as `user._id`.
- `jti` — Session ID. Logging out invalidates this; see below.
- `iat`, `exp` — issued-at and expiry timestamps (unix seconds).

SSO (OIDC/OAuth, SAML, LDAP, Token Swap) uses Remote Authentication: the ephemeral user built from the IdP is encoded directly into the JWT, so the token carries `user.data` (the mapped profile) and `user.roles` (from Role Mapping) rather than pointing at a Resource row. This is the same in-token user shape a Custom JWT carries — Custom JWTs additionally set `external: true`, `form: { _id: ... }`, and `project: { _id: ... }`. See [`custom-jwt.md`](./custom-jwt.md) for the full payload.

### Session ID (`jti`) and logout

`jti` is a Form.io-issued Session ID. The relationship between JWTs and sessions:

- A login (Resource, OIDC, SAML, LDAP, Token Swap, email-token) creates a Session ID and issues a JWT carrying that `jti`.
- A logout API call invalidates the Session ID. Every JWT that carries the invalidated `jti` immediately stops working — so logging out one device logs the user out of every device that holds a JWT for the same session.
- A user can hold multiple concurrent sessions (different devices, different logins) — each has its own `jti`. Invalidating one does not touch the others.

Custom JWTs (where the customer signs with `JWT_SECRET`) typically do not carry a `jti`. Revocation for those is done by rotating `JWT_SECRET` or by short TTLs — see [`custom-jwt.md`](./custom-jwt.md).

For the runtime logout endpoint URL and shape, see the `runtime-auth` reference in the `formio-api` skill.

### Token lifetime

Form.io JWTs expire at `exp`. After expiry, the renderer treats the user as anonymous and prompts for re-authentication. The deployment configures the lifetime; pick a value that balances UX against blast radius. Custom JWTs follow whatever `exp` the signing backend writes.

### 2FA

Two-Factor Authentication adds a second factor (typically a TOTP from an authenticator app) before Form.io issues the JWT. The 2FA flow:

1. User submits the login form with email + password (or completes the SSO handshake).
2. Form.io intercepts before issuing the JWT and presents the 2FA challenge.
3. User supplies the TOTP code.
4. On success, Form.io issues the JWT and the session begins normally.

2FA is configured at the project level in the portal. It layers on top of any of the underlying auth methods in this skill — the user-facing experience changes, but the JWT issued at the end is identical.

### CAPTCHA Component

The CAPTCHA Component gates form submission against bot abuse. It is wired as a premium component on the login or registration form, configured against a Google reCAPTCHA site key. When enabled, the Login Action / Email Authentication action will not run unless the reCAPTCHA token is present and valid.

Use a CAPTCHA Component on any user-facing auth form that anonymous users can hit (login, registration, send-magic-link). For SSO buttons (OIDC, SAML, LDAP) CAPTCHA usually adds little because the bot would also have to defeat the IdP.

### Decoding a JWT for debugging

The Form.io JWT is a standard JWS. Decode it with `https://jwt.io` or any standard JWT library to inspect the payload. Do not decode it client-side from untrusted input as a substitute for server-side validation.

## MCP Tool Preference

- `authenticate` — drive the MCP server's browser-based portal-login flow and obtain the portal JWT that `formioFetch` attaches to every subsequent call.
- For the runtime endpoint that invalidates a session (`/logout`) and the token-introspection endpoints, see the `runtime-auth` reference in the `formio-api` skill — those calls are HTTP endpoints, not MCP tools.
- For 2FA / reCAPTCHA configuration, use the Form.io project portal. No MCP tool covers premium component configuration today.

## See also

- [`resource-auth.md`](./resource-auth.md) — the six-step Form.io auth flow that issues the JWT this reference describes.
- [`custom-jwt.md`](./custom-jwt.md) — the customer-signed variant of this payload.
- [`token-swap.md`](./token-swap.md) — exchanging an external OIDC bearer token for one of these JWTs.
- [`sso-oidc.md`](./sso-oidc.md), [`sso-saml.md`](./sso-saml.md), [`sso-ldap.md`](./sso-ldap.md) — alternate methods that return this same JWT.
- [`roles-and-permissions.md`](./roles-and-permissions.md) — the role-keyed authorization the JWT identity is fed into at runtime.
