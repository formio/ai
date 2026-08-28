---
name: formio-auth
description: >-
  Form.io authentication and authorization specialist — resource-backed login (Login plus Role Assignment Actions), role-based access control and group permissions, SSO via OIDC/OAuth/SAML/LDAP with provider role mapping, Token Swap, Custom JWT for Enterprise/on-prem (signed with `JWT_SECRET`), email-token (passwordless) auth, and JWT/session mechanics (the `x-jwt-token` header, `jti` Session ID, logout, 2FA, reCAPTCHA). Use when the user asks to configure how users authenticate — SSO, OIDC, OAuth, SAML, LDAP, Token Swap, Custom JWT, passwordless auth, JWT, sessions, roles, permissions, RBAC, group permissions, 2FA, or reCAPTCHA in Form.io. Not for: designing the resource map or data model (see `formio-resource-planner`); orchestrating an app build (see `formio-application`); adding a Login or Role Assignment Action to one form — per-form action settings, priorities, conditions (see `formio-actions`); REST endpoint lookups (see `formio-api`); wiring a login screen into Angular (see `formio-angular`).
---

## Preflight — the Form.io MCP server

**Check this when you reach your first Form.io tool call, not when this skill activates.** The check is whether `form_list` is callable by you. If it is, proceed. If it is not, load the `formio-mcp-setup` skill and use it to help the user connect the server; that skill is the only remedy you offer, and this skill writes no MCP configuration itself.

**A missing server blocks that call, not the turn.** Reading this skill, answering a question from it, planning, and writing files to the working directory all need no server. Do everything that needs no server first and in full, then raise the gap when you actually reach the call that needs it. Opening with a blocked-on-setup message — or asking for a Project URL before there is anything to write to it — spends the user's turn on a step that was not due.

## Never work around missing tools

Do **not** work around missing tools by making direct HTTP requests against a Form.io deployment, and do not write a throwaway script that makes them for you. This library documents the whole Form.io REST surface, which makes hand-rolling requests tempting and wrong — it bypasses the guardrails the tools enforce and can write to a live deployment unreviewed. Stop and report what is blocking instead.

That ban is on **build-time** work — the configuring you do in this session. It says nothing about the application you are building: an app is expected to call the Form.io REST API **at runtime**, to log its users in and to read and write their submissions, and [`formio-api`](../formio-api/SKILL.md)'s runtime-scope references document those endpoints for exactly that code.

## Which project the tools target

**Available tools are not a configured project.** Every Form.io tool resolves which project it targets per working directory, so pass `cwd` — the user's current working directory — on every Form.io tool call; omitting it resolves against the MCP server's own directory, which is fixed at spawn and may be mapped to a different project. Before the first call that reads from or writes to a deployment, ask the server what this directory resolves to by calling the `project_get` tool with `cwd` set to the user's current working directory. Do not shell out for this: the connected server answers it directly, with the same resolver every other tool uses, so what it reports is what the next call targets.

What `project_get` returns IS the configuration. There is one value to think about — the **Project URL**, the full URL of the Form.io project this work reads and writes. The **Base URL** (the deployment hosting it) is normally DERIVED from that project URL rather than supplied, so it is not a second thing to ask for. The values may come from a committed `formio.json` tracked with the application's own source, from this directory's mapping, or from the environment — the report says which. Do not ask the user to confirm or re-supply either one.

Branch on the `status` it returns. On `ok`, proceed. On `not-configured` — nothing is recorded for this directory — relay that message's own instruction to the user, ask for the single value it names, record it with `project_set`, and call `project_get` again. On `base-url-unresolved` the project IS recorded and one named value is still missing — the Base URL, for a project URL that names no deployment of its own: relay that message the same way, ask the user for that one value, and do exactly what that message names — which record the deployment goes in decides what the fix IS, and the report names it rather than leaving you to compose one. For a project this directory's own mapping holds, that is a `project_set` call, and the report also carries it as a structured `remedy`. For a project a committed `formio.json` holds, it is an EDIT to that file — the report names the path and the key, there is no `remedy` field to act on, and this server never writes a committed file, so composing a `project_set` call there is refused. Then call `project_get` again. Do not re-ask the user for the Project URL there; the report already reported it, and the call it names carries it for you. If the call fails outright instead of returning a status, it could not answer at all (an unreadable `~/.formio/projects.json`, a `formio.json` that will not parse, a malformed URL): do NOT interview, because a `project_set` would fail for the same unreported reason and the loop would repeat with the cause never named — relay the error and stop until it is fixed. Before the first call that WRITES (`form_create`, `form_update`, `role_create`, `action_create`, `project_import`), state the resolved Project URL and Base URL in one line, so a wrong target is caught before anything is written to it.

Never invent a Base URL, never reuse one from another project or an earlier session, and never edit `~/.formio/projects.json` by any means — its shape, its `0600` mode, and its merge rules belong to the server, and `project_set` is how you reach it. The server's own messages carry the URL shapes and the remedy for each; this skill does not restate them.

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
- [`references/group-permissions.md`](./references/group-permissions.md) — Group Assignment Action and field-based `submissionAccess`: the three parts of single-level group access (action, field-based block, and the group resource's own read grant), the entry-type menu including the delete decision, the assigner's update-access requirement, and the hidden calculated mirror for transitive group access.
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
