# `@formio/ai` — The Form.io Coding Agent Plugin

The Form.io Coding Agent (Claude, Codex, Cursor, Copilot, etc) plugin (`formio-ai`). Bundles the [Form.io MCP server](https://www.npmjs.com/package/@formio/mcp) (`@formio/mcp`) and the full Form.io skills library so your agent reasons in Form.io primitives — resources, roles, group permissions, field-based ACLs, server-side actions, project templates, framework wiring — and produces enterprise-grade applications with robust RBAC by default.

Use it to plan a data model, generate a single form, add server-side actions, scaffold a Form.io backed CRUD application, snapshot a project, look up any REST endpoint, or build a complete app from one prompt — same plugin, same skills, same MCP tools.

> Looking for the full project documentation — architecture, use cases, MCP server transports, sample resource maps, skill flow diagrams, development workflow? **See the [root README](https://github.com/formio/ai#readme).** This file is the plugin-specific quickstart.

## What each client consumes

The plugin directory carries three manifests over one `skills/` tree and one `mcp.json`. Each client detects its own and ignores the rest:

| Manifest | Read by | Components consumed |
| --- | --- | --- |
| `plugin.json` (Agent Plugins 1.0.0) | Codex/ChatGPT, Kiro, VS Code | `skills/`, `mcp.json` |
| `.cursor-plugin/plugin.json` | Cursor | `skills/` and its own `mcpServers`; no install-time prompt |
| `.claude-plugin/plugin.json` | Claude Code | `skills/` and its own `mcpServers`; no install-time prompt |


Installing without a plugin also works: `npx skills add formio/ai` installs `skills/` into any agent, and the bundled `formio-mcp-setup` skill connects the server on first use.

## Install

From inside Claude Code:

```text
/plugin marketplace add https://github.com/formio/ai.git
/plugin install formio-ai@formio
```

Claude Code prompts for `formio_base_url` on install; every client can set the project per directory afterwards with `project_set`. Then describe what you want — the agent picks the right skill:

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
- **Skills library** — twelve activatable skills (app orchestration, form building, form embedding, planner, Angular and React framework implementors, schema, actions, auth, SDK, API router, MCP setup) plus a reference library under `formio-api/references/` covering every endpoint in the Form.io API Postman collection.
- **Per-directory project routing** — `project_set` maps a working directory to a Form.io project in `~/.formio/projects.json`, so each directory can target a different project. The server resolves that mapping on every tool call; `npx -y @formio/mcp@0.12.3 project get --cwd .` prints what it resolves and why.

| Skill | Purpose |
| --- | --- |
| `formio-application` | Default "build me an app" orchestrator. Four-step pipeline (Intent → Plan → Import → Framework), start to finish in one invocation. |
| `formio-form-builder` | Default "build me a form" orchestrator — webform or wizard from intent to a saved form, plus field edits to existing forms. |
| `formio-form` | Embeds and renders forms in any web application with `@formio/js` — pre-fill, conditionals, calculated values, custom validation. |
| `formio-resource-planner` | Plans resources, fields, roles, actions, access — emits paired `template.md` + `template.json`. |
| `formio-angular` | Angular framework implementor. Five-phase scaffold flow over `@formio/angular`. |
| `formio-react` | React framework implementor. Routes between a greenfield build, extending an existing app, and embedding a single form; generates a resource kernel over React Router data routers. |
| `formio-schema` | Comprehensive Form.io JSON schema reference — form, submission, and project document shapes. |
| `formio-actions` | Configuration reference for Form.io server-side actions. |
| `formio-auth` | Authentication and authorization — login/registration, RBAC, SSO (OIDC/SAML/LDAP), Token Swap, Custom JWT, sessions. |
| `formio-sdk` | Source-derived reference for the `@formio/js` SDK and `@formio/js/utils` Utilities. |
| `formio-api` | Router into the full Form.io REST API surface (platform, project, runtime, PDF). |
| `formio-mcp-setup` | Connects the MCP server to whichever agent is running, and captures the project, when the skills were installed on their own. |

See the [root README's "How it works"](https://github.com/formio/ai#how-it-works) for the orchestrator, planner, and Angular flow diagrams, plus full sample resource maps.

## Environment variables

No client prompts for anything at install time. Both URLs are resolved per directory instead — from a committed `formio.json` tracked with the application's own source, from the working-directory mapping `project_set` writes, or from the environment as a last resort. A project is one-to-one with the application built against it, and a base URL is derived from the project URL's shape when it can be, so a value typed once at install is right for one directory and wrong for the next. The `.mcpb` desktop bundle is the exception: a desktop host has no working directory to interview in, so it still asks.

| Name | Required | Default | Purpose |
| --- | :-: | --- | --- |
| `FORMIO_BASE_URL` | no | derived, see note | Full base URL of your Form.io deployment. The WEAKEST source: a committed `formio.json` wins, then the directory's mapping, then this. When nothing supplies one it is derived from the project URL's shape, and a project URL that names no deployment yields an actionable error rather than a guess. |
| `FORMIO_PROJECT_URL` | no\* | — | Full URL of the Form.io project the MCP server should target. The WEAKEST source: a committed `formio.json` wins, then the directory's mapping, then this. The plugin leaves it unset and routes per-cwd instead. |
| `FORMIO_API_KEY` | no | `undefined` | Long-lived project API key. When set, the server skips the browser login flow and attaches `x-token`. |
| `FORMIO_LOGIN_FORM` | no | Auto-resolved | Override the portal login form URL. |
| `FORMIO_FORCE_BROWSER` | no | `0` | Set to `1` to attempt the browser login even where the server detects no browser (CI, a container, SSH with no display). |
| `FORMIO_INSECURE_TLS` | no | `false` | When `true`, skips TLS certificate verification — for self-hosted deployments behind self-signed certs. Do not use against production. |

\* Per-directory mappings are persisted to `~/.formio/projects.json` by the `project_set` tool, or by `npx -y @formio/mcp@0.12.3 project set --project-url <url> --base-url <url> --cwd <path>` before any client has connected. Both record the project URL **and** the base URL, and the server resolves both from that file per directory, falling back to the global environment values only when an entry omits them.

### Authentication modes

- **JWT mode (default).** Leave `FORMIO_API_KEY` unset. The first authenticated tool call opens the portal login form in the browser; subsequent calls reuse the cached JWT.
- **API-key mode.** Set `FORMIO_API_KEY`. All requests attach `x-token`; no browser login.

### Login-form auto-resolution

When `FORMIO_LOGIN_FORM` is unset, the server probes (in order, 1.5s timeout each) on the first login attempt and caches the first responder:

1. `{baseUrl}/formio/user/login` (portal-base)
2. `{projectUrl}/admin/login` (project admin)
3. `{projectUrl}/user/login` (project user)

## License

MIT
