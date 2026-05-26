# `@formio/ai` — Form.io Claude Code plugin

Form.io Claude Code plugin (`formio-ai@formio`). Bundles the [Form.io MCP server](https://www.npmjs.com/package/@formio/mcp) (`@formio/mcp`) and the full Form.io skills library so Claude Code reasons in Form.io primitives — resources, roles, group permissions, field-based ACLs, server-side actions, project templates, framework wiring — and produces enterprise-grade applications with robust RBAC by default.

Use it to plan a data model, generate a single form, add server-side actions, tighten access controls on an existing resource, scaffold a CRUD UI, snapshot a project, look up any REST endpoint, or build a complete app from one prompt — same plugin, same skills, same MCP tools.

> Looking for the full project documentation — architecture, use cases, MCP server transports, sample resource maps, skill flow diagrams, development workflow? **See the [root README](https://github.com/formio/ai#readme).** This file is the plugin-specific quickstart.

## Install

From inside Claude Code:

```text
/plugin marketplace add git@github.com:formio/ai.git
/plugin install formio-ai@formio
```

Claude Code prompts for `formio_base_url` and `formio_default_project_url` on install. Then describe what you want — the agent picks the right skill:

- *Plan a model* → "Plan the resources for a help desk with tickets, agents, and SLA tiers."
- *Build a whole app* → "Build me a task manager where users only see tasks in projects they belong to."
- *Extend a running app* → "Also let team members add comments to each task."
- *Author one form* → "Generate a wizard form for an insurance claim with three pages."
- *Add server behavior* → "Email legal@example.com whenever a contractRequest is submitted."
- *Lock down a resource* → "Restrict Account reads to members of the owning Team."
- *Operate the project* → "List forms missing a Save Submission action."

Every step has an approval gate before any file is written or any MCP call hits the live project.

## What's in the box

- **MCP server** (`@formio/mcp`) — first-party Form.io operations as MCP tools (`form_*`, `role_*`, `action_*`, `project_*`).
- **Skills library** — seven activatable skills (orchestration, planner, framework implementor, form JSON, schema, actions, API router) plus a reference library under `formio-api/references/` covering every endpoint in the Form.io API Postman collection.
- **`verify-project-url` hook** — `SessionStart` / `PreToolUse` hook that offers `formio_default_project_url` as the per-cwd default and routes the MCP server through `~/.formio/projects.json`, so each working directory can target a different Form.io project.

| Skill | Purpose |
| --- | --- |
| `formio-application` | Default "build me an app" orchestrator. Six-step pipeline (Intent → Plan → Deployment → MCP Config → Import → Framework). |
| `formio-resource-planner` | Plans resources, fields, roles, actions, access — emits paired `template.md` + `template.json`. |
| `formio-angular` | Angular framework implementor. Five-phase scaffold flow over `@formio/angular`. |
| `formio-schema` | Comprehensive Form.io JSON schema reference — form definitions today, with placeholder slots for submissions, actions, projects, and roles. |
| `formio-actions` | Configuration reference for Form.io server-side actions. |
| `formio-api` | Router into the full Form.io REST API surface (platform, project, runtime, PDF). |

See the [root README's "How it works"](https://github.com/formio/ai#how-it-works) for the orchestrator, planner, and Angular flow diagrams, plus full sample resource maps.

## Environment variables

The plugin prompts for `FORMIO_BASE_URL` and the default `FORMIO_PROJECT_URL` on install. Other env vars are picked up by `process.env`.

| Name | Required | Default | Purpose |
| --- | :-: | --- | --- |
| `FORMIO_BASE_URL` | yes | — | Full base URL of your Form.io deployment (e.g. `https://api.form.io`). Set via plugin user-config. |
| `FORMIO_PROJECT_URL` | yes\* | — | Full URL of the Form.io project the MCP server should target. In plugin mode, only used as the pre-filled default the `verify-project-url` hook offers when prompting for an unmapped cwd. |
| `FORMIO_API_KEY` | no | `undefined` | Long-lived project API key. When set, the server skips the browser login flow and attaches `x-token`. |
| `FORMIO_LOGIN_FORM` | no | Auto-resolved | Override the portal login form URL. |

\* The `verify-project-url` hook persists per-cwd mappings to `~/.formio/projects.json` via the `project_set` MCP tool (offering the plugin user-config `formio_default_project_url` as the default). Once a directory is mapped, the MCP server resolves `FORMIO_PROJECT_URL` from that file instead of env.

### Authentication modes

- **JWT mode (default).** Leave `FORMIO_API_KEY` unset. The first authenticated tool call opens the portal login form in the browser; subsequent calls reuse the cached JWT.
- **API-key mode.** Set `FORMIO_API_KEY`. All requests attach `x-token`; no browser login.

### Login-form auto-resolution

When `FORMIO_LOGIN_FORM` is unset, the server probes (in order, 1.5s timeout each) on the first login attempt and caches the first responder:

1. `${FORMIO_BASE_URL}/formio/user/login` (portal-base)
2. `${FORMIO_PROJECT_URL}/admin/login` (project admin)
3. `${FORMIO_PROJECT_URL}/user/login` (project user)

## License

MIT
