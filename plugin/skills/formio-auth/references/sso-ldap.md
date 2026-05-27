# SSO — LDAP

## Overview

Form.io supports LDAP authentication against any LDAP-compliant directory (OpenLDAP, Microsoft Active Directory via LDAP, FreeIPA, etc.). The user supplies their LDAP credentials on a Form.io login form, and Form.io binds against the directory and returns a first-party Form.io JWT on success.

Like every SSO method here, LDAP uses **Remote Authentication**: Form.io does not look up or create a `user` Resource submission. After a successful bind it reads the directory entry's attributes, builds an **ephemeral user object** from them, applies **LDAP Role Mapping** to attach Form.io Roles, and encodes that user — profile data plus mapped roles — **entirely within the Form.io JWT**. The identity lives in the token, not in a database row.

## When to use this

Reach for LDAP when:

- The organization runs a corporate LDAP directory and wants Form.io to authenticate against it without SAML or OIDC in front.
- Active Directory is the source of truth for users and groups, and an LDAP bind is acceptable (no Kerberos/IWA).
- Group membership in LDAP (`memberOf`) should drive Form.io Role assignment.

Not for:

- Federated SSO with redirect-based handshakes → see [`sso-oidc.md`](./sso-oidc.md) or [`sso-saml.md`](./sso-saml.md).
- Token-based handoff from another system → see [`token-swap.md`](./token-swap.md) or [`custom-jwt.md`](./custom-jwt.md).

## Configuration

### Directory connection

In the project portal's LDAP settings:

- **Host** and **Port** — typically `389` (LDAP) or `636` (LDAPS). Use LDAPS in production.
- **Base DN** — the subtree to search (e.g. `dc=corp,dc=example,dc=com`).
- **Bind DN** + **Bind Password** — a service account that can search the directory. Form.io binds with these credentials before issuing user lookups.
- **User search filter** — typically `(&(objectClass=person)(uid={{username}}))` for OpenLDAP or `(&(objectClass=user)(sAMAccountName={{username}}))` for AD. The `{{username}}` placeholder is replaced with whatever the user typed on the login form.

### Login form

A Form.io login form drives LDAP exactly like Resource-backed login from the user's point of view: an LDAP `email`/`username` field and a `password` field. The difference is the Action attached to the form:

- For Resource login, attach a Login Action with `settings.resources: ["user"]`.
- For LDAP login, attach the LDAP Action (project portal — managed via the LDAP settings page, not as a Resource Login Action).

On submit, the LDAP Action attempts a bind with the supplied credentials, then runs the User search filter to locate the matching directory entry.

### User mapping

After a successful bind, Form.io maps directory attributes onto the ephemeral user object that gets encoded into the JWT (not onto a Resource submission):

- The `email` attribute (or `mail`, depending on the schema) populates the user's `email`.
- Optional profile attributes (`displayName`, `givenName`, `sn`, etc.) populate matching fields on the ephemeral user's `data`.

There is no auto-create / require-existing-user setting: LDAP login never creates or requires a `user` Resource row. See "Remote Authentication" in [`sso-oidc.md`](./sso-oidc.md) for the shared model and [`custom-jwt.md`](./custom-jwt.md) for the in-token user shape.

### LDAP Role Mapping

LDAP Role Mapping uses the directory's group attribute (typically `memberOf`) to assign Form.io Roles:

- Pick the attribute name (`memberOf` is the default).
- For each group DN that the directory can return (e.g. `cn=admins,ou=groups,dc=corp,dc=example,dc=com`), choose the Form.io Role.
- A user's final `roles` array is the union of matched group → Role rows, falling back to the configured default Role if nothing matches.

### TLS and security

- Use LDAPS (`636`) or StartTLS in production. Sending bind credentials over plain LDAP exposes them on the wire.
- Use a low-privilege service account for the Bind DN.
- Set a tight User search filter to avoid leaking unrelated directory entries.

## MCP Tool Preference

LDAP provider configuration (host, port, Bind DN, search filter, Role Mapping) MUST be performed via the Form.io project portal — no MCP tool covers LDAP directory wiring today. After the provider is configured:

- Use `role_list` / `role_create` to ensure the Form.io Roles that the LDAP Role Mapping targets exist.
- Use `form_create` / `form_update` to build the login form that drives the LDAP bind.

For runtime endpoint documentation, see the `runtime-auth` reference in the `formio-api` skill.

## See also

- [`sso-oidc.md`](./sso-oidc.md), [`sso-saml.md`](./sso-saml.md) — sibling SSO references for OIDC/OAuth and SAML.
- [`roles-and-permissions.md`](./roles-and-permissions.md) — the Form.io Roles your LDAP Role Mapping targets.
- [`jwt-and-sessions.md`](./jwt-and-sessions.md) — the Form.io JWT the LDAP login returns, plus session and logout semantics.
