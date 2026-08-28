---
name: formio-api
description: >-
  Comprehensive Form.io API reference — every endpoint in the Form.io API Postman collection across platform admin, project admin, runtime/end-user, and PDF scopes. Use when the user asks to call, script, inspect, or document any Form.io REST endpoint: platform/project auth; projects, stages, tenants, teams; forms, resources, and revisions (create, list, update, import, export); actions; roles; end-user registration and login; submissions (submit, query, patch, delete); aggregation reports; PDF template uploads and submission downloads; health/status. Also for x-jwt-token auth questions and the base URL vs project URL distinction. Not for: building a whole application around Form.io (see formio-application); planning a data model (see formio-resource-planner); authoring Form.io JSON schemas (see formio-schema); calling the JavaScript SDK — `Formio.*` statics, `new Formio(...)` instances, `Utils.*` helpers (see formio-sdk).
---

# Form.io API Skills

Single entry point for the full Form.io REST API surface. Detailed endpoint references live under [`./references/`](./references/) — one file per capability group.

## Preflight — the Form.io MCP server

**Check this when you reach your first Form.io tool call, not when this skill activates.** The check is whether `form_list` is callable by you. If it is, proceed. If it is not, load the `formio-mcp-setup` skill and use it to help the user connect the server; that skill is the only remedy you offer, and this skill writes no MCP configuration itself.

**A missing server blocks that call, not the turn.** Reading this skill, answering a question from it, planning, and writing files to the working directory all need no server. Do everything that needs no server first and in full, then raise the gap when you actually reach the call that needs it. Opening with a blocked-on-setup message — or asking for a Project URL before there is anything to write to it — spends the user's turn on a step that was not due.

## Never work around missing tools

Do **not** work around missing tools by making direct HTTP requests against a Form.io deployment, and do not write a throwaway script that makes them for you. This library documents the whole Form.io REST surface, which makes hand-rolling requests tempting and wrong — it bypasses the guardrails the tools enforce and can write to a live deployment unreviewed. Stop and report what is blocking instead.

That ban is on **build-time** work — the configuring you do in this session. It says nothing about the application you are building: an app is expected to call the Form.io REST API **at runtime**, to log its users in and to read and write their submissions, and `formio-api`'s runtime-scope references document those endpoints for exactly that code.

## Which project the tools target

**Available tools are not a configured project.** Every Form.io tool resolves which project it targets per working directory, so pass `cwd` — the user's current working directory — on every Form.io tool call; omitting it resolves against the MCP server's own directory, which is fixed at spawn and may be mapped to a different project. Before the first call that reads from or writes to a deployment, ask the server what this directory resolves to by calling the `project_get` tool with `cwd` set to the user's current working directory. Do not shell out for this: the connected server answers it directly, with the same resolver every other tool uses, so what it reports is what the next call targets.

What `project_get` returns IS the configuration. There is one value to think about — the **Project URL**, the full URL of the Form.io project this work reads and writes. The **Base URL** (the deployment hosting it) is normally DERIVED from that project URL rather than supplied, so it is not a second thing to ask for. The values may come from a committed `formio.json` tracked with the application's own source, from this directory's mapping, or from the environment — the report says which. Do not ask the user to confirm or re-supply either one.

Branch on the `status` it returns. On `ok`, proceed. On `not-configured` — nothing is recorded for this directory — relay that message's own instruction to the user, ask for the single value it names, record it with `project_set`, and call `project_get` again. On `base-url-unresolved` the project IS recorded and one named value is still missing — the Base URL, for a project URL that names no deployment of its own: relay that message the same way, ask the user for that one value, and do exactly what that message names — which record the deployment goes in decides what the fix IS, and the report names it rather than leaving you to compose one. For a project this directory's own mapping holds, that is a `project_set` call, and the report also carries it as a structured `remedy`. For a project a committed `formio.json` holds, it is an EDIT to that file — the report names the path and the key, there is no `remedy` field to act on, and this server never writes a committed file, so composing a `project_set` call there is refused. Then call `project_get` again. Do not re-ask the user for the Project URL there; the report already reported it, and the call it names carries it for you. If the call fails outright instead of returning a status, it could not answer at all (an unreadable `~/.formio/projects.json`, a `formio.json` that will not parse, a malformed URL): do NOT interview, because a `project_set` would fail for the same unreported reason and the loop would repeat with the cause never named — relay the error and stop until it is fixed. Before the first call that WRITES (`form_create`, `form_update`, `role_create`, `action_create`, `project_import`), state the resolved Project URL and Base URL in one line, so a wrong target is caught before anything is written to it.

