---
name: formio-api
description: >-
  Comprehensive Form.io API reference — covers every endpoint in the Form.io API Postman collection across platform admin, project admin, runtime/end-user, and PDF scopes. Use when the user asks to call, script, inspect, or document any Form.io REST endpoint: authenticating as platform or project admin, managing projects, stages, tenants, teams; creating, listing, updating, importing, or exporting forms, resources, or form revisions; attaching actions; managing roles; registering or logging in end users (built-in or custom user resources); submitting, querying, patching, or deleting submissions; running aggregation reports; uploading PDF templates or downloading submissions as PDFs; checking platform health/status. Also use when the user asks about x-jwt-token auth, the Form.io base URL vs project URL distinction, or wants an endpoint reference by method/path. Not for: building a whole application around Form.io (see formio-application); planning a data model (see formio-resource-planner); authoring Form.io JSON schemas — form definitions, submissions, actions, projects, roles — (see formio-schema).
---

# Form.io API Skills

Single entry point for the full Form.io REST API surface. Detailed endpoint references live under [`./references/`](./references/) — one file per capability group.

## Terminology

Two distinct endpoints exist. These references NEVER conflate them:

- **`baseUrl` / `base_url` → platform deployment endpoint → `FORMIO_BASE_URL`** (the Postman `{{baseUrl}}` variable when used bare, without `{{projectName}}`)
- **`projectUrl` / `{{baseUrl}}/{{projectName}}` → project endpoint → `FORMIO_PROJECT_URL`** (a separate environment variable — not a computed sub-path)

## Authentication

All endpoints (except Server API health/status) require an `x-jwt-token` header populated by the MCP server's browser-based portal-login flow. The MCP server attaches this header automatically via `formioFetch`. See [`references/runtime-auth.md`](./references/runtime-auth.md) or [`references/platform-auth.md`](./references/platform-auth.md) for details.

## MCP Tool Preference

Prefer first-party MCP tools (`form_create`, `form_get`, `form_list`, `form_update`, `role_create`, `role_list`, `role_update`, `project_export`, `project_import`) over raw HTTP when both paths exist. Each reference doc surfaces the preferred tool alongside its HTTP fallback in a mapping table. Authentication is implicit — any authenticated tool call triggers the portal-login flow on first use.

## Scope map

### Platform scope — `${FORMIO_BASE_URL}/`

- [platform-auth](./references/platform-auth.md) — platform-admin login, portal users, identity providers
- [platform-projects](./references/platform-projects.md) — project CRUD, export, import
- [platform-teams](./references/platform-teams.md) — teams, membership, project access
- [platform-staging](./references/platform-staging.md) — stages, version tagging, cross-stage deploys
- [platform-tenants](./references/platform-tenants.md) — multi-tenant projects and tenant admins
- [server-status](./references/server-status.md) — liveness, health, version diagnostics

### Project scope — `${FORMIO_PROJECT_URL}/`

- [project-auth](./references/project-auth.md) — project-admin login, admin resource
- [project-roles](./references/project-roles.md) — role CRUD
- [project-forms](./references/project-forms.md) — form/resource CRUD, import, export
- [project-form-revisions](./references/project-form-revisions.md) — revision enablement, drafts, publish
- [project-actions](./references/project-actions.md) — form action CRUD (email, webhook, role-assignment, etc.)

### Runtime scope — `${FORMIO_PROJECT_URL}/`

- [runtime-auth](./references/runtime-auth.md) — end-user registration and login on the built-in `user` resource
- [runtime-custom-users](./references/runtime-custom-users.md) — custom user resources, custom roles, Login/Role-Assignment actions
- [runtime-access-control](./references/runtime-access-control.md) — "own" submission access, group permissions
- [runtime-reports](./references/runtime-reports.md) — aggregation pipelines across submissions
- [runtime-submissions](./references/runtime-submissions.md) — submission CRUD, validate, patch, revisions

### PDF scope — `${FORMIO_PROJECT_URL}/pdf-proxy/`

- [pdf-api](./references/pdf-api.md) — PDF template upload, PDF-backed forms, submission-to-PDF download

## How to use this skill

When the user asks an API-oriented question, identify the scope (platform / project / runtime / PDF) and open the matching reference file under [`./references/`](./references/). Each reference documents:

- Endpoints (method + path relative to the scope's root URL)
- Request / response shapes
- Related reference docs
- MCP-tool mapping (where a first-party tool covers the operation)

Do not merge content across scopes — each reference names its own base URL and endpoint set.
