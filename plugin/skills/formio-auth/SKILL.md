---
name: formio-auth
description: >-
  Form.io authentication and authorization specialist — teaches an AI agent the full
  Form.io auth surface, including resource-backed login with the Login Action plus
  Role Assignment Action, login and registration form shapes, role-based access control
  (the eight permission types across project, form-definition, and submission-data scopes),
  group permissions (single-level plus transitive via field-based `submissionAccess`),
  SSO via OIDC/OAuth/SAML/LDAP with provider role mapping, Token Swap from an external
  OIDC token, Custom JWT for Enterprise/on-prem deployments signed with `JWT_SECRET`,
  email-token (passwordless) authentication, and JWT/session mechanics (the `x-jwt-token`
  header, `jti` Session ID, logout, 2FA, reCAPTCHA).
  Use when the user asks to configure login, JWT, sessions, SSO, OIDC, OAuth, SAML, LDAP,
  Token Swap, Custom JWT, passwordless/email-token auth, roles, permissions, RBAC, group
  permissions, 2FA, reCAPTCHA, the Login Action, the Role Assignment Action, the Group
  Assignment Action, or any auth/authorization concern in Form.io.
  Not for designing the resource map, planning a new app's data model, or emitting a
  `template.json` from scratch (those go through `formio-resource-planner`); orchestrating
  the full build-an-app pipeline of plan → import → scaffold a framework (that goes through
  `formio-application`); looking up a specific REST endpoint URL or HTTP shape (that goes
  through `formio-api`); or wiring a front-end login screen, route guard, or
  `FormioAuthService` into an Angular workspace (that goes through `formio-angular`).
---

## Overview

`formio-auth` is the stand-alone skill for everything authentication and authorization in Form.io. It covers how a user proves identity (Resource login, SSO, Token Swap, Custom JWT, email token), how Form.io carries that identity on the wire (`x-jwt-token` header, JWT payload, `jti` Session ID), and how that identity gates access at three scopes (project, form definition, submission data) and through two access models (role-based and group-based).

The skill is documentation-only. It does not emit `template.json`. When a configuration depends on resources, roles, or forms, this skill points to `formio-resource-planner`, which owns the canonical JSON shapes for roles, the Login Action, the Role Assignment Action, the Group Assignment Action, `access` arrays, `submissionAccess` arrays, and field-based `submissionAccess` on group-reference selects.

## When to use this

Activate `formio-auth` when the user is asking about identity, sessions, or access control inside a Form.io project. Sample triggers:

- "How do I wire OIDC / SAML / LDAP into my Form.io project?"
- "How do I set up Token Swap from my own OAuth provider?"
- "We're on Form.io Enterprise on-prem — how do we forge a Custom JWT?"
- "How do I send the user a magic-link email instead of a password?"
- "Who can read submissions if the role has `read_own` but not `read_all`?"
- "How does group-based access work? What's the difference between single-level and transitive?"
- "How does logout work? What invalidates a JWT?"
- "Add 2FA / reCAPTCHA to my login flow."

Not for:

- Designing roles or login forms inside a fresh resource map → `formio-resource-planner`.
- "Build me a CRM" or "scaffold an Angular app for this project" → `formio-application`.
- "What's the URL of the `/login` endpoint?" → `formio-api`.
- "Generate the Angular login component" → `formio-angular`.

## Map of references

Each reference doc is self-contained and follows the section layout `Overview` → `When to use this` → `Configuration` → `MCP Tool Preference` → `See also`.

- [`references/resource-auth.md`](./references/resource-auth.md) — Resource-backed login with the Login Action + Role Assignment Action, the six-step Form.io auth flow, and the `x-jwt-token` response header.
- [`references/login-forms.md`](./references/login-forms.md) — Login and registration form patterns: `access`, `submissionAccess`, anonymous self-register, brute-force protection settings.
- [`references/roles-and-permissions.md`](./references/roles-and-permissions.md) — Default roles, custom roles, the eight permission types (`create_own`, `create_all`, `read_own`, `read_all`, `update_own`, `update_all`, `delete_own`, `delete_all`) across project, form-definition, and submission-data scopes.
- [`references/group-permissions.md`](./references/group-permissions.md) — Group Assignment Action and field-based `submissionAccess`: the two-halves model for single-level group access, and the hidden calculated mirror for transitive group access.
- [`references/sso-oidc.md`](./references/sso-oidc.md) — OAuth / OpenID Connect provider setup plus OAuth Role Mapping.
- [`references/sso-saml.md`](./references/sso-saml.md) — SAML provider setup plus SAML Role Mapping.
- [`references/sso-ldap.md`](./references/sso-ldap.md) — LDAP directory setup plus LDAP Role Mapping.
- [`references/token-swap.md`](./references/token-swap.md) — Exchanging an external OIDC/OAuth bearer token for a Form.io JWT.
- [`references/custom-jwt.md`](./references/custom-jwt.md) — Enterprise/on-prem Custom JWT signed with `JWT_SECRET`, required payload shape, and `localStorage.formioToken` injection.
- [`references/email-auth.md`](./references/email-auth.md) — Email-token (passwordless) authentication via the Email Authentication action.
- [`references/jwt-and-sessions.md`](./references/jwt-and-sessions.md) — JWT payload, `x-jwt-token` header, `jti` Session ID, logout semantics, 2FA, and reCAPTCHA.

## Handoff with formio-resource-planner

The planner owns the data model. `formio-auth` owns the auth configuration that runs on top of it. The contract:

- When the user is still designing roles, the user resource, login/registration forms, or a group join, run `formio-resource-planner` first. The planner emits a `template.json` with role objects, the Login Action, the Role Assignment Action, the Group Assignment Action, `submissionAccess` arrays, and field-based `submissionAccess` on group-reference selects.
- When the user is configuring SSO, Token Swap, Custom JWT, email-token auth, JWT customization, 2FA, reCAPTCHA, or tuning RBAC beyond the planner's defaults, hand off to `formio-auth`.

Action JSON shapes are NOT duplicated here — they live in `plugin/skills/formio-resource-planner/references/template-json.md` and are referenced by file path from this skill.
