# Token Swap

## Overview

Token Swap exchanges an externally-issued OAuth/OIDC bearer token for a first-party Form.io token. The canonical use case is **embedding Form.io forms inside an existing application that already has its own OAuth authentication**. That host application already holds a Bearer token from the OAuth provider; Token Swap trades that token for a Form.io token so that every subsequent interaction with Form.io is authenticated with the new Form.io token — no separate "Sign in with..." step inside Form.io.

Token Swap is **Remote Authentication**, exactly like interactive OIDC SSO: Form.io does not look up or create a `user` Resource submission. It uses the supplied OAuth token to fetch the user information from the provider, builds an **ephemeral user object**, applies OAuth Role Mappings (defined in the project settings), and encodes that user — profile data plus mapped roles — **entirely within the Form.io token**.

## When to use this

Reach for Token Swap when:

- Form.io forms are embedded in an existing application that already authenticated the user via OAuth, and you do not want a second "Sign in with..." step inside Form.io.
- The host app (mobile shell, Backend-for-Frontend, federated portal) already holds a valid OAuth bearer token and wants to reuse it to authenticate Form.io.

Not for:

- Interactive in-browser OIDC SSO → see [`sso-oidc.md`](./sso-oidc.md).
- SAML assertions → see [`sso-saml.md`](./sso-saml.md).
- LDAP credentials → see [`sso-ldap.md`](./sso-ldap.md).
- Issuing a Form.io JWT entirely from your own backend without an IdP at all → see [`custom-jwt.md`](./custom-jwt.md).

## Configuration
In order to perform a token swap, the project's OpenID settings must be configured. See [`sso-oidc.md`](./sso-oidc.md) for instructions on these configurations.

**Important: You must also ensure you have the role mappings configured within the project settings to properly map the OIDC claims with the Form.io Roles.**

OAuth Role Mapping is the bridge between an IdP role claim (e.g. `groups`, `roles`, `https://my-app/roles`) and Form.io Roles. The Project's OAuth settings page exposes a mapping table:

- Pick the claim path (e.g. `roles`) the IdP returns.
- For each claim value (e.g. `admin`, `marketing`, `external`), choose the Form.io Role it maps to.
- A user may match multiple rows; the resulting `roles` array is the union.

### Prerequisites

- An existing OAuth authorization token (Bearer or other) issued to the user by the OAuth provider. In the embedded use case the host application already holds this token.
- **OpenID / OpenID Connect settings configured in the Form.io project** (the provider configuration Form.io uses to validate the token and locate the provider's user-info endpoint, plus OAuth Role Mapping). See [`sso-oidc.md`](./sso-oidc.md) for the provider configuration.
- The provider's **`/userInfo` endpoint must be exposed** — Form.io calls it with the supplied authorization token to retrieve the user information that becomes the ephemeral user.

### Performing the swap

The swap is driven by the Form.io JavaScript SDK's `currentUser` call. Instantiate `Formio` against the project URL, attach the OAuth token as an `Authorization` header, and call `currentUser` with `external: true`:

```js
import { Formio } from '@formio/js';

// For token swap to work, your application must set the baseUrl and projectUrl.
const projectUrl = 'https://yourdomain.com/yourproject';
Formio.setBaseUrl('https://yourdomain.com');
Formio.setProjectUrl(projectUrl);

// A simple token swap function.
async function tokenSwap(authToken) {
    return await (new Formio(projectUrl)).currentUser({
        external: true,
        headers: {
            Authorization: authToken
        },
    });
}

// Swap the bearer token with an authenticated Form.io user with a valid JWT token.
const user = await tokenSwap('Bearer 2e762950-9498-4079-a699-xxxxxxxxxxxx');

// Any other calls will now use the `x-jwt-token` swapped. In this example, this would be a submission
// made to the 'myform' using the correct JWT token.
(new Formio(`${projectUrl}/myform`)).saveSubmission({
    data: {
        firstName: user.data.firstName, // This data comes from the OIDC userInfo
        lastName: user.data.lastName
    }
});
```

`external: true` tells `currentUser` to treat the `Authorization` header as an external OAuth token to swap, rather than an existing Form.io token. On that call Form.io:

1. Takes the bearer token off the `Authorization` header.
2. Calls the OAuth provider's `/userInfo` endpoint with that token to retrieve the user information.
3. Builds an ephemeral user from that information and applies OAuth Role Mapping to attach Form.io Roles (Remote Authentication — no `user` submission is created or looked up).
4. Mints a new Form.io token and passes it back to the Form.io library.
5. The SDK stores the Form.io token and attaches it as the `x-jwt-token` header on every subsequent Form.io request — the OAuth token is no longer needed for Form.io calls.

### Caching and rotation

- The SDK holds the minted Form.io token after the swap; subsequent Form.io calls reuse it automatically. No need to re-send the OAuth token on every request.
- When the host application's OAuth token rotates or expires, re-run the `currentUser({ external: true, header })` swap with the new OAuth token to mint a fresh Form.io token.
- Logout invalidates the Form.io token's `jti` Session ID on the Form.io side; it does NOT log the user out of the OAuth provider. See [`jwt-and-sessions.md`](./jwt-and-sessions.md).

### Failure modes

- **OpenID / OIDC not configured** — Form.io cannot validate the token or find the provider; configure the provider's OpenID settings in the project first.
- **`/userInfo` endpoint not exposed or unreachable** — Form.io cannot fetch the user information, so no Form.io token is minted. Expose the provider's `/userInfo` endpoint.
- **OAuth token invalid or expired** — the provider rejects the `/userInfo` call; the swap fails. Refresh the OAuth token in the host app, then swap again.
- **Role Mapping returns no rows** — the user is granted the default Form.io Role (typically Authenticated) and the swap still succeeds.

## MCP Tool Preference

Token Swap provider configuration (OpenID / OIDC settings, Role Mapping) MUST be performed via the Form.io project portal. The swap itself is driven client-side by the Form.io JavaScript SDK (`currentUser({ external: true, header })`), not by an MCP tool. Surrounding workflow:

- Use `role_list` / `role_create` to ensure the Form.io Roles your OAuth Role Mapping targets exist.
- Use `authenticate` once on the MCP server to obtain a portal JWT for project administration calls (the portal JWT is separate from any user token produced by Token Swap).

## See also

- [`sso-oidc.md`](./sso-oidc.md) — interactive OIDC SSO and OAuth Role Mapping. For role mapping, token swap gets its roles from the project settings, whereas standard OIDC SSO gets the mappings from the login form's OAuth action.
- [`custom-jwt.md`](./custom-jwt.md) — when there is no IdP and the backend signs Form.io JWTs directly with `JWT_SECRET`.
- [`jwt-and-sessions.md`](./jwt-and-sessions.md) — the Form.io JWT payload that Token Swap returns, the `jti` Session ID, and logout semantics.
- [`roles-and-permissions.md`](./roles-and-permissions.md) — the role IDs OAuth Role Mapping references.
