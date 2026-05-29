# SSO — OAuth / OIDC

## Overview

Form.io integrates with any OAuth 2.0 / OpenID Connect (OIDC) Identity Provider. The user authenticates against the IdP, the provider returns standard OAuth/OIDC claims, and Form.io exchanges those claims for a first-party Form.io JWT.

SSO in Form.io is **Remote Authentication**: Form.io does not look up or create a `user` Resource submission. Instead it retrieves user data from the IDP (using the `userinfo_endpoint`), dynamically builds an **ephemeral user object** from that information, and encodes that user — profile data plus mapped roles — **entirely within the Form.io JWT**. There is no database row for the user; everything the application needs about the identity travels inside the token. Provider roles are translated onto Form.io Roles via **OAuth Role Mapping**, so an SSO user lands with the same role-keyed `access` / `submissionAccess` evaluation that resource-backed users get.

## When to use this

Reach for OIDC SSO when:

- The organization runs an IdP like Okta, Auth0, Azure AD (Entra ID), Keycloak, or Google Workspace.
- Users should authenticate against the IdP, not against a Form.io `user` Resource.
- Provider role claims should govern Form.io Role assignment.
- A "Sign in with..." button on the Form.io login form is acceptable.

Not for:

- SAML-only providers → see [`sso-saml.md`](./sso-saml.md).
- LDAP directories → see [`sso-ldap.md`](./sso-ldap.md).
- Already-issued OIDC bearer tokens you want to swap for a Form.io JWT without re-authenticating → see [`token-swap.md`](./token-swap.md).
- Forging a JWT yourself in your backend → see [`custom-jwt.md`](./custom-jwt.md).

## Configuration

### Provider registration

OAuth/OIDC providers are configured on the Project's OAuth settings page in the Form.io portal. For each provider you supply:

- **Client ID** and **Client Secret** from the IdP.
- **Authorization URL** (authorization_endpoint), **Token URL** (token_endpoint), and **User Info URL** (userinfo_endpoint): (All three of these can be easily retrieved using the OIDC discovery document, e.g. `https://<issuer>/.well-known/openid-configuration`).
- **Scopes** — typically `openid profile email` plus any custom scopes that carry the role claim.

Refer to the per-provider sub-pages linked from `https://help.form.io/developers/auth/oauth#openid-connect-oidc` for the exact field names and any provider-specific quirks.

### Login form integration

In order to create a Login Form that performs an OIDC authentication, you must first add the following button schema to your Login Form.

```
{
  "label": "Sign in with OIDC",
  "action": "oauth",
  "key": "oidcLogin",
  "type": "button",
  "input": true,
  "oauthProvider": "openid"
}
```

Once this button is part of the form, the `OAuth` Action is then added to that form with the following configurations.

- `settings.provider` = "openid"
- `settings.association` = "remote"
- `settings.button` = "oidcLogin" <== Must match the key for the OIDC login button component.
- `settings.redirectURI` = "..." <== The application url to navigate to after the OIDC handshake. 
- `settings.roles` = [{...}] <== This contains an array of the following object.

OAuth Role Mapping is the bridge between an IdP role claim (e.g. `groups`, `roles`, `https://my-app/roles`) and Form.io Roles. The role map settings should provide the following:

- Pick the claim path (e.g. `roles`) the IdP returns. Leave empty to mean `any authenticated user`
- For each claim value (e.g. `admin`, `marketing`, `external`), choose the Form.io Role it maps to.
- A user may match multiple rows; the resulting `roles` array is the union.

`settings.roles` =
```
[
    {
        "claim": "",  // Leave empty to mean "any authenticated user"
        "value": "",
        "role": "69dfb6dcbb04c38a9102977c"  // This would be the 'Authenticated' role
    },
    {
        "claim": "groups",
        "value": "Admin",
        "role": "69dfb6dcbb04c38a9102977d". // This would be the 'Administrator' role
    }
]
```

With these settings in place, and saved within the OAuth Action, when a user is using the form (embedded within the application), and clicks on the button, the following occurs.

1. User is redirected to IDP authentication page and logs in.
2. IDP auth performs a redirect to the login form endpoint with access tokens in query params
3. OIDC login action calls the IdP's User Info endpoint with the OAuth access token.
4. Builds an ephemeral user object from the returned user information (no `user` Resource submission is created or looked up).
5. Applies OAuth Role Mapping (configured in action settings) to attach Form.io Roles to that ephemeral user.
6. Encodes the ephemeral user (profile data + roles) into a Form.io JWT and returns it via the `x-jwt-token` response header. From this point on the user is indistinguishable from a Resource-authenticated user — except that the identity lives in the token rather than in a Resource row.

### Remote Authentication: the ephemeral user

SSO does not create or require a `user` Resource submission. On each login Form.io constructs an ephemeral user from the IdP's user information and encodes it in the JWT:

- The IdP user information (email, name, and any other claims you map) becomes the user's `data`.
- OAuth Role Mapping (above) determines the user's `roles`.
- The result is encoded into the Form.io JWT — the same ephemeral, in-token user shape that a Custom JWT carries (`user.data`, `user.roles`, no Resource row). See [`custom-jwt.md`](./custom-jwt.md) for that payload shape and [`jwt-and-sessions.md`](./jwt-and-sessions.md) for how the application reads it.

Because the identity lives in the token, the application gets everything it needs about the user from the decoded JWT (`Formio.user`) without a Resource lookup. Nothing is persisted to the database on login, and no "first login" provisioning step exists.

### MFA and provider-level controls

When MFA is enforced at the IdP, Form.io receives the post-MFA token automatically — there is nothing to wire on the Form.io side. To layer Form.io-side controls (rate-limiting at the project boundary, brute-force on a fallback Resource login form, reCAPTCHA on a non-IdP path), see [`jwt-and-sessions.md`](./jwt-and-sessions.md).

## MCP Tool Preference

OAuth provider configuration MUST be performed via the Form.io project portal — no MCP tool covers IdP credentials, scope tables, or Role Mapping at the time of writing. After the provider is configured:

- Use `role_list` / `role_create` in the MCP server to ensure the Form.io Roles that the OAuth mapping table targets actually exist.
- Use `form_create` / `form_update` to scaffold the login form that hosts the OAuth Actions.
- Use `action_list` to confirm an OAuth Action has been attached to that form (typically managed in the portal, not via `action_create`).

For documentation of the runtime endpoints the renderer uses to complete the OAuth handshake, see the `runtime-auth` reference in the `formio-api` skill.

## See also

- [`token-swap.md`](./token-swap.md) — exchanging an externally-issued OIDC bearer token for a Form.io JWT without rendering an OAuth Action button.
- [`roles-and-permissions.md`](./roles-and-permissions.md) — the Form.io Roles your OAuth mapping targets.
- [`jwt-and-sessions.md`](./jwt-and-sessions.md) — the Form.io JWT the OAuth flow returns, the `jti` Session ID, and logout semantics that invalidate the session even if the IdP session is still alive.
- [`sso-saml.md`](./sso-saml.md), [`sso-ldap.md`](./sso-ldap.md) — sibling SSO references for other provider types.