Never invent a Base URL, never reuse one from another project or an earlier session, and never edit `~/.formio/projects.json` by any means — its shape, its `0600` mode, and its merge rules belong to the server, and `project_set` is how you reach it. The server's own messages carry the URL shapes and the remedy for each; this skill does not restate them.

## Terminology

Two distinct endpoints exist. These references NEVER conflate them:

- **`baseUrl` / `base_url` → the platform deployment endpoint**, written `{baseUrl}` as a substitution slot (the Postman `{{baseUrl}}` variable when used bare, without `{{projectName}}`)
- **`projectUrl` / `project_url` → the project endpoint**, written `{projectUrl}` as a substitution slot (Postman composes it as `{{baseUrl}}/{{projectName}}`, which is a Postman detail rather than a rule about the URL — see below)

Both are values `project_get` reports and you substitute into the endpoint. Neither is read from the environment.

The Postman collection composes the project endpoint as `{{baseUrl}}/{{projectName}}`, but **never build a project URL that way yourself** — only one of the deployment routings puts the project on a path under the base URL, so composing it that way is wrong for the others. Read both values from the MCP server instead, by calling `project_get` with `cwd` set to the user's current working directory, and use exactly what it reports.

Two consequences worth stating, because both look like mistakes and are not: `https://api.form.io/examples` is not a hosted project URL, and a project host that differs from the base URL's host is normal rather than an error. Never treat a `*.form.io` host as a base URL.

The routing shapes themselves are not catalogued here. The MCP server carries them in its own guidance and in the message it raises when a URL is missing — one copy, reaching every caller including an agent with no skills installed — so relay what it says rather than reasoning about shapes in this document.

## Authentication

All endpoints (except Server API health/status) require an `x-jwt-token` header populated by the MCP server's browser-based portal-login flow. The MCP server attaches this header automatically via `formioFetch`. See [`references/runtime-auth.md`](./references/runtime-auth.md) or [`references/platform-auth.md`](./references/platform-auth.md) for details.

## MCP Tool Preference

Prefer first-party MCP tools (`form_create`, `form_get`, `form_list`, `form_update`, `role_create`, `role_list`, `role_update`, `project_export`, `project_import`) over raw HTTP when both paths exist. Each reference doc surfaces the preferred tool alongside its HTTP fallback in a mapping table. Authentication is implicit — any authenticated tool call triggers the portal-login flow on first use.

## Scope map

### Platform scope — `{baseUrl}/`

- [platform-auth](./references/platform-auth.md) — platform-admin login, portal users, identity providers
- [platform-projects](./references/platform-projects.md) — project CRUD, export, import
- [platform-teams](./references/platform-teams.md) — teams, membership, project access
- [platform-staging](./references/platform-staging.md) — stages, version tagging, cross-stage deploys
- [platform-tenants](./references/platform-tenants.md) — multi-tenant projects and tenant admins
- [server-status](./references/server-status.md) — liveness, health, version diagnostics

### Project scope — `{projectUrl}/`

- [project-auth](./references/project-auth.md) — project-admin login, admin resource
- [project-roles](./references/project-roles.md) — role CRUD
- [project-forms](./references/project-forms.md) — form/resource CRUD, import, export
- [project-form-revisions](./references/project-form-revisions.md) — revision enablement, drafts, publish
- [project-actions](./references/project-actions.md) — form action CRUD (email, webhook, role-assignment, etc.)

### Runtime scope — `{projectUrl}/`

- [runtime-auth](./references/runtime-auth.md) — end-user registration and login on the built-in `user` resource
- [runtime-custom-users](./references/runtime-custom-users.md) — custom user resources, custom roles, Login/Role-Assignment actions
- [runtime-access-control](./references/runtime-access-control.md) — "own" submission access, group permissions
- [runtime-reports](./references/runtime-reports.md) — aggregation pipelines across submissions
- [runtime-submissions](./references/runtime-submissions.md) — submission CRUD, validate, patch, revisions

### PDF scope — `{projectUrl}/pdf-proxy/`

- [pdf-api](./references/pdf-api.md) — PDF template upload, PDF-backed forms, submission-to-PDF download

## How to use this skill

When the user asks an API-oriented question, identify the scope (platform / project / runtime / PDF) and open the matching reference file under [`./references/`](./references/). Each reference documents:

- Endpoints (method + path relative to the scope's root URL)
- Request / response shapes
- Related reference docs
- MCP-tool mapping (where a first-party tool covers the operation)

Do not merge content across scopes — each reference names its own base URL and endpoint set.
