# SSO — SAML

## Overview

Form.io supports SAML 2.0 SSO with any SAML-compliant Identity Provider (ADFS, Okta SAML, OneLogin, Shibboleth, etc.). The user authenticates against the IdP, the IdP posts a signed SAML assertion back to Form.io, Form.io validates the signature, locates or creates the matching `user` submission, applies **SAML Role Mapping** to attach Form.io Roles, and returns a first-party Form.io JWT. From the application's point of view the user is indistinguishable from a Resource-authenticated user.

## When to use this

Reach for SAML SSO when:

- The IdP only speaks SAML (or the organization mandates it for compliance reasons).
- ADFS, legacy enterprise SSO, or SAML-only education/government tenants are involved.
- Assertions carry the role/group claims you want to map onto Form.io Roles.

Not for:

- OIDC / OAuth providers → see [`sso-oidc.md`](./sso-oidc.md).
- LDAP directories → see [`sso-ldap.md`](./sso-ldap.md).
- Backend-issued tokens you want to swap without an interactive login → see [`token-swap.md`](./token-swap.md) and [`custom-jwt.md`](./custom-jwt.md).

## Configuration

### IdP-side configuration

In the IdP's admin console:

- **Entity ID** — the project's SAML entity identifier (Form.io generates a canonical value per project).
- **ACS / Reply URL** — the Form.io endpoint that consumes the SAML assertion. Form.io generates this; copy it into the IdP.
- **NameID format** — typically `EmailAddress` so the assertion carries an identifier that matches a `user` Resource submission.
- **Attribute statements** — at minimum include `email`; include any role/group claim you intend to map (`role`, `memberOf`, `groups`, etc.).
- **Signing certificate** — the IdP's X.509 cert that Form.io uses to validate assertions.

### Form.io-side configuration

In the Form.io project portal's SAML settings:

- **Issuer / Metadata URL** — paste the IdP's metadata XML URL, or import the metadata document directly.
- **Signing certificate** — uploaded from the IdP.
- **NameID claim → `user` field mapping** — which Form.io `user` Resource field the NameID resolves to (usually `email`).
- **Attribute mapping** — for each non-role claim you want to populate on the `user` submission, name the source attribute and target Resource field.
- **Auto-create user submission** vs **require existing user** — same choice as OIDC; see [`sso-oidc.md`](./sso-oidc.md).

### SAML Role Mapping

SAML Role Mapping translates an IdP attribute (typically `memberOf`, `groups`, or a custom `role` attribute) onto Form.io Roles:

- Pick the attribute name.
- For each value the IdP can return, choose the Form.io Role.
- The user's final `roles` array is the union of matched mappings, falling back to the configured default Role if nothing matches.

Multi-valued attributes (the SAML default for `memberOf`) produce multi-row matches naturally — no special handling needed.

### Login button

Attach a SAML Action (one per provider) to the project's login form. The Action renders a button that initiates the SAML handshake (SP-initiated). IdP-initiated flows are also supported when the IdP posts directly to the ACS URL.

### Just-in-time deprovisioning

SAML assertions do not include a refresh mechanism. To enforce session revocation at the IdP, combine SAML SSO with a short Form.io session TTL and rely on `jti`-based logout (see [`jwt-and-sessions.md`](./jwt-and-sessions.md)). Form.io has no built-in SAML Single Logout (SLO) handshake at the time of writing; revoke at the Form.io side by invalidating the `jti`.

## MCP Tool Preference

SAML provider configuration (Entity ID, certificates, attribute mappings, Role Mapping) MUST be performed via the Form.io project portal — no MCP tool covers SAML metadata or signing certs today. After the provider is configured:

- Use `role_list` / `role_create` to ensure the Form.io Roles that the SAML Role Mapping targets actually exist.
- Use `form_create` / `form_update` to scaffold the login form hosting the SAML Action button.
- Use `action_list` to confirm a SAML Action is attached to the login form.

For runtime endpoint documentation, see the `runtime-auth` reference in the `formio-api` skill.

## See also

- [`sso-oidc.md`](./sso-oidc.md), [`sso-ldap.md`](./sso-ldap.md) — sibling SSO references for OIDC/OAuth and LDAP.
- [`roles-and-permissions.md`](./roles-and-permissions.md) — the Form.io Roles your SAML Role Mapping targets.
- [`jwt-and-sessions.md`](./jwt-and-sessions.md) — the Form.io JWT the SAML handshake returns and the `jti` Session ID used for logout.
