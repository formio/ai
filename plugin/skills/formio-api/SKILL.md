---
name: formio-api
description: >-
  Comprehensive Form.io API reference — every endpoint in the Form.io API Postman collection across platform admin, project admin, runtime/end-user, and PDF scopes. Use when the user asks to call, script, inspect, or document any Form.io REST endpoint: platform/project auth; projects, stages, tenants, teams; forms, resources, and revisions (create, list, update, import, export); actions; roles; end-user registration and login; submissions (submit, query, patch, delete); aggregation reports; PDF template uploads and submission downloads; health/status. Also for x-jwt-token auth questions and the base URL vs project URL distinction. Not for: building a whole application around Form.io (see formio-application); planning a data model (see formio-resource-planner); authoring Form.io JSON schemas (see formio-schema); calling the JavaScript SDK — `Formio.*` statics, `new Formio(...)` instances, `Utils.*` helpers (see formio-sdk).
---

# Form.io API Skills

Single entry point for the full Form.io REST API surface. Detailed endpoint references live under [`./references/`](./references/) — one file per capability group.

## Preflight — the Form.io MCP server

Before your first Form.io tool call, check that the Form.io MCP tools are available to you — `form_list`, `form_create`, `project_import`, `project_set`.

**If they are missing, stop and connect the server before doing anything else.** Load the `formio-mcp-setup` skill and follow it; it writes the MCP configuration for every client and tells the user how to reload. If that skill is not installed either, tell the user:

> I have no Form.io tools, so the Form.io MCP server isn't connected. Run `npx skills add formio/ai` to get the setup skill, or add the server to your agent's MCP configuration as `npx -y @formio/mcp`.

Do **not** work around missing tools by making direct HTTP requests against a Form.io deployment, and do not write code that does. This library documents the whole Form.io REST surface, which makes hand-rolling requests tempting and wrong — it bypasses the guardrails the tools enforce and can write to a live deployment unreviewed. Stop and report what is blocking instead.

## Terminology

Two distinct endpoints exist. These references NEVER conflate them:

- **`baseUrl` / `base_url` → platform deployment endpoint → `FORMIO_BASE_URL`** (the Postman `{{baseUrl}}` variable when used bare, without `{{projectName}}`)
- **`projectUrl` / `{{baseUrl}}/{{projectName}}` → project endpoint → `FORMIO_PROJECT_URL`** (a separate environment variable — not a computed sub-path)

The Postman collection composes the project endpoint as `{{baseUrl}}/{{projectName}}`, but **never build a project URL that way yourself.** A project endpoint takes one of exactly three forms, and only the third is a path under the base URL:

- **Form.io SaaS** — the base URL is always `https://api.form.io`, and the project is its name as a subdomain of `form.io`: a project named `examples` is `https://examples.form.io`.
- **A customer deployment with sub-domain project routes** — the base URL is the deployment host, often a subdomain of the customer's own domain (`https://forms.mysite.com`), and the project is a sibling subdomain of that same parent domain (`https://myproject.mysite.com`).
- **A customer deployment with sub-directory project routes** — the base URL is that same kind of host (`https://forms.mysite.com`) and the project is a path under it (`https://forms.mysite.com/myproject`).

So `https://api.form.io/examples` is not a SaaS project URL, and a project host that differs from the base URL's host is normal rather than a mistake. Read `FORMIO_PROJECT_URL` (or the working directory's mapping) rather than deriving one, and never treat a `*.form.io` host as a base URL.

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
