# Form.io Agentic Coding Toolset

**Build compliance-ready apps with Form.io, in your agentic coding environment.**

With Form.io, define a data model once and leverage it in multiple ways at runtime. A singular data model can be rendered as a form for humans to fill out, leveraged as the auto-generated API a system calls, or provide context for AI agents to execute workflows. One model, every surface.

That's what makes Form.io the data standardization layer for enterprises in regulated industries around the world. Form.io enables developers and AI coding agents to build applications using forms as infrastructure for compliance-ready solutions in any industry.

`@formio/ai` is what brings Form.io into your agentic coding environment. A Claude Code plugin, an MCP server (`@formio/mcp`), and a skill library so your agent works in Form.io primitives: forms, resources, nested data structures, role-based access, group permissions, server-side actions.

The result: every app your agent builds inherits the model, the governance, RBAC, and the audit trail by default.

> **Note on scope.** This repo is for AI coding agents while writing code. Form.io also provides a Universal Agent Gateway (UAG) for governing agentic workflows running in production. [More on Form.io UAG here.](https://form.io/uag)

Official Documentation
--------------------------
For the latest documentation, release information, and guides, always refer to the official Form.io Help Documentation available here:

**[https://help.form.io](https://help.form.io/dev/ai)**

## What you get

- **Claude Code plugin: `@formio/ai`.** One-command install. Bundles the MCP server and skill library, registers them with Claude Code.
- **MCP server: `@formio/mcp`.** Form.io operations (`form_*`, `role_*`, `action_*`, `project_*`) as MCP tools. Works with any MCP-aware client: Claude Code, Claude Desktop, VS Copilot, and whatever comes next.
- **Skills library:** Eight activatable skills covering app orchestration, resource planning, Angular scaffolding, JSON-schema authoring, action configuration, authentication & authorization, the `@formio/js` SDK surface, and the full Form.io REST surface.

## Why this exists

Form.io has been the data standardization layer for enterprise data for a decade. With the proliferation of AI coding agents, that standardization matters more, not less.

**Build on the Form.io platform, not from scratch.** The agent builds complete applications including the data models, forms, workflows, and business logic. Form.io is the platform it builds on. The APIs, data patterns, RBAC, audit infrastructure, and form management capabilities are production-grade and already there. The agent uses them as tools to build applications better.

**Standardization across every AI-built app.** One model, one set of rules, one audit trail, regardless of which team or which agent built it. With a standardization layer, multiple teams ship multiple applications, all with defensible, reconcilable data layers across the enterprise.

**Governance built in.** RBAC, group permissions, change history, audit trails — all emitted on the first pass. Every app lands inside the same compliance envelope the enterprise already runs on.

---

## Table of contents

- [What this library is for](#what-this-library-is-for)
- [Use cases](#use-cases)
- [Quickstart — Claude Code plugin](#quickstart--claude-code-plugin)
- [Quickstart — standalone MCP server](#quickstart--standalone-mcp-server)
- [How it works](#how-it-works)
  - [Skill routing map](#skill-routing-map)
  - [The `formio-application` flow](#the-formio-application-flow)
  - [The `formio-resource-planner` two-phase flow](#the-formio-resource-planner-two-phase-flow)
  - [The planner ↔ `formio-auth` handoff](#the-planner--formio-auth-handoff)
  - [The `formio-angular` five-phase flow](#the-formio-angular-five-phase-flow)
- [Sample resource maps](#sample-resource-maps)
  - [Task manager (group-via-join)](#task-manager-group-via-join)
  - [CRM with transitive group access](#crm-with-transitive-group-access)
- [Skills library](#skills-library)
- [MCP server tools](#mcp-server-tools)
- [Authentication](#authentication)
- [Environment variables](#environment-variables)
- [Development](#development)
- [Spec-driven development with OpenSpec](#spec-driven-development-with-openspec)
- [License](#license)

---

## What this library is for

`@formio/ai` introduces Form.io to agentic coding workflows. The skills cover the full mental model an enterprise Form.io developer carries — and the MCP tools give the agent direct, authenticated access to the running platform — so the agent can:

- **Reason about the data model** as resources, sub-resources, and join resources rather than generic tables.
- **Apply RBAC correctly** by default — Roles, Group Assignment actions, field-based `submissionAccess`, owner-vs-group-vs-role-vs-tenant access strategies, transitive group propagation through hidden calculated mirrors.
- **Wire authentication** via the built-in `user` resource or a custom user resource, with Login + Role Assignment actions, self-register vs admin-invite flows, and the right anonymous/authenticated/admin role layering.
- **Configure server-side behavior** through actions — email, webhook, save, login, role assignment, group assignment, reset password — with the right handler/method/priority/condition combinations.
- **Author and edit form JSON** — every component type, validation rule, conditional logic expression, calculated value, and field-based access block.
- **Operate the running platform** through first-party MCP tools (`form_*`, `role_*`, `action_*`, `project_*`) instead of brittle raw HTTP, with implicit JWT auth via the portal-login flow.
- **Navigate the full REST surface** — platform admin, project admin, runtime/end-user, PDF — when an MCP tool does not yet cover an operation.

Agents loaded with `@formio/ai` produce enterprise-grade applications: every resource ships with a Save Submission action so submissions actually persist; every authenticated role inherits its access through documented Group / Field-based / Role mechanics; every front-end component is scaffolded against `@formio/angular` with `FormioAuthConfig` and `FormioResourceConfig` derived directly from the planner's `template.json`.

---

## Use Cases

What you can do with these tools: Five real prompts, paste-ready in Claude Code. Each one shows a different shape of work the agent handles natively.

### Build a complete app from one prompt

> "Build me a CRM where sales reps only see accounts owned by the teams they belong to."

The agent plans the data model, imports it into Form.io, and scaffolds an Angular front-end wired to the project. Approval gate at every step. At the end you have a running application — not a prototype.

### Extend a running app

> "Also let customers leave reviews on each completed booking, and let providers reply to them."

In a workspace that's already wired to a Form.io project, the agent plans only what's new and adds it without touching what works. Existing project content stays intact.

### Plan a data model from plain language

> "Plan the resource structure for a multi-tenant booking system where customers book services from providers, providers belong to one or more locations, and admins manage everything."

The agent runs a structured interview, produces an ER diagram and access matrix for review, and emits a project template ready to import. You see the architectural shape before any code or schema gets written.

### Tighten access controls on an existing resource

> "Currently anyone authenticated can read every Account. Lock it down so reps only see Accounts owned by their Team."

The agent reads the resource, modifies the access rules, and ensures the supporting role assignments are in place. The diff lands for your review before anything ships.

### Inspect and operate a live project

> "List every form in this project that doesn't have a Save Submission action attached."

The agent queries the live project through the MCP server, surfaces what's missing, and offers to fix it. This is operational work — not building from scratch, but keeping a running system clean.

---

## Quickstart — Claude Code plugin

The fastest way to get started. From inside Claude Code:

```text
/plugin marketplace add git@github.com:formio/ai.git
/plugin install formio-ai@formio
```

Claude Code prompts for `FORMIO_BASE_URL` and `FORMIO_PROJECT_URL` on install. Then describe what you want:

> "Build me a task manager where each project has its own team of users, and users only see tasks inside projects they belong to."

The `formio-application` skill activates, runs the planner, captures URLs, imports the template, and hands off to `formio-angular` to scaffold the Angular front-end. Each step has an approval gate.

To extend an existing app, just describe the new feature in the same workspace:

> "Also let team members add comments to each task."

The same skill switches to **modify-existing** mode — plans only the new resources (delta `template.json`), additively imports them, and hands off to the Angular extend sub-skill to scaffold modules for exactly the new resources.

---

## Quickstart — standalone MCP server

The MCP server (`@formio/mcp`) is independently usable from any MCP-aware client. From a clone of this repo:

```bash
pnpm install
pnpm --filter @formio/mcp dev
```

The server starts on port 3000. Override with the `PORT` env var.

### Transports

| Transport | Endpoint | Compatible with |
| --- | --- | --- |
| Streamable HTTP | `POST /mcp` | Claude Code, VS Copilot, modern MCP clients |
| SSE | `GET /sse` + `POST /messages` | Claude Desktop, legacy MCP clients |
| stdio | `node dist/stdio.js` | `.mcp.json` spawn-mode clients |

### Connect to Claude Code

```json
{
  "mcpServers": {
    "formio-mcp": {
      "type": "http",
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

### Connect to Claude Desktop

`claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "formio-mcp": {
      "url": "http://localhost:3000/sse"
    }
  }
}
```

### Spawn via `.mcp.json` (stdio)

```json
{
  "mcpServers": {
    "formio-mcp": {
      "command": "npx",
      "args": ["-y", "@formio/mcp"],
      "env": {
        "FORMIO_BASE_URL": "https://api.form.io",
        "FORMIO_PROJECT_URL": "https://your-project.form.io"
      }
    }
  }
}
```

In standalone (non-plugin) mode, `FORMIO_BASE_URL` and `FORMIO_PROJECT_URL` are required env vars. In plugin mode, the plugin manages both via Claude Code's user-config + per-cwd `~/.formio/projects.json` mapping.

---

## How it works

Three skills do the heavy lifting on a build: the orchestrator (`formio-application`) routes work, the planner (`formio-resource-planner`) designs the data model, and the framework implementor (`formio-angular`) scaffolds the front-end. Four more skills are pulled in on demand — `formio-auth` (authentication & authorization), `formio-schema` (project / form / submission JSON), `formio-actions` (server-side behavior), `formio-sdk` (the `@formio/js` runtime), and `formio-api` (raw REST) — whenever the build or a direct question touches their domain.

### Skill routing map

Claude activates the skill whose `description` matches the request. Build-an-app intent enters through `formio-application`, which delegates to the planner, hands off to `formio-auth` when the data model needs auth beyond default roles, and routes to `formio-angular` for the front-end. The reference skills (`formio-schema`, `formio-actions`, `formio-sdk`, `formio-api`) activate directly on a matching question, or are consulted mid-build.

```mermaid
flowchart TD
    User([User request]) --> Router{Claude routes<br/>by skill description}

    Router -->|"&quot;build / extend an app&quot;"| App[formio-application<br/>orchestrator]
    Router -->|"&quot;plan / model the data&quot;"| Planner[formio-resource-planner]
    Router -->|"&quot;login, SSO, RBAC, JWT&quot;"| Auth[formio-auth]
    Router -->|"&quot;Angular front-end&quot;"| Ng[formio-angular]
    Router -->|"&quot;form / submission / project JSON&quot;"| Schema[formio-schema]
    Router -->|"&quot;email / webhook / login action&quot;"| Actions[formio-actions]
    Router -->|"&quot;Formio.* / Utils.* in JS&quot;"| Sdk[formio-sdk]
    Router -->|"&quot;call a REST endpoint&quot;"| Api[formio-api]

    App -->|Step 2: Plan| Planner
    Planner -.->|"non-default auth<br/>(SSO / Custom JWT / groups)"| Auth
    App -->|Step 6: Framework| Ng
    Ng -.->|per-resource modules| NgRes[formio-angular/resources]

    Planner -.->|consults| Schema
    Planner -.->|emits| Actions
    Ng -.->|runtime calls| Sdk
    App -.->|MCP tools| MCP[("@formio/mcp<br/>form_* role_* action_* project_*")]
    Ng -.->|MCP tools| MCP

    style Router fill:#67b346,color:#fff
    style App fill:#e8f5e4
    style Planner fill:#e8f5e4
    style Auth fill:#fff4e0
    style Ng fill:#e8f5e4
    style MCP fill:#fff4e0
```

### The `formio-application` flow

`formio-application` is the default "build me an app" entry point. It runs a six-step orchestration with approval gates at every write. **Build-new** runs all six. **Modify-existing** skips Deployment + MCP Config (URLs already known) but still plans (delta) and still imports (additive).

```mermaid
flowchart TD
    User([User intent:<br/>&quot;build me a CRM&quot; OR &quot;also track attendees&quot;]) --> Intent{Step 1: Intent<br/>build-new or modify-existing?}

    Intent -->|build-new| PlanFull[Step 2: Plan<br/>formio-resource-planner<br/>full-project template.json]
    Intent -->|modify-existing| PlanDelta[Step 2: Plan<br/>formio-resource-planner<br/>delta template.json<br/>only new resources]

    PlanFull --> Deploy[Step 3: Deployment<br/>capture FORMIO_BASE_URL<br/>+ FORMIO_PROJECT_URL]
    Deploy --> MCPConfig[Step 4: MCP Config<br/>write ./.mcp.json<br/>approval gate]
    MCPConfig --> Restart[/Halt — user restarts<br/>Claude Code or /mcp reconnect/]
    Restart --> ImportFull[Step 5: Import<br/>project_import full template<br/>first call triggers portal login]

    PlanDelta --> ReadURLs[Steps 3 + 4 SKIPPED<br/>read URLs from workspace<br/>FormioAppConfig]
    ReadURLs --> ImportDelta[Step 5: Import<br/>project_import delta template<br/>additive merge into existing project]

    ImportFull --> FrameworkNew[Step 6: Framework routing<br/>scaffold new app]
    ImportDelta --> FrameworkExtend[Step 6: Framework routing<br/>extend sub-skill<br/>scaffolds only new resource modules]

    FrameworkNew --> Angular[formio-angular]
    FrameworkExtend --> AngularResources[formio-angular/resources]

    Angular --> App([Running app])
    AngularResources --> App

    style Intent fill:#67b346,color:#fff
    style PlanFull fill:#e8f5e4
    style PlanDelta fill:#e8f5e4
    style MCPConfig fill:#fff4e0
    style ImportFull fill:#fff4e0
    style ImportDelta fill:#fff4e0
    style FrameworkNew fill:#e8f5e4
    style FrameworkExtend fill:#e8f5e4
    style Angular fill:#e8f5e4
    style AngularResources fill:#e8f5e4
    style App fill:#67b346,color:#fff
```

| Step | Build-new | Modify-existing |
| --- | --- | --- |
| 1. Intent | Identify build-new | Identify modify-existing |
| 2. Plan | Full-project `template.md` + `template.json` | Delta — only new resources/fields/actions |
| 3. Deployment | Capture URLs (one batched `AskUserQuestion`) | Skipped — read URLs from workspace `FormioAppConfig` |
| 4. MCP Config | Write `./.mcp.json`, halt for restart | Skipped — `.mcp.json` already in place |
| 5. Import | Additive `project_import` (first call triggers portal login) | Additive `project_import` of delta |
| 6. Framework | Scaffold full app (Angular today) | Hand list of new resources to extend sub-skill |

Import is **additive**: existing project content is preserved; only matching machine-names are overwritten. Authentication is implicit — the first authenticated MCP tool call triggers the browser portal-login flow on a cache miss.

### The `formio-resource-planner` two-phase flow

The planner is interview-driven and emits two artifacts in lockstep — `template.md` (architectural intent, ER + Access Flow diagrams) and `template.json` (the structured Form.io export, every resource + role + form + action). Phase A always blocks on user approval before Phase B writes any file.

```mermaid
flowchart TD
    Req([User requirement:<br/>&quot;Task manager — projects, tasks, teams of users&quot;]) --> Entities[Round 1<br/>extract named entities]
    Entities --> Rels[Round 2<br/>determine relationships<br/>1:1 / 1:N / N:N]
    Rels --> Auth[Round 3<br/>user / auth model<br/>built-in user vs custom]
    Auth --> Access[Round 4<br/>access model<br/>owner / group / role / tenant]

    Access --> PhaseA[Phase A<br/>Resource Map<br/>ASCII ER + Access Flow]
    PhaseA --> Gate{User<br/>approves?}
    Gate -->|revise| Rels
    Gate -->|approve| PhaseB[Phase B<br/>Write template.md +<br/>template.json paired set<br/>Mermaid diagrams]
    PhaseB --> Done([Ready for project_import])

    style PhaseA fill:#fff4e0
    style Gate fill:#67b346,color:#fff
    style PhaseB fill:#e8f5e4
    style Done fill:#67b346,color:#fff
```

Every emitted `template.json` includes a top-level `actions` map with at minimum a `Save Submission` action per resource (omitting it produces a project where forms accept submissions but never store them — the planner treats that as a hard failure).

### The planner ↔ `formio-auth` handoff

The contract between the two auth-aware skills is explicit. `formio-resource-planner` owns the **data model** — roles, the `user` resource, login/registration forms, group joins — and emits the canonical `template.json` shapes for the Login, Role Assignment, and Group Assignment actions plus the `access` / `submissionAccess` arrays. `formio-auth` owns the **auth configuration that runs on top of that model** — SSO (OIDC / OAuth / SAML / LDAP) with provider role mapping, Token Swap, Custom JWT signed with `JWT_SECRET`, passwordless email-token auth, and JWT / session / 2FA / reCAPTCHA mechanics. Action JSON shapes are never duplicated; `formio-auth` references the planner's `references/template-json.md` by path.

```mermaid
flowchart TD
    Map[Resource Map approved<br/>Users &amp; Auth section] --> Q{Auth beyond<br/>resource login + Role + Group?}
    Q -->|no| Planner[formio-resource-planner<br/>emits template.json<br/>Login / Role / Group actions]
    Q -->|"SSO ≠ none, Custom JWT,<br/>Token Swap, passwordless, 2FA"| Auth[formio-auth<br/>configures auth layer<br/>on top of the model]
    Planner --> Import([project_import])
    Auth -.->|references template-json.md| Planner
    Auth --> Import

    style Q fill:#67b346,color:#fff
    style Auth fill:#fff4e0
    style Planner fill:#e8f5e4
    style Import fill:#67b346,color:#fff
```

Hand off to `formio-auth` immediately after the Resource Map is approved whenever its `Users & Auth` section emits a non-`none` `SSO` field, a `Custom JWT: yes`, or any auth concern beyond resource-backed login plus Role and Group Assignment.

### The `formio-angular` five-phase flow

Invoked either as a handoff from `formio-application` (URLs and `template.json` already in hand) or directly when the user names Angular explicitly. Each phase has its own approval gate.

```mermaid
flowchart TD
    Entry{Invoked by} -->|formio-application handoff| Handoff[SETUP confirms handoff context<br/>URLs + template paths already known]
    Entry -->|user names Angular directly| Direct[SETUP runs full URL interview]

    Handoff --> Bootstrap
    Direct --> Bootstrap

    Bootstrap{Phase 2<br/>BOOTSTRAP<br/>angular.json present?}
    Bootstrap -->|no| Install[Install angular/skills lib<br/>delegate to angular-new-app<br/>install @formio/angular + @formio/js<br/>Bootstrap 5 + zone.js]
    Bootstrap -->|yes| Config

    Install --> Config[Phase 3<br/>CONFIG<br/>generate src/app/config.ts<br/>FormioAppConfig]
    Config --> AuthPhase[Phase 4<br/>AUTH<br/>AuthModule + login/register<br/>route guards on protected routes<br/>login-success notification]
    AuthPhase --> Resources[Phase 5<br/>Resources sub-skill<br/>per-resource NgModule<br/>FormioResourceConfig + guarded Routes]
    Resources --> Done([Running Angular app])

    style Bootstrap fill:#67b346,color:#fff
    style Config fill:#e8f5e4
    style AuthPhase fill:#e8f5e4
    style Resources fill:#e8f5e4
    style Done fill:#67b346,color:#fff
```

Generated workspaces use NgModule-based components (`standalone: false`) to match the official `@formio/angular` demo, with Bootstrap 5 + Bootstrap Icons wired via `angular.json`. The AUTH phase wires a `FormioAuthService`-backed login/register experience and attaches route guards so protected resource routes redirect unauthenticated users to login (with a login-success notification on return). UI-touching files consult Claude's built-in `frontend-design` skill before authoring templates or styles.

---

## Sample resource maps

These are real outputs from `formio-resource-planner`'s `references/examples/`. Both ship with paired `template.md` and `template.json` artifacts under [`plugin/skills/formio-resource-planner/references/examples/`](./plugin/skills/formio-resource-planner/references/examples/).

### Task manager (group-via-join)

A multi-user task manager where each Project has a team of Users and users only see Tasks inside Projects they belong to. Demonstrates **group permissions via a join resource** (`ProjectUser`) and **field-based ACL inheritance** (`Task.project`).

```mermaid
erDiagram
    User ||--o{ ProjectUser : "member of"
    Project ||--o{ ProjectUser : "has members"
    Project ||--o{ Task : "contains"

    User {
        string email "login identifier (unique)"
        string password "login secret"
    }
    Project {
        string name "required"
    }
    Task {
        string description
        select project "ref=Project, field-based access"
    }
    ProjectUser {
        select project "ref=Project"
        select user "ref=User"
        action GroupAssignment "group=project, user=user"
    }
```

```mermaid
flowchart TD
    Admin[[administrator]] --> All[[every resource]]
    Auth[[authenticated]] -->|"membership row"| PU[/ProjectUser/]
    PU -->|"Group Assignment<br/>group=project<br/>user=user"| P[Project]
    P -->|"field-based submissionAccess<br/>on Task.project"| T[Task]
    Auth -->|"Submission Access: read_own, update_own"| U[User]
```

| Resource | Actor | create | read | update | delete | Notes |
| --- | --- | :-: | :-: | :-: | :-: | --- |
| Project | administrator | all | all | all | all | full admin |
| Project | authenticated | — | group | group | — | group-via-ProjectUser |
| Task | administrator | all | all | all | all |  |
| Task | authenticated | group | group | group | — | inherits via `Task.project` |
| ProjectUser | administrator | all | all | all | all | admin-managed membership |
| ProjectUser | authenticated | — | own | — | — | user sees their own memberships |
| User | administrator | all | all | all | all |  |
| User | authenticated | — | own | own | — | owner-level on own record |

### CRM with transitive group access

A multi-team CRM where the group (`Team`) sits **two levels above** the bottom of the hierarchy. The direct child (`Account`) uses a normal group-reference select; grandchildren (`Contact`, `Deal`, `Activity`) use a hidden, calculated `team` mirror field to propagate the ACL one more hop.

```mermaid
erDiagram
    User ||--o{ TeamUser : "member of"
    Team ||--o{ TeamUser : "has members"
    Team ||--o{ Account : "owns (direct group)"
    Account ||--o{ Contact : "has"
    Account ||--o{ Deal : "has"
    Account ||--o{ Activity : "has"
    Deal ||--o{ Activity : "optional back-ref"

    Team { string name "required" }
    TeamUser {
        select team "ref=Team"
        select user "ref=User"
        action GroupAssignment "group=team, user=user"
    }
    Account {
        string name "required"
        select team "ref=Team, field-based access (direct group)"
    }
    Contact {
        string firstName
        select account "ref=Account"
        select team "HIDDEN calculated mirror: data.account.data.team"
    }
    Deal {
        string title
        select account "ref=Account"
        select team "HIDDEN calculated mirror"
    }
    Activity {
        string subject
        select account "ref=Account"
        select team "HIDDEN calculated mirror"
    }
```

```mermaid
flowchart TD
    Admin[[administrator]] --> All[[every resource]]
    SR[[salesRep]] -->|"Role Assignment on userRegister"| SR
    SR -->|"membership row (one per Team)"| TU[/TeamUser/]
    TU -->|"Group Assignment<br/>group=team<br/>user=user"| Team[Team]
    Team -->|"field-based submissionAccess<br/>on Account.team"| Account[Account]
    Account -->|"hidden calculated mirror<br/>value = data.account.data.team"| Contact[Contact]
    Account -->|"hidden calculated mirror"| Deal[Deal]
    Account -->|"hidden calculated mirror"| Activity[Activity]
```

Runtime propagation:

1. User self-registers on `userRegister` → Save writes into `user` resource → Role Assignment grants `salesRep` → Login issues JWT.
2. Admin creates a `TeamUser(team, user)` row → Group Assignment writes an ACL entry onto the Team submission.
3. `Account.team` carries field-based `submissionAccess` (4 entries, empty roles) → Form.io propagates the Team's ACL onto each Account whose `team` matches.
4. `Contact` / `Deal` / `Activity` each carry a hidden `team` select with `calculateValue: value = data.account.data.team;`, `refreshOn: account`, `hidden: true`, plus the same field-based `submissionAccess` block — propagating the ACL one more hop on every save.

---

## Skills library

Eight activatable skills under [`plugin/skills/`](./plugin/skills/). Claude routes between them based on what the user asked for (see the [skill routing map](#skill-routing-map)).

### Orchestration & framework skills

| Skill | Purpose |
| --- | --- |
| [`formio-application`](./plugin/skills/formio-application/) | Default "build me an app" orchestrator. Six-step pipeline: Intent → Plan → Deployment → MCP Config → Import → Framework routing. Build-new runs all six; modify-existing runs Plan (delta) + Import (additive) + Framework (extend sub-skill), skipping only Deployment + MCP Config. |
| [`formio-resource-planner`](./plugin/skills/formio-resource-planner/) | Turns plain-language requirements into a Form.io project `template.md` + `template.json` pair — resources, fields, roles, actions, access model. Two-phase: Resource Map (review) → paired artifacts (after explicit approval). Encodes when to model something as a resource vs a plain form, and the access-model anti-patterns to avoid. Hands non-default auth off to `formio-auth`. |
| [`formio-angular`](./plugin/skills/formio-angular/) | Angular framework implementor. Five-phase scaffold flow over `@formio/angular` (NgModule-based, `standalone: false`, Bootstrap 5). Sub-skill at [`resources/`](./plugin/skills/formio-angular/resources/) handles per-resource NgModule generation and modify-existing extension. |

### Schema, action & SDK skills

| Skill | Purpose |
| --- | --- |
| [`formio-schema`](./plugin/skills/formio-schema/) | Comprehensive JSON schema reference for **projects, forms (and resources), and submissions** — component types, validation, conditional logic, project settings/integrations, submission `data`/`access`/`metadata`/state. Consulted when reading, writing, or editing any Form.io JSON. (Absorbs the former `formio-form` skill.) |
| [`formio-actions`](./plugin/skills/formio-actions/) | Deep reference for configuring Form.io server-side actions — email, login, webhook, role assignment, save, reset password — including handler/method, priorities, and conditions. |
| [`formio-auth`](./plugin/skills/formio-auth/) | Authentication & authorization specialist — resource-backed login (Login + Role Assignment actions), the eight RBAC permission types, group permissions (single-level + transitive), SSO via OIDC/OAuth/SAML/LDAP with role mapping, Token Swap, Custom JWT (`JWT_SECRET`), passwordless email-token auth, and JWT/session/2FA/reCAPTCHA mechanics. Peer to the planner; owns the auth layer the planner's data model runs on. |
| [`formio-sdk`](./plugin/skills/formio-sdk/) | Source-derived reference for the `@formio/js` SDK, `@formio/js/utils` Utilities, and `@formio/core` helpers — static & instance `Formio.*` methods, VanillaJS rendering (`Formio.createForm`, `Formio.builder`), the plugin lifecycle, and the `Utils` surface (Evaluator, traversal, conditions, JSONLogic, mask/sanitize). Mandates ESM imports. |

### API skill + reference library

| Skill | Purpose |
| --- | --- |
| [`formio-api`](./plugin/skills/formio-api/) | Single activatable skill covering every endpoint in the [Form.io API Postman collection](https://documenter.getpostman.com/view/684631/2sBXiok9LB) — platform admin, project admin, runtime/end-user, PDF. Activates on any Form.io REST question and navigates into the relevant reference doc. |

The endpoint detail lives under [`plugin/skills/formio-api/references/`](./plugin/skills/formio-api/references/) — one Markdown file per capability group (no frontmatter, not independently activatable, read via links from the router). The groups:

- **Platform scope** (`${FORMIO_BASE_URL}/`): `platform-auth`, `platform-projects`, `platform-teams`, `platform-staging`, `platform-tenants`, `server-status`
- **Project scope** (`${FORMIO_PROJECT_URL}/`): `project-auth`, `project-roles`, `project-forms`, `project-form-revisions`, `project-actions`
- **Runtime scope** (`${FORMIO_PROJECT_URL}/`): `runtime-auth`, `runtime-custom-users`, `runtime-access-control`, `runtime-reports`, `runtime-submissions`
- **PDF scope** (`${FORMIO_PROJECT_URL}/pdf-proxy/`): `pdf-api`

Two automated checks guard the skill library (both also run under the repo-wide `turbo run test`):

- **Plugin bundle structure** — `pnpm --filter @formio/mcp test` runs [`packages/mcp-server/src/__tests__/plugin-build.test.ts`](./packages/mcp-server/src/__tests__/plugin-build.test.ts), which asserts the right skills ship in `dist/plugin/skills/` (e.g. `formio-api` and `formio-schema` present, the retired `formio-form` and the `openspec-*` / `tdd-*` skills excluded) and that `plugin.json` and the bundled stdio server are well-formed. (Run `pnpm build:plugin` first to populate `dist/plugin/`.)
- **SDK example execution** — `pnpm --filter @formio/skill-tests test` runs the [`@formio/skill-tests`](./packages/skill-tests/) package, which executes the code examples shipped in `formio-sdk`'s reference docs against the real `@formio/js` / `@formio/core` at runtime, so a doc that drifts from the SDK's actual export shape fails a test with a pointer to the bad example.

Terminology in the skills is strict (a convention, not test-enforced): `baseUrl`/`base_url` always means `FORMIO_BASE_URL`; `projectUrl`/`project_url` always means `FORMIO_PROJECT_URL`.

---

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
| `project_set` | Plugin-mode only — persist a per-cwd Project URL mapping in `~/.formio/projects.json`. Never exposed standalone (the standalone server binds to `FORMIO_PROJECT_URL` via env instead). |

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

1. `${FORMIO_BASE_URL}/formio/user/login` (portal-base)
2. `${FORMIO_PROJECT_URL}/admin/login` (project admin)
3. `${FORMIO_PROJECT_URL}/user/login` (project user)

The probe runs lazily — only when the local auth page is actually served.

---

## Environment variables

| Name | Required | Default | Purpose | Hosted SaaS example | Self-hosted example |
| --- | :-: | --- | --- | --- | --- |
| `FORMIO_BASE_URL` | yes | — | Full base URL of your Form.io deployment. | `https://api.form.io` | `https://forms.example.com` |
| `FORMIO_PROJECT_URL` | yes\* | — | Full URL of your Form.io project. In plugin mode, only used as the pre-filled default offered when prompting for an unmapped cwd. | `https://myproject.form.io` | `https://forms.example.com/myproject` |
| `FORMIO_API_KEY` | no | `undefined` | Long-lived project API key. When set, the server skips the browser login flow. | `CHANGEME` | `CHANGEME` |
| `FORMIO_LOGIN_FORM` | no | Auto-resolved | Override the portal login form URL used by the JWT login flow. | `https://formio.form.io/user/login` | `https://forms.example.com/formio/user/login` |
| `FORMIO_PLUGIN_CONTEXT` | no | `0` | Set by the plugin manifest. When `1`, the server enables `project_set` and reads `FORMIO_PROJECT_URL` from `~/.formio/projects.json` per cwd instead of env. |  |  |
| `FORMIO_INSECURE_TLS` | no | `false` | When `true`, skips TLS certificate verification (sets `NODE_TLS_REJECT_UNAUTHORIZED=0`) — for self-hosted deployments behind self-signed certs. Do not use against production. | — | `true` |

\* In plugin context, `FORMIO_PROJECT_URL` is captured per-cwd by the `project_set` tool and persisted to `~/.formio/projects.json`. The `verify-project-url` `SessionStart`/`PreToolUse` hook offers `formio_default_project_url` (from plugin user-config) as the default the first time you enter a workspace.

---

## Development

This is a [pnpm](https://pnpm.io/) + [Turborepo](https://turbo.build/) monorepo.

### Prerequisites

- Node.js >= 20
- pnpm 10.x

### Common commands

```bash
pnpm install        # install workspace deps
pnpm build          # build all packages
pnpm dev            # run all packages in watch mode
pnpm test           # run all tests (Vitest across @formio/mcp + @formio/skill-tests + plugin build/smoke)
pnpm lint           # type-check all packages
pnpm format         # prettier --write .
pnpm clean          # clean build artifacts
pnpm build:plugin   # bundle the plugin into dist/plugin/
pnpm test:plugin    # run plugin smoke tests
```

### MCP server only

```bash
pnpm --filter @formio/mcp dev         # start with hot reload (port 3000)
pnpm --filter @formio/mcp test        # run tests once
pnpm --filter @formio/mcp test:watch  # run tests in watch mode
pnpm --filter @formio/mcp build       # compile to dist/
```

### Skill SDK tests

```bash
pnpm --filter @formio/skill-tests test   # run formio-sdk doc examples against the real @formio/js
```

[`@formio/skill-tests`](./packages/skill-tests/) executes the code examples in `formio-sdk`'s reference docs against the live SDK — a failing test means a reference doc has drifted from the SDK's actual surface. See [`packages/skill-tests/README.md`](./packages/skill-tests/README.md).

### Definition of Done

Work is not complete until all of the following pass:

- **Tests** — `pnpm test`
- **Type-check** — `pnpm lint`
- **Formatting** — `pnpm format`

TDD is mandatory. Write failing tests first, then implement the minimum code to make them pass.

### Local plugin testing

See [`examples/basic-app/README.md`](./examples/basic-app/README.md) for the full local-plugin loop — building the plugin, registering the local marketplace, and exercising it from inside Claude Code without publishing to npm.

### Iterating on skills

Some skills (`formio-resource-planner`, `formio-angular`) ship their own eval harness under `evals/`. The standard layout:

- `skills/<skill>/evals/evals.json` — test prompts + expected outputs
- `skills/<skill>/evals/grade.py` — structural assertions; reads `.eval-artifacts/<skill>/iteration-N/` and writes `grading.json`
- `skills/<skill>/evals/README.md` — teammate-facing runbook (seed fixtures → spawn subagents → grade → aggregate)

When iterating on, testing, or measuring a skill change, **read that skill's `evals/README.md` first** — don't improvise. The standard loop is the same across skills, but each README documents skill-specific add-ons.

---

## Spec-driven development with OpenSpec

This project uses [OpenSpec](https://openspec.dev/) for spec-driven development. Specs live in `openspec/specs/` organized by capability; change proposals are generated in `openspec/changes/`.

```bash
npm install -g @fission-ai/openspec@latest
```

Workflow:

1. **Explore** — read existing specs in `openspec/specs/` for context.
2. **Propose** — `/openspec:propose` plans a change with design rationale, specs, and tasks before implementing.
3. **Implement** — `/openspec:apply` works through the generated tasks.
4. **Archive** — `/openspec:archive` finalizes a completed change.

---

## License

[MIT](./LICENSE)
