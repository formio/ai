# Token Swap

## Overview

Token Swap is the pattern of exchanging an externally-issued OIDC/OAuth bearer token for a first-party Form.io JWT. Unlike the interactive OIDC SSO flow (a "Sign in with..." button), Token Swap happens server-to-server or in a single API call: the caller already has a valid IdP access token, Form.io validates it against the configured provider, locates or creates the matching `user` submission, applies the same OAuth Role Mapping the interactive flow uses, and returns a Form.io JWT in the `x-jwt-token` response header.

## When to use this

Reach for Token Swap when:

- The user has already authenticated against the IdP elsewhere (e.g. a mobile app shell, a Backend-for-Frontend, a federated portal) and you do not want to re-render an OAuth button inside Form.io.
- Service-to-service calls need a Form.io JWT minted from an existing OAuth assertion.
- An identity-aware proxy or API gateway hands a bearer token to your backend, which forwards it to Form.io.

Not for:

- Interactive in-browser OIDC SSO → see [`sso-oidc.md`](./sso-oidc.md).
- SAML assertions → see [`sso-saml.md`](./sso-saml.md).
- LDAP credentials → see [`sso-ldap.md`](./sso-ldap.md).
- Issuing a Form.io JWT entirely from your own backend without an IdP at all → see [`custom-jwt.md`](./custom-jwt.md).

## Configuration

### Prerequisites

- The OIDC/OAuth provider is already configured in the project portal exactly as for interactive SSO (Client ID/Secret, scopes, User Info URL, OAuth Role Mapping). See [`sso-oidc.md`](./sso-oidc.md) for the provider configuration.
- The Form.io project has at least one `user` Resource (or whatever Resource the OAuth provider settings point at).
- The IdP access token you intend to swap is fresh, signed with the same keys the provider settings reference, and carries the scopes / claims that Role Mapping reads.

### The exchange

Token Swap is performed by POSTing the IdP token to Form.io's token-swap endpoint with the provider name in the URL. Form.io:

1. Calls the IdP's introspection / User Info endpoint with the supplied access token.
2. Locates or creates the matching `user` Resource submission (auto-create vs require-pre-existing follows the project's OAuth Action setting).
3. Applies OAuth Role Mapping to attach Form.io Roles to the user.
4. Generates and signs a Form.io JWT.
5. Returns the JWT in the `x-jwt-token` response header. The caller persists it (browser: `localStorage.formioToken`; service: an internal cache keyed by user) and attaches it to subsequent Form.io requests.

For the canonical endpoint URL and request shape, see the `runtime-auth` reference in the `formio-api` skill — Token Swap is documented there as the endpoint that consumes a provider bearer token and returns a Form.io JWT.

### Caching and rotation

- Cache the Form.io JWT until its `exp` claim approaches; re-swap before it expires. Repeated swaps with the same IdP access token are idempotent for the lifetime of the IdP token.
- When the IdP rotates the access token, the next Form.io call should drive a new swap with the new IdP token. Do not stockpile multiple Form.io JWTs for the same user.
- Logout invalidates the Form.io JWT's `jti` Session ID at the Form.io side; it does NOT log the user out of the IdP. See [`jwt-and-sessions.md`](./jwt-and-sessions.md).

### Failure modes

- **Provider not configured** — `404` / configuration error. Configure the provider in the portal first.
- **IdP token invalid or expired** — `401`. Refresh the IdP token, then swap again.
- **No matching `user` and auto-create disabled** — `401` / provisioning error. Either enable auto-create or seed the `user` Resource ahead of the swap.
- **Role Mapping returns no rows** — the user is granted the default Form.io Role (typically Authenticated) and the swap still succeeds. Tighten Role Mapping if you want a hard fail.

## MCP Tool Preference

Token Swap provider configuration (Client ID/Secret, User Info URL, Role Mapping) MUST be performed via the Form.io project portal. The exchange call itself is an HTTP endpoint, not an MCP tool. Surrounding workflow:

- Use `role_list` / `role_create` to ensure the Form.io Roles your OAuth Role Mapping targets exist.
- Use `authenticate` once on the MCP server to obtain a portal JWT for project administration calls (the portal JWT is separate from any user JWT produced by Token Swap).
- For the runtime endpoint reference, navigate the `formio-api` skill's `runtime-auth` reference, which carries the canonical endpoint path and request body for the swap.

## See also

- [`sso-oidc.md`](./sso-oidc.md) — interactive OIDC SSO and OAuth Role Mapping, which Token Swap reuses verbatim.
- [`custom-jwt.md`](./custom-jwt.md) — when there is no IdP and the backend signs Form.io JWTs directly with `JWT_SECRET`.
- [`jwt-and-sessions.md`](./jwt-and-sessions.md) — the Form.io JWT payload that Token Swap returns, the `jti` Session ID, and logout semantics.
- [`roles-and-permissions.md`](./roles-and-permissions.md) — the role IDs OAuth Role Mapping references.
