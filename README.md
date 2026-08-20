# The Form.io Agentic Coding Toolset <!-- omit from toc -->

[![CI](https://github.com/formio/ai/actions/workflows/ci.yml/badge.svg)](https://github.com/formio/ai/actions/workflows/ci.yml)
[![npm: @formio/ai](https://img.shields.io/npm/v/%40formio%2Fai?label=%40formio%2Fai)](https://www.npmjs.com/package/@formio/ai)
[![npm: @formio/mcp](https://img.shields.io/npm/v/%40formio%2Fmcp?label=%40formio%2Fmcp)](https://www.npmjs.com/package/@formio/mcp)
[![MCP Registry](https://img.shields.io/badge/MCP%20Registry-io.form%2Fformio--mcp-blue)](https://registry.modelcontextprotocol.io/v0/servers?search=io.form/formio-mcp)
[![Smithery](https://img.shields.io/badge/Smithery-formio%2Fmcp-blue)](https://smithery.ai/servers/formio/mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

`@formio/ai` is what brings Form.io into your agentic coding environment. It provides a series of tools that enable any developer to perform a number of complex actions against the Form.io Enterprise Server using their favorite Agentic Coding toolsets. This turns the Form.io Enterprise Server into a **Composable Backend for Agentically Coded Applications**.

- [Getting Started](#getting-started)
- [What you get](#what-you-get)
- [Why this exists](#why-this-exists)
- [Agentic Skill Library](#agentic-skill-library)
  - [Orchestration skills](#orchestration-skills)
  - [All skills](#all-skills)
- [Examples and Use Cases](#examples-and-use-cases)
  - [Build complete applications](#build-complete-applications)
  - [Build forms and wizards](#build-forms-and-wizards)
  - [Embed forms in existing applications](#embed-forms-in-existing-applications)
  - [Work the REST API via prompt](#work-the-rest-api-via-prompt)
- [Using the MCP server without the skills](#using-the-mcp-server-without-the-skills)
- [MCP server tools](#mcp-server-tools)
  - [Forms](#forms)
  - [Roles](#roles)
  - [Actions](#actions)
  - [Project](#project)
  - [Diagnostic](#diagnostic)
- [Authentication](#authentication)
  - [Login-form auto-resolution](#login-form-auto-resolution)
- [Environment variables](#environment-variables)
- [Contributing](#contributing)
- [License](#license)

## Getting Started

To get started, open up your Terminal within your application folder, and then use one of the following methods to install this plugin within your application folder.

### Option 1: Skills.sh Installation

```bash
npx skills add formio/ai
```

The command installs the skill library into `.agents/skills/` folder within your application, which every skills-capable agent reads. It installs **skills only** — the Form.io MCP server, which is what gives the agent tools like `form_create`, `form_list`, and `project_import`, is connected on first use by the bundled `formio-mcp-setup` skill: it writes the MCP configuration for your client, asks you to approve it, and tells you to reload.

### Option 2: Agent Plugin Installation

If your agent supports plugins, installing the plugin is an **alternative** to the command above. A plugin install already includes the skills *and* the MCP server:

#### Claude Code
```
/plugin marketplace add https://github.com/formio/ai.git
/plugin install formio-ai@formio
```

#### Cursor
Plugin installation coming soon

#### Codex
Plugin installation coming soon

#### Copilot
Plugin installation coming soon

### Project Setup <!-- omit from toc -->

Neither install route asks for a URL. Both are resolved per working directory, so one install can serve several projects, and the answer travels with the code rather than with your machine. The first Form.io tool call that needs a project reports what is missing and names the command that supplies it:

```bash
# What does this directory resolve to?
npx -y @formio/mcp@0.10.0 project get --cwd "$(pwd)"

# Record it for this machine…
npx -y @formio/mcp@0.10.0 project set --project-url "<project url>" --cwd "$(pwd)"

# …or commit it with the application, tracked in git and shared with everyone who clones it
npx -y @formio/mcp@0.10.0 project set --project-url "<project url>" --scope repo --cwd "$(pwd)"
```

The skills do this for you: each one probes `project get` before its first call and asks only for whichever value the server says is missing. Two values can be involved:

- **Project URL** — the endpoint for your project. On our SaaS environment (https://portal.form.io) that is a sub-domain such as `https://myproject.form.io`. Self-hosted, it depends on how your deployment routes projects: a sub-directory (`https://forms.mysite.com/myproject`) or a sub-domain of your own domain (`https://myproject.mysite.com`).
- **Base URL** — the endpoint for the deployment. On our SaaS environment it is **always** `https://api.form.io` — never your project's `*.form.io` sub-domain. Self-hosted, it is the deployment host, often a sub-domain of your own domain, e.g. `https://forms.mysite.com`.

You usually only supply the first. The Base URL is worked out from the Project URL wherever it can be — `https://api.form.io` for a `*.form.io` project, and the parent path for a sub-directory-routed one. The exception is the sub-domain routing case, where the project host and the deployment host differ by design and neither can be derived from the other; there the server asks for the Base URL explicitly rather than guessing.

## What you get

- **Agent plugin: `@formio/ai`.** One-command install wherever the agent has a marketplace — Claude Code, Cursor, GitHub Copilot CLI, VS Code, Codex. Bundles the MCP server and the skill library, and each client reads the manifest it understands.
- **MCP server: `@formio/mcp`.** Form.io operations (`form_*`, `role_*`, `action_*`, `project_*`) as MCP tools. Works with any MCP-aware client: Claude Code, Claude Desktop, VS Copilot, and whatever comes next.
- **Skills library:** Coding agent skills covering app orchestration, form building (webforms and wizards), form embedding, resource planning, JSON-schema authoring, action configuration, authentication & authorization, the `@formio/js` SDK surface, and the full Form.io REST surface.

## Why this exists

Form.io has been the data standardization layer for enterprise data for a decade. With the proliferation of AI coding agents, that standardization matters more, not less.

**Build on the Form.io platform, not from scratch.** The agent builds complete applications including the data models, forms, workflows, and business logic. Form.io is the platform it builds on. The APIs, data patterns, RBAC, audit infrastructure, and form management capabilities are production-grade and already there. The agent uses them as tools to build applications better.

**Standardization across every AI-built app.** One model, one set of rules, one audit trail, regardless of which team or which agent built it. With a standardization layer, multiple teams ship multiple applications, all with defensible, reconcilable data layers across the enterprise.

**Governance built in.** RBAC, group permissions, change history, audit trails — all emitted on the first pass. Every app lands inside the same compliance envelope the enterprise already runs on.

## Agentic Skill Library

The plugin ships an activatable skill library. Claude loads the relevant skill on demand based on what you ask — you rarely need to name one explicitly.

### Orchestration skills

Orchestration skills are special skills that serve as the **entry point** for most prompts. Rather than covering a single capability, they coordinate the other skills (planning, schema authoring, actions, deployment, framework scaffolding) to fulfill a broad, plain-language request end to end. When you describe *what you want* instead of *which tool to use*, an orchestration skill picks it up and drives the whole pipeline.

| Skill | What it does |
| --- | --- |
| `formio-application` | Framework-agnostic "build me an app" orchestrator. Turns plain-language intent into a running application backed by a Form.io project — planning resources, importing the template, and handing off to a framework implementor. Also handles adding new features to an existing app. |
| `formio-form-builder` | "Build me a form" orchestrator. Builds a single form end to end — webform or multi-page wizard — from intent through schema authoring to a saved form in your deployment, with an optional embed handoff. Also handles field edits to an existing form. |

### All skills

| Skill | What it does |
| --- | --- |
| `formio-application` | Orchestration entry point for building or extending an application on the Form.io platform (see above). |
| `formio-form-builder` | Orchestration entry point for building a single form — webform or wizard — end to end (see above). |
| `formio-form` | Embeds and renders Form.io forms in any web application with the `@formio/js` renderer — pre-fill, conditional fields, calculated values, custom validation, and conditional wizard pages. |
| `formio-resource-planner` | Plans the resource structure, field configuration, and access/permission model from high-level requirements, then emits a ready-to-import `template.json`. |
| `formio-schema` | Reference for Form.io JSON schema — the document shapes for projects, forms/resources, and submissions. Used when constructing, editing, or interpreting any Form.io JSON. |
| `formio-actions` | Reference for configuring Form.io actions — the server-side behavior layer for email notifications, authentication, webhooks, role assignment, and form-to-form saves. |
| `formio-auth` | Authentication and authorization specialist — login/registration, RBAC, SSO (OIDC/SAML/LDAP), Token Swap, Custom JWT, passwordless email tokens, and JWT/session mechanics. |
| `formio-api` | Comprehensive Form.io REST API reference — every endpoint across platform admin, project admin, runtime, and PDF scopes. |
| `formio-sdk` | Reference for the `@formio/js` JavaScript SDK and `@formio/js/utils` Utilities — static and instance methods, VanillaJS rendering, plugins, and helpers. |
| `formio-mcp-setup` | Connects the Form.io MCP server to whichever coding agent is running, and captures the project URL, when the skills were installed without it. |
| `formio-angular` | Angular framework implementor. Turns an approved `template.json` plus a target project into a working Angular app using `@formio/angular`. Delegated to by `formio-application`. |

## Examples and Use Cases

Ready-to-paste example prompts live in [`examples/`](./examples/) — each file is one self-contained prompt plus notes on what it should exercise. To try one, create a new folder, start Claude Code inside it, and paste the prompt:

```bash
mkdir form-app
cd form-app
claude
/plugin marketplace add https://github.com/formio/ai.git
/plugin install formio-ai@formio
```

### Build complete applications

Create a brand-new 'greenfield' form-based application — or introduce a new form-based feature within an existing one — using the `formio-application` orchestration skill. The agent plans the data model, imports it into your Form.io project, and scaffolds the front end, using the Form.io platform as the composable backend for the full application logic.

- [CRM Application](./examples/apps/crm.md) — clients, deals, and activity logs with owner-scoped access.
- [Help Desk](./examples/apps/help-desk.md) — customer tickets, agent workflows, internal notes, and email notifications.
- [Storyboard](./examples/apps/storyboard.md) — Trello-style board → swimlane → story kanban with drag-and-drop ordering and team-based access.

***This library currently only supports the Angular application framework for new 'greenfield' applications. It generally supports other frameworks using the Vanilla JS `@formio/js` javascript renderer. Full support for other frameworks are coming soon.***

### Build forms and wizards

Create complex forms and multi-page conditional wizards with the `formio-form-builder` skill. The agent authors the form JSON and automatically creates the form within any stage of your deployment — including forms whose submission data must adhere to well-defined external schemas such as [FHIR](https://hl7.org/fhir).

- [College Application Wizard](./examples/forms/college-application.md) — multi-page wizard with program-driven conditional pages.
- [FHIR-Compliant Patient Form](./examples/forms/fhir-patient.md) — submission data that conforms to the FHIR Patient resource.
- [Customer Feedback Form](./examples/forms/customer-feedback.md) — conditional follow-up fields and a conditional email notification.
- [Student Onboarding Wizard](./examples/forms/student-onboarding-embed.md) — create a wizard and embed it within your application in one pass.

### Embed forms in existing applications

Embed an existing form or wizard within any HTML-based application using the `formio-form` skill.

- [Embed an Existing Form](./examples/embed/render-existing-form.md) — render a saved form with `@formio/js`, pre-fill it, and handle submit events.

### Work the REST API via prompt

The `formio-api` skill knows the full REST surface of your Form.io deployment — create any Resource, Form, Submission, or other entity via prompt.

- [Create a Patient Resource](./examples/api/patient-resource.md) — create a new resource through the MCP server's first-party tools.

## Using the MCP server without the skills

The bundled MCP server is also published standalone as [`@formio/mcp`](https://www.npmjs.com/package/@formio/mcp) — you do not need the agent plugin or the skill library to use it. Any MCP-aware client (Claude Code, Claude Desktop, Cursor, VS Code Copilot) can spawn the server directly and call the [tools below](#mcp-server-tools).

It is also listed in the [official MCP Registry](https://registry.modelcontextprotocol.io/v0/servers?search=io.form/formio-mcp) as **`io.form/formio-mcp`**, so clients that browse the registry can discover and install it without any manual configuration.

### Manual configuration <!-- omit from toc -->

```json
{
  "mcpServers": {
    "formio-mcp": {
      "command": "npx",
      "args": ["-y", "@formio/mcp@0.10.0"]
    }
  }
}
```

That is the **JSON `mcpServers`** shape — what Claude Code (`.mcp.json`), Cursor (`.cursor/mcp.json`), Claude Desktop, Windsurf, and Cline expect. Both the filename and the top-level key vary by client, so there is **no universal `.mcp.json`**.

**Copilot uses `servers`, not `mcpServers`.** In `.vscode/mcp.json` the top-level key is **`servers`** — everything inside the entry is identical.

```json
{
  "servers": {
    "formio-mcp": {
      "command": "npx",
      "args": ["-y", "@formio/mcp@0.10.0"]
    }
  }
}
```

**Codex takes TOML**, and has no JSON equivalent:

```toml
[mcp_servers.formio-mcp]
command = "npx"
args = ["-y", "@formio/mcp@0.10.0"]
```

Authentication is the same everywhere: the first authenticated tool call opens the browser portal-login flow, or set `FORMIO_API_KEY` to skip the browser entirely — required on any host with no browser, such as a cloud agent, a container, or CI.

Once connected, prompt the tools directly — no skill activation involved:

```
Using the formio-mcp tools, show me every form and role in my Form.io project, then export the full project template and save it to ./backup/template.json.
```

```
Using the formio-mcp form_create tool, create a new form called "Contact Us" with fields for full name (required), email (required), subject, and message, plus a submit button.
```

Ready-to-paste versions of these live in [`examples/mcp/`](./examples/mcp/): [Inspect and Export a Project](./examples/mcp/inspect-and-export.md) and [Create a Form Directly](./examples/mcp/create-form-direct.md).

One caveat: without the skills, the agent authors Form.io JSON (form schemas, action settings, access arrays) from its own general knowledge instead of the conventions the skill library encodes — every operation the tools cover still works, but you give up the guardrails. For other transports (Streamable HTTP for remote clients, SSE for Claude Desktop) and running the server from a clone of this repo, see the [MCP server README](./packages/mcp-server/README.md).

## MCP server tools

The bundled `@formio/mcp` server exposes these tools. Skills prefer these over raw HTTP whenever an operation is covered.

### Forms

| Tool | Purpose |
| --- | --- |
| `form_create` | Create a new form. Use the `formio-schema` skill first to build the JSON definition. |
| `form_get` | Fetch a single form definition by ID or path. |
| `form_list` | List forms with optional filtering and pagination. |
| `form_update` | Update an existing form. Call `form_get` first, edit with `formio-schema`, then update. |
| `form_revisions_list` | List the immutable published revision summaries for a form (`_vid`, `_id`, `modified`, `user`, `_vnote`). Requires form revisions to be enabled. |
| `form_revision_get` | Fetch a single immutable form revision by `_vid` or revision document `_id`. |

### Roles

| Tool | Purpose |
| --- | --- |
| `role_create` | Create a new project role. |
| `role_list` | List all project roles. |
| `role_update` | Full-replacement update of a role. Include all fields you want preserved. |

### Actions

| Tool | Purpose |
| --- | --- |
| `action_types_list` | List all action types available on the server. |
| `action_type_get` | Get an action type's settings schema. |
| `action_create` | Attach a new action to a form. |
| `action_list` | List actions on a form. |
| `action_get` | Get a single action by ID. |
| `action_update` | Update an action. |
| `action_delete` | Detach an action from a form. |

### Project

| Tool | Purpose |
| --- | --- |
| `project_export` | Export the project's complete template (roles, resources, forms, actions) as a portable JSON document. Use before `project_import` to snapshot. |
| `project_import` | Import a template JSON — additively merges roles, resources, forms, and actions in one call. **Same-machine-name items are overwritten in place; everything else is preserved.** |
| `project_set` | Persist a Project URL for a directory — in `~/.formio/projects.json` by default, or in a committed `formio.json` with `scope: "repo"`, so the target travels with the code. One server can serve several workspaces. Registered in every client. A mapping written here overrides `FORMIO_PROJECT_URL` in the server environment, which is the weakest source. |

### Diagnostic

| Tool | Purpose |
| --- | --- |
| `hello` | Smoke-test tool. Returns a static greeting; useful for verifying MCP wiring before any authenticated call. |

---

## Authentication

The MCP server supports two authentication modes:

- **JWT mode (default).** A short-lived local Express server renders the Form.io portal login form; the user signs in once, the JWT comes back via a `/callback` endpoint, and `formioFetch` attaches `x-jwt-token` on every subsequent request. The flow is implicit — the **first authenticated tool call** triggers it on a cache miss. No explicit `authenticate` tool exists.
- **API-key mode.** Set `FORMIO_API_KEY`. All requests attach `x-token`; the browser flow is skipped entirely.

### Login-form auto-resolution

When `FORMIO_LOGIN_FORM` is unset, the server probes these candidates on the first login attempt and caches the first one that responds (1.5-second timeout per candidate):

1. `{baseUrl}/formio/user/login` (portal-base)
2. `{projectUrl}/admin/login` (project admin)
3. `{projectUrl}/user/login` (project user)

The probe runs lazily — only when the local auth page is actually served.

---

## Environment variables

| Name | Required | Default | Purpose | Hosted SaaS example | Self-hosted example |
| --- | :-: | --- | --- | --- | --- |
| `FORMIO_BASE_URL` | no | derived, see note | Full base URL of your Form.io deployment. The WEAKEST of three sources: a committed `formio.json` wins, then the per-directory mapping, then this. When nothing supplies one it is derived from the project URL's shape, and a project URL that names no deployment raises an actionable error rather than defaulting. | `https://api.form.io` | `https://forms.example.com` |
| `FORMIO_PROJECT_URL` | yes\* | — | Full URL of your Form.io project. The WEAKEST of the three sources: a committed `formio.json` found by walking up from the working directory wins, then a per-directory mapping written by `project_set`, then this. Self-hosted, it is a sub-directory of the deployment or a sub-domain of your own domain (`https://myproject.example.com`), depending on how that deployment routes projects. | `https://myproject.form.io` | `https://forms.example.com/myproject` |
| `FORMIO_API_KEY` | no | `undefined` | Long-lived project API key. When set, the server skips the browser login flow — the only way to authenticate on a host with no browser. | `CHANGEME` | `CHANGEME` |
| `FORMIO_LOGIN_FORM` | no | Auto-resolved | Override the portal login form URL used by the JWT login flow. | `https://formio.form.io/user/login` | `https://forms.example.com/formio/user/login` |
| `FORMIO_FORCE_BROWSER` | no | `0` | When `1`, attempt the browser login even where the server detects no browser is available (CI, a container, SSH with no display). | — | — |
| `FORMIO_AUTH_HOST` / `FORMIO_AUTH_PORT` | no | `127.0.0.1` / ephemeral | Bind address and port for the login server. Set both when running in a container so the login page is reachable through a published port. | — | `0.0.0.0` / `43117` |
| `FORMIO_INSECURE_TLS` | no | `false` | When `true`, skips TLS certificate verification (sets `NODE_TLS_REJECT_UNAUTHORIZED=0`) — for self-hosted deployments behind self-signed certs. Do not use against production. | — | `true` |

<sub>\* Not at startup — the server starts and lists every tool without it, and only errors when a tool actually needs a project. The alternative is the `project_set` tool, which maps a working directory to a project in `~/.formio/projects.json` so one server can serve several workspaces. Resolution runs by scope, narrowest first: a committed `formio.json` found by walking up from the caller's `cwd`, then the mapping for that `cwd`, then `FORMIO_PROJECT_URL` in the environment as the weakest source, then the error. Map a directory before any client connects with `npx -y @formio/mcp@0.10.0 project set --project-url <url> --cwd <path>` — the deployment is derived from the project URL wherever it can be, so add `--base-url <url>` only when the server says it cannot be determined. `project get --cwd <path>` prints what resolves and which source won, exiting `0` when it resolved, `1` when nothing is mapped, `2` when the command itself failed, and `3` when a project resolved but its Base URL could not be determined — the half-configured directory, repaired by supplying that one value.</sub>

---

## Contributing

This is a pnpm + Turborepo monorepo: the `@formio/mcp` MCP server (`packages/mcp-server/`), the `@formio/ai` agent plugin (`plugin/`, bundling the server + skill library), and the skill test suite (`packages/skill-tests/`). Setup, conventions, skill-authoring guidelines, and the release flow are in [CONTRIBUTING.md](./CONTRIBUTING.md). Security reports: [SECURITY.md](./SECURITY.md).

## License

[MIT](./LICENSE)
