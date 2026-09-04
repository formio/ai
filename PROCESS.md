# How `@formio/ai` Works — Skills Architecture and Process Flows <!-- omit from toc -->

This document explains what actually happens inside your coding agent when you prompt it with a Form.io task: which skill picks the request up, which other skills it loads, when it talks to the Form.io Enterprise Server through the MCP server, and where you are asked to approve something before anything is written.

Read it if you want to know **how the library is utilized** rather than how to install it. Installation, the tool catalog, and the environment variables live in [README.md](./README.md).

- [The three layers](#the-three-layers)
- [Why it is split this way](#why-it-is-split-this-way)
- [The skill catalog by role](#the-skill-catalog-by-role)
- [How a skill gets loaded](#how-a-skill-gets-loaded)
- [Prompt routing — which flow your words trigger](#prompt-routing--which-flow-your-words-trigger)
- [Contracts every skill obeys](#contracts-every-skill-obeys)
  - [Preflight — are the tools there?](#preflight--are-the-tools-there)
  - [Project resolution — which project am I writing to?](#project-resolution--which-project-am-i-writing-to)
  - [Authentication — how the server proves who you are](#authentication--how-the-server-proves-who-you-are)
  - [Approval gates](#approval-gates)
- [Flow A — build an application](#flow-a--build-an-application)
- [Flow B — extend an application you already have](#flow-b--extend-an-application-you-already-have)
- [Flow C — build a form or wizard](#flow-c--build-a-form-or-wizard)
- [Flow D — embed a form in an existing page or app](#flow-d--embed-a-form-in-an-existing-page-or-app)
- [Flow E — change a project directly](#flow-e--change-a-project-directly)
- [Flow F — configure authentication](#flow-f--configure-authentication)
- [Flow G — first run, no MCP server yet](#flow-g--first-run-no-mcp-server-yet)
- [Flow H — add Form.io to an application that already exists](#flow-h--add-formio-to-an-application-that-already-exists)
- [Flow I — when a step fails, and how a flow rewinds](#flow-i--when-a-step-fails-and-how-a-flow-rewinds)
- [Flow J — reaching a skill directly](#flow-j--reaching-a-skill-directly)
- [Operating details worth knowing](#operating-details-worth-knowing)
  - [Planning without building](#planning-without-building)
  - [The artifact pair](#the-artifact-pair)
  - [Snapshotting before a write](#snapshotting-before-a-write)
  - [URLs in generated code](#urls-in-generated-code)
- [Where the flows converge](#where-the-flows-converge)
- [Extending the library](#extending-the-library)

## The three layers

Three things cooperate on every request. The skills hold the knowledge, the MCP server holds the capability, and the Form.io Enterprise Server holds the truth.

```mermaid
flowchart TB
    User["Developer prompt<br/><i>“build me a help desk”</i>"]

    subgraph Agent["Coding agent (Claude Code, Cursor, Copilot, Codex…)"]
        direction TB
        Orch["<b>Orchestration skills</b><br/>formio-application · formio-form-builder"]
        Impl["<b>Implementors</b><br/>formio-resource-planner · formio-angular · formio-react · formio-form"]
        Ref["<b>Reference skills</b><br/>formio-schema · formio-actions · formio-auth · formio-api · formio-sdk"]
        Setup["<b>Bootstrap skill</b><br/>formio-mcp-setup"]
    end

    MCP["<b>@formio/mcp</b> — MCP server<br/>form_* · role_* · action_* · project_*<br/>resolves the target project · attaches auth"]
    Formio["<b>Form.io Enterprise Server</b><br/>projects · resources · forms · actions · roles · submissions"]
    App["<b>Your application</b><br/>generated source, calling Form.io at runtime"]

    User --> Orch
    Orch --> Impl
    Impl --> Ref
    Orch -. "tools missing" .-> Setup
    Setup -. "writes MCP config" .-> MCP
    Impl -->|"tool calls"| MCP
    Orch -->|"tool calls"| MCP
    MCP -->|"HTTPS + x-jwt-token / x-token"| Formio
    Impl -->|"writes files"| App
    App -->|"REST at runtime"| Formio
```

**Skills are knowledge, not code.** A skill is a markdown document the agent reads on demand. It contains the conventions — how a Form.io resource should be modeled, what a Login Action's settings look like, which components exist, how `@formio/angular`'s `FormioResource` is wired — that the agent would otherwise guess at.

**The MCP server is the only build-time path to your deployment.** Skills are explicitly forbidden from hand-rolling HTTP requests against a Form.io deployment or writing a throwaway script that does it for them. If a tool is missing, the skill stops and reports it. That ban covers **build-time** work only — the application being generated is expected to call the Form.io REST API at runtime, and [`formio-api`](./plugin/skills/formio-api/SKILL.md)'s runtime-scope references exist for exactly that code.

**The Enterprise Server is the composable backend.** The data model, RBAC, audit trail, and submission API are not generated into your app — they are configured on the platform and consumed by it.

## Why it is split this way

A single monolithic "Form.io skill" would be loaded in full for every request, which wastes context on guidance the task does not need, and it would let a form-embedding question drift into rewriting a project's access model. The split gives three properties:

- **Progressive disclosure.** Only the descriptions of skills are always in context. The body of a skill loads when it is activated; a skill's phase documents and reference files load when that phase is reached. A "how do I hide a field" question never loads the Angular scaffolding guidance.
- **One owner per concern.** Data modeling lives in the planner. Form JSON shapes live in `formio-schema`. Server-side behavior lives in `formio-actions`. Auth architecture lives in `formio-auth`. Skills link to each other rather than restating, so two documents cannot drift apart on the same fact.
- **Framework-pluggability.** The orchestrator does not know Angular or React. It reads a registry, picks an implementor, and hands off a fixed payload. A new framework is a new row plus a new skill.

## The skill catalog by role

| Role | Skill | What it owns |
| --- | --- | --- |
| **Orchestrator** | [`formio-application`](./plugin/skills/formio-application/SKILL.md) | The whole "build/extend an app" pipeline: intent → plan → import → framework handoff. |
| **Orchestrator** | [`formio-form-builder`](./plugin/skills/formio-form-builder/SKILL.md) | The whole "build one form" pipeline: intent → schema → save → optional embed. Plus the edit lane for an existing form. |
| **Planner** | [`formio-resource-planner`](./plugin/skills/formio-resource-planner/SKILL.md) | The data model. Interviews, classifies each entity as Resource or Form, and emits the `template.md` + `template.json` pair. Calls no MCP tool. |
| **Framework implementor** | [`formio-angular`](./plugin/skills/formio-angular/SKILL.md) | Angular apps via `@formio/angular`. A router over two branches: five gated phases for an application, or a single-form embed; delegates to `formio-angular-resources` and `formio-angular-form`. |
| **Framework implementor** | [`formio-react`](./plugin/skills/formio-react/SKILL.md) | React apps (Vite + React Router data routers) via `@formio/react`. A router over three branches; delegates to `formio-react-resources` and `formio-react-form`. |
| **Embedding** | [`formio-form`](./plugin/skills/formio-form/SKILL.md) | Framework-agnostic embedding with `@formio/js`, and **all** definition-level behavior — conditionals, calculated values, custom validation, cascading selects, wizard page logic — whatever the host framework. |
| **Reference** | [`formio-schema`](./plugin/skills/formio-schema/SKILL.md) | Form.io JSON document shapes: projects, forms/resources, submissions, components. |
| **Reference** | [`formio-actions`](./plugin/skills/formio-actions/SKILL.md) | Per-form server-side behavior: Save, Login, Role Assignment, Group Assignment, Email, Webhook — anatomy, handlers, methods, priorities, conditions. |
| **Reference** | [`formio-auth`](./plugin/skills/formio-auth/SKILL.md) | Auth architecture on top of the model: SSO (OIDC/OAuth, SAML, LDAP), Token Swap, Custom JWT, passwordless, JWT/session mechanics, 2FA, reCAPTCHA, RBAC tuning. |
| **Reference** | [`formio-api`](./plugin/skills/formio-api/SKILL.md) | The full REST surface across platform, project, runtime, and PDF scopes. |
| **Reference** | [`formio-sdk`](./plugin/skills/formio-sdk/SKILL.md) | `@formio/js` and `@formio/js/utils` — statics, instances, `Formio.createForm`, plugins, `Utils`. |
| **Bootstrap** | [`formio-mcp-setup`](./plugin/skills/formio-mcp-setup/SKILL.md) | Connecting the MCP server to whichever client is running, and capturing the project URL. The single remedy every other skill offers when the tools are absent. |

Nested sub-skills — [`formio-angular-resources`](./plugin/skills/formio-angular/formio-angular-resources/SKILL.md), [`formio-angular-form`](./plugin/skills/formio-angular/formio-angular-form/SKILL.md), [`formio-react-resources`](./plugin/skills/formio-react/formio-react-resources/SKILL.md), [`formio-react-form`](./plugin/skills/formio-react/formio-react-form/SKILL.md) — are **loaded by file path** by their parent, not activated by name. They do the per-resource and per-form generation work.

## How a skill gets loaded

Nothing in this library is invoked by hand in the normal case. Loading happens in four widening tiers, and each tier costs context only when the work reaches it.

```mermaid
flowchart TD
    P["Your prompt"] --> D{"Match against every<br/>skill <b>description</b><br/>(always in context)"}
    D -->|"‘build me an app’"| A["Load formio-application/SKILL.md"]
    D -->|"‘build me a form’"| B["Load formio-form-builder/SKILL.md"]
    D -->|"‘embed this form’"| C["Load formio-form/SKILL.md"]
    D -->|"names a framework"| E["Load formio-angular / formio-react"]
    D -->|"‘what endpoint…’"| F["Load formio-api/SKILL.md"]

    A --> G["Reach a step → load that step's<br/>phase document<br/><i>INTENT.md · IMPORT.md · FRAMEWORK.md</i>"]
    E --> G2["Reach a phase → load that phase's document<br/><i>SETUP · BOOTSTRAP · CONFIG · AUTH</i>"]
    F --> H["Navigate by scope → load one<br/>reference file under references/"]

    G --> I["Invoke another <b>skill</b> for a concern it owns<br/><i>planner · schema · actions · auth</i>"]
    G2 --> J["Load a nested <b>sub-skill</b> by path<br/><i>*-resources · *-form</i>"]
```

Three distinct mechanisms are in play, and the difference matters when you read a skill:

- **Activation by description** — the agent matches your words against each skill's three-clause description (capability, "use when…", "not for…"). The negative clause is what keeps `formio-application` from stealing an embed request, and `formio-form` from stealing a React one.
- **Phase documents** — a skill's own steps live in sibling files (`INTENT.md`, `IMPORT.md`, `SETUP.md`, `BOOTSTRAP.md`…). They are read at the step, so a flow that stops at step 2 never pays for step 4.
- **Reference files** — the deep material (endpoint groups, component catalogs, template shapes) lives under `references/` and is read only when a specific answer needs it.

## Prompt routing — which flow your words trigger

| What you say | Skill that claims it | Flow |
| --- | --- | --- |
| "build me a CRM", "spin up a help desk", "an app to track inspections" | `formio-application` | [A](#flow-a--build-an-application) |
| "also track invoices in my app", "add a way to see per-agent stats" | `formio-application` (delta mode) | [B](#flow-b--extend-an-application-you-already-have) |
| "build it in Angular", "React front-end for this project" | `formio-angular` / `formio-react` directly | A, from the framework phase onward |
| "add an Angular module for `Ticket`", "add a React route for `Deal`" | the `*-resources` sub-skill, by name | B, resources phase only |
| "build a contact form", "a multi-page intake wizard", "a FHIR patient form" | `formio-form-builder` | [C](#flow-c--build-a-form-or-wizard) |
| "add a phone field to my registration form" | `formio-form-builder` (edit lane) | C, shortened |
| "embed this form on my page", "pre-fill this form", "hide a field when X" | `formio-form` | [D](#flow-d--embed-a-form-in-an-existing-page-or-app) |
| "embed a Form.io form in React" | `formio-react` → `formio-react-form` | D, React mounting |
| "embed a Form.io form in Angular", "render a form in my Angular app" | `formio-angular` → `formio-angular-form` | D, Angular mounting |
| "add Form.io CRUD to my React app", "wire this project into my existing React app" | `formio-react` (existing branch) | [H](#flow-h--add-formio-to-an-application-that-already-exists) |
| "design the resources for a library system" (no app) | `formio-resource-planner` | A, planning only |
| "create a Patient resource", "export my project", "list every form" | `formio-api` + the MCP tools | [E](#flow-e--change-a-project-directly) |
| "send an email when someone submits", "add login to this form" | `formio-actions` | E, action scope |
| "set up SSO with Okta", "swap an external OIDC token", "custom JWT" | `formio-auth` | [F](#flow-f--configure-authentication) |
| any Form.io task where no `form_*` tool exists yet | `formio-mcp-setup` | [G](#flow-g--first-run-no-mcp-server-yet) |
| anything that fails mid-flow, or a framework skill reached by name | the skill that was already running | [I](#flow-i--when-a-step-fails-and-how-a-flow-rewinds) · [J](#flow-j--reaching-a-skill-directly) |

The boundary that trips people up: **"build a form to collect X" is a form; "track X" / "manage X" is an app.** The first goes to `formio-form-builder`, the second to `formio-application`. If the conversation reveals mid-flight that you actually wanted the other one, the skill re-routes and says why.

## Contracts every skill obeys

Four behaviors are identical across the library. They are why flows compose without a central controller.

### Preflight — are the tools there?

Every tool-calling skill checks whether `form_list` is callable **at the moment it reaches its first Form.io tool call** — not when the skill activates. A missing server blocks that call, not the turn: planning, interviewing, and writing local files all happen first and in full. When the tools really are absent, the only remedy offered is `formio-mcp-setup`. `formio-resource-planner` is exempt — it calls no tool at all.

### Project resolution — which project am I writing to?

There is one value to supply: the **Project URL**. The **Base URL** (the deployment hosting it) is derived from it wherever it can be. Before its first deployment-touching call, a skill calls `project_get` with `cwd` set to your working directory and branches on the `status` it gets back.

```mermaid
flowchart TD
    Start["First call that reads or writes"] --> PG["project_get(cwd)"]
    PG --> R{"Resolution order,<br/>narrowest scope first"}
    R -->|1| J["committed <b>formio.json</b><br/>walking up from cwd, stopping at .git"]
    R -->|2| M["<b>~/.formio/projects.json</b><br/>mapping for this cwd"]
    R -->|3| Env["<b>FORMIO_PROJECT_URL</b> / <b>FORMIO_BASE_URL</b><br/>environment — weakest source"]
    J --> S{"status"}
    M --> S
    Env --> S
    S -->|"<b>ok</b>"| Go["State the resolved URLs, then proceed"]
    S -->|"<b>not-configured</b>"| Ask["Relay the server's message · ask for the ONE value it names · project_set · re-run project_get"]
    S -->|"<b>base-url-unresolved</b>"| Ask2["Project is on record, deployment is not:<br/>apply the remedy the report names<br/>(project_set, or an edit to the committed formio.json)"]
    S -->|"call fails outright"| Stop["Broken record — relay the error and stop.<br/>Do <b>not</b> interview around it."]
    Ask --> PG
    Ask2 --> PG
```

One record wins whole: the project and its deployment travel as a pair, and halves are never combined across sources. That is why a `FORMIO_BASE_URL` in your environment does not supply the deployment for a project that a committed `formio.json` names.

### Authentication — how the server proves who you are

Authentication is **implicit and lazy**. No skill asks you to log in; the first authenticated tool call triggers it on a cache miss.

```mermaid
sequenceDiagram
    participant S as Skill
    participant M as @formio/mcp
    participant B as Your browser
    participant F as Form.io Enterprise Server

    S->>M: project_import / form_create / …
    alt FORMIO_API_KEY is set
        M->>F: request with x-token
    else JWT mode (default)
        M->>M: cached JWT for this Base URL?
        alt cache miss
            M->>M: start short-lived local Express server
            M->>B: open the Form.io portal login form
            B->>F: sign in
            F-->>B: JWT
            B->>M: GET /callback?token=…
            M->>M: cache the token, shut the login server down
        end
        M->>F: request with x-jwt-token
    end
    Note over M,B: No browser on this host? The login URL is printed instead,<br/>and the skill surfaces it for you to open elsewhere.
    F-->>M: result
    M-->>S: tool result
```

On a host that cannot open a browser — CI, a container, an SSH session with no display — there are two routes. `FORMIO_API_KEY` skips the browser flow entirely and is the clean answer for automation. Failing that, the flow degrades rather than dying: the server prints the portal-login URL and the skill surfaces it for you to open in a browser you do have. `FORMIO_FORCE_BROWSER=1` forces the attempt where the no-browser detection is wrong, and `FORMIO_AUTH_HOST` / `FORMIO_AUTH_PORT` make the login server reachable through a published port from inside a container. A skill also warns you before its first authenticated call that a browser may open, so the window is never a surprise.

### Approval gates

Nothing irreversible happens without a stop. The gates are deliberately placed where the cost of being wrong jumps.

| Gate | Sits before | Why there |
| --- | --- | --- |
| Planner Phase A | writing `template.md` + `template.json` | A wrong field in a ~50-line map is cheap; the same mistake propagated through 500 lines of JSON is not. |
| Offer to import | any import work at all | Importing is optional. You may want to import later yourself, or point the build at a project you already set up. |
| Import preview | `project_import` | The first write to a live project. It cites both resolved URLs, a plain-language template summary, the same-machine-name overwrite warning, and the advice to run `project_export` first as a snapshot. |
| SAVE | `form_create` / `form_update` | Same reason, one form at a time. The edit lane shows what will change before writing. |
| Each framework phase | scaffolding, config, auth surface, resource files | Without them, one "build it in React" would scaffold a workspace, write configuration, and generate a whole auth surface with no stopping point. |
| Scaffolding plan | emitting per-resource files | The resource sub-skills show what they intend to generate before generating it. |
| Data-router migration | changing an existing React app's routing | Routing is shared infrastructure the whole app depends on. It is never migrated silently. |

One exception to the "every phase gates" rule: Angular's SETUP gate is standalone-only. Arriving by handoff, the URLs were already approved at the import step, so SETUP confirms them in one line and advances rather than re-asking.

A declined gate stops that step without leaving partial state behind — but stopping the step is not always stopping the run. **Declining the import is a supported answer:** the flow continues to the framework phase with `importStatus: 'skipped'`, the generated screens 404 until an import happens, and `template.md` + `template.json` stay on disk so you can import whenever you like. Declining a framework phase does stop the chain, because every later phase builds on the files the earlier one wrote.

## Flow A — build an application

The default pipeline. You describe an app in plain language; you are never asked for Form.io or framework vocabulary you did not bring yourself.

```mermaid
sequenceDiagram
    actor U as You
    participant App as formio-application
    participant Plan as formio-resource-planner
    participant MCP as @formio/mcp
    participant FIO as Form.io Server
    participant Auth as formio-auth
    participant FW as formio-angular / formio-react
    participant Res as *-resources sub-skill

    U->>App: “build me a help desk”
    Note over App: Step 1 — INTENT<br/>build-new vs extend. No URLs asked for here.
    App->>U: plain-language restatement — confirm or correct

    Note over App,Plan: Step 2 — PLAN (no server, no project, no auth needed)
    App->>Plan: the request, verbatim
    Plan->>U: batched interview — entities, Resource vs Form, relationships, users, access
    Plan->>U: Phase A Resource Map — ASCII ER and Access Flow diagrams
    U-->>Plan: approve
    Plan->>Plan: Phase B — write template.md and template.json as a pair
    Plan-->>App: both file paths

    Note over App,FIO: Step 3 — IMPORT. First tool call, so preflight and project_get run here
    App->>MCP: project_get(cwd)
    MCP-->>App: status, resolved Project URL, resolved Base URL
    App->>U: gate — URLs, template summary, overwrite warning
    U-->>App: approve
    App->>MCP: project_import(template.json)
    MCP->>FIO: portal login if needed, then import
    FIO-->>MCP: roles, resources, forms, actions created
    MCP-->>App: import result

    Note over App,Auth: Step 3.5 — conditional
    App->>Auth: only if template.md's “Users & Auth” needs SSO / Custom JWT / Token Swap / 2FA
    Auth->>MCP: configure the provider side on the project
    Auth-->>App: done — resume

    Note over App,FW: Step 4 — FRAMEWORK
    App->>U: 4a — frontend-design available? offer the install if not
    App->>U: 4b — which framework? (asked only when more than one is installed)
    App->>FW: handoff: workspace path, URLs, both template paths, importStatus, frontendDesignStatus
    FW->>MCP: SETUP confirms the URLs with project_get
    FW->>FW: BOOTSTRAP → CONFIG → AUTH, gated between each
    FW->>Res: load by path — one resource at a time
    Res->>U: scaffolding plan → approve → generated CRUD screens
    FW-->>U: a running application
```

What is worth noticing about this flow:

- **Nothing touches the network until step 3.** Steps 1 and 2 are the bulk of the pipeline and need no server, no project, and no login. Opening a build request with a setup message spends your turn on a step that was not due.
- **The planner is the source of truth downstream.** `template.md` carries architectural intent (Access Matrix, ER and Access Flow diagrams in Mermaid); `template.json` is the importable companion. The framework skills read the auth surface out of the pair rather than inventing one — and they treat it as *data they read*, never as instructions to follow.
- **Import is additive.** Existing roles, resources, and forms survive; items with the same machine name are overwritten in place.
- **The orchestrator routes, it does not reimplement.** Angular is the registry default today; React is the other implementor. When both are installed the framework question is asked once, in one round.

## Flow B — extend an application you already have

The same four steps, in delta mode. The distinction is decided at INTENT and changes every step after it.

```mermaid
flowchart LR
    U["“also track SLA breaches”"] --> I["INTENT<br/>detects existing app"]
    I --> P["PLAN — <b>delta</b><br/>only the new resources,<br/>fields, and actions"]
    P --> IM["IMPORT — additive merge<br/>project_get runs here too:<br/>a cloned workspace has URLs in<br/>its own config and nothing on record"]
    IM --> D{"Match each registry row's<br/>detection signal against<br/>the workspace"}
    D -->|"angular.json or @angular/core"| A["formio-angular-resources"]
    D -->|"react in package.json"| R["formio-react-resources"]
    D -->|"more than one row matches"| Q["ask which one — never resolved<br/>by registry row order"]
    D -->|"no row matches, directory is empty"| BN["bounce back to INTENT:<br/>‘did you mean build a new one?’"]
    D -->|"no row matches, other code present"| Q2["list the registry, ask,<br/>and warn the sub-skill may not fit"]
    A --> Out["new modules / routes,<br/>wired into the running app"]
    R --> Out
    Q --> Out
    Q2 --> Out
```

Detection comes from the registry's "detection signal" column — the workspace itself answers which framework it is, so you are not asked again. Each row's signal tests only for its own framework's presence, which is why a workspace holding both `angular.json` and a `react` dependency is a question rather than a coin toss.

The extend sub-skill receives the delta resource names plus your feature request verbatim, so it can translate your domain words into framework primitives. It does **not** receive the URLs: it reads them from the workspace's own generated config (`src/app/config.ts` for Angular, `src/config.ts` for React), because that file is what the running app actually uses.

**This flow assumes an app this library built.** Adding Form.io to a React application that already exists and has no Form.io wiring is a different flow — see [Flow H](#flow-h--add-formio-to-an-application-that-already-exists).

## Flow C — build a form or wizard

A single form is not an app: no data model, no CRUD, no framework scaffolding.

```mermaid
sequenceDiagram
    actor U as You
    participant FB as formio-form-builder
    participant Sch as formio-schema
    participant Act as formio-actions
    participant MCP as @formio/mcp
    participant Emb as formio-form / formio-react-form / formio-angular-form

    U->>FB: “build a college application wizard”
    FB->>U: Step 1 INTENT (batched) — webform, wizard, or PDF form? embed afterward?
    FB->>Sch: Step 2 SCHEMA — author the full definition for that type
    Sch-->>FB: form JSON (display: form | wizard | pdf)
    FB->>U: Step 3 SAVE — approval gate
    U-->>FB: approve
    FB->>MCP: form_create
    MCP-->>FB: saved path and full form URL
    opt the form carries server-side behavior
        FB->>Act: attach Login / Role Assignment / Email / Webhook to the saved form
        Act->>MCP: action_create
    end
    opt you said yes to embedding
        FB->>Emb: Step 4 EMBED — hand off the form URL
    end
```

Two lanes branch off the four steps:

- **Edit lane.** "Add a phone field to my registration form" skips the type interview: `form_get` (or `form_list` to resolve a loosely-named form) → `formio-schema` authors the change against the fetched JSON → `form_update` behind the same gate.
- **Behavior lane.** "A contact form that emails me on submit" stays here for the form itself, then `formio-actions` attaches the behavior. It does **not** route to `formio-auth` — that skill owns auth architecture, not per-form actions.

## Flow D — embed a form in an existing page or app

`formio-form` is the framework-agnostic entry point, and it splits along one seam: **mounting** is per-framework, **definition behavior** is not.

```mermaid
flowchart TD
    U["“embed this form in my app”"] --> Q{"What kind of question?"}
    Q -->|"a conditional, a calculated value,<br/>a validation rule, a cascading select,<br/>wizard page logic"| Def["<b>formio-form answers it</b><br/>identical in every framework"]
    Q -->|"mounting code"| H{"Inspect the host"}
    H -->|"package.json lists react"| RJ["hand off to formio-react's embed branch<br/>→ formio-react-form · the Form component"]
    H -->|"package.json lists @angular/core"| AN["hand off to formio-angular's embed branch<br/>→ formio-angular-form · the &lt;formio&gt; component"]
    H -->|"plain page / undetectable"| VJ["Formio.createForm against a DOM element"]
    U --> E{"Does the form exist yet?"}
    E -->|"form_get misses"| FB["route to formio-form-builder first,<br/>then resume embedding with the saved URL"]
```

This flow is a check, not an interview — when the host is undetectable it proceeds with `@formio/js` rather than asking. It is also the flow with a security stance attached: a form definition is executable code (`calculateValue`, `validate.custom`, `logic`, HTML bodies, select templates are all evaluated in your page's JavaScript context), so only definitions from a project you control are ever rendered.

## Flow E — change a project directly

Not every prompt is a build. "List every form", "create a Patient resource", "export the project", "add an email action to this form" are single operations against the deployment.

```mermaid
flowchart LR
    U["a direct operation"] --> S{"Which reference owns it?"}
    S -->|"endpoint / scope question"| API["formio-api<br/>→ one references/ file by scope"]
    S -->|"JSON document shape"| SCH["formio-schema"]
    S -->|"per-form behavior"| ACT["formio-actions"]
    S -->|"@formio/js call"| SDK["formio-sdk"]
    API --> T["<b>MCP Tool Preference</b><br/>use the first-party tool<br/>whenever one covers the operation"]
    SCH --> T
    ACT --> T
    SDK --> T
    T --> M["form_* · role_* · action_* · project_*"]
    M --> F["Form.io Enterprise Server"]
```

Every reference document carries an **MCP Tool Preference** section for this reason: the endpoint documentation exists so the agent can *reason* about the API and so your generated application can call it at runtime, but the build-time write goes through the tool. The tools enforce guardrails that raw HTTP skips.

You can also skip the skills entirely and prompt the tools — see [Using the MCP server without the skills](./README.md#using-the-mcp-server-without-the-skills). You then give up the conventions the skill library encodes, not the capability.

## Flow F — configure authentication

The planner ↔ auth boundary is explicit, and it is the one handoff worth understanding in detail, because both skills touch "login".

```mermaid
flowchart TB
    subgraph Planner["formio-resource-planner owns the MODEL"]
        P1["roles"]
        P2["the user Resource"]
        P3["login + registration forms"]
        P4["group joins"]
        P5["canonical template.json shapes:<br/>Login Action · Role Assignment · Group Assignment<br/>access[] · submissionAccess[] · field-based access"]
    end
    subgraph AuthSkill["formio-auth owns the CONFIGURATION on top"]
        A1["SSO — OIDC / OAuth, SAML, LDAP<br/>+ provider role mapping"]
        A2["Token Swap from an external OIDC token"]
        A3["Custom JWT (Enterprise / on-prem, JWT_SECRET)"]
        A4["email-token (passwordless)"]
        A5["JWT + session mechanics — x-jwt-token, jti, logout, 2FA, reCAPTCHA"]
        A6["RBAC tuning beyond the default roles"]
    end
    Map["approved Resource Map<br/>‘Users &amp; Auth’ section"] --> Q{"anything beyond<br/>resource-backed login +<br/>Role Assignment + Group Assignment?"}
    Q -->|"no"| Done["skip silently — the template<br/>already has everything"]
    Q -->|"yes"| AuthSkill
    Planner --> Map
    AuthSkill --> FW["framework skill still wires<br/>the front-end login screen"]
```

Action JSON shapes are not duplicated across the two skills: `formio-auth` references the planner's `references/template-json.md` by path.

## Flow G — first run, no MCP server yet

Installing skills-only (`npx skills add formio/ai`) gives the agent the knowledge with no tools attached. Every skill's preflight detects that and hands to one place.

```mermaid
sequenceDiagram
    actor U as You
    participant Sk as any Form.io skill
    participant Set as formio-mcp-setup
    participant MCP as @formio/mcp

    Sk->>Sk: reach the first tool call — is form_list callable?
    Sk->>Set: no → load formio-mcp-setup (the only remedy offered)
    Set->>Set: confirm the server really is missing (or is too old)
    Set->>U: preview the configuration for THIS client<br/>(.mcp.json · .cursor/mcp.json · .vscode/mcp.json · Codex TOML)
    U-->>Set: approve
    Set->>Set: write it, merging with what is already there
    Set->>MCP: ask which project this directory resolves to
    MCP-->>Set: report — ok / not-configured / base-url-unresolved
    Set->>U: ask for whichever single URL the report names
    Set->>MCP: project_set(projectUrl, cwd)
    Set->>U: reload the client, then return to what you asked for
```

`formio-mcp-setup` is the only skill that shells out to the CLI (`npx @formio/mcp project get|set`) — it runs before any tool exists to call. Every other skill uses the `project_get` and `project_set` **tools** over the connection the server already has.

## Flow H — add Form.io to an application that already exists

Not every existing app was built by this library. "Wire this Form.io project into my React app" is an **integration** job, not a delta build: there is no workspace to scaffold, and the decisions are about what is already there. `formio-react`'s existing-application branch owns it, and it inspects before it writes.

```mermaid
flowchart TD
    U["“add Form.io CRUD to my React app”"] --> I["<b>1. Inspect and report</b> — before touching a file:<br/>router style · @formio/react and @formio/js versions ·<br/>BOTH renderer stylesheets · FormioProvider and its project URL ·<br/>existing auth surface and current-user source · design conventions"]
    I --> G{"<b>2. Data-router gate</b><br/>createBrowserRouter, or<br/>&lt;Routes&gt; alone?"}
    G -->|"&lt;Routes&gt; alone"| Ask["Explain the constraint. Offer, in one round:<br/>convert routing to createBrowserRouter, or stop.<br/><b>Never migrated silently.</b>"]
    Ask -->|"declined"| Stop["Stop and say what is blocked"]
    Ask -->|"approved"| B
    G -->|"data router"| B["<b>3. Backfill only what is missing</b><br/>no provider → CONFIG.md · no auth surface → AUTH.md<br/>already present → left alone"]
    B --> H["<b>4. Hand off</b> to formio-react-resources<br/>with branch: 'existing' and the inspection findings"]
    H --> Gate["Approval gate: what was found,<br/>what will be backfilled,<br/>what will be left alone"]
    Gate --> Out["generated routes that integrate with<br/>the app's own auth, layout, and design language"]
```

Three things make this branch different from [Flow B](#flow-b--extend-an-application-you-already-have):

- **`BOOTSTRAP.md` never runs.** Nothing is scaffolded; no workspace is created.
- **The data-router requirement is a hard gate, not a preference.** The generated resource code is built on loaders, actions, `errorElement`, and post-action revalidation — that is what lets React skip the service, registry, alert bus, and refresh emitter that `@formio/angular` needs. An app routing through `<BrowserRouter>` with `<Routes>` alone cannot host it.
- **A satisfied prerequisite is integrated with, not replaced.** An app with its own login gets no second auth surface generated — but the generated routes still have to protect themselves through that mechanism, so its current-user source travels in the handoff. An app with an established design language gets composition within it.

The Angular counterpart of the same idea is narrower: `formio-angular` invoked directly against a partially-wired workspace skips the phases whose outputs already exist and runs only the missing ones — see [Flow J](#flow-j--reaching-a-skill-directly).

## Flow I — when a step fails, and how a flow rewinds

No flow is a straight line. Every step that can fail has a named branch, and the rule is the same throughout: surface it short, offer retry / skip / bail, never leave a half-done state unexplained.

```mermaid
flowchart TD
    F{"What failed?"}
    F -->|"no form_* tools"| T["load formio-mcp-setup — the only remedy offered.<br/>Never worked around with raw HTTP or a throwaway script."]
    F -->|"project_get: not-configured"| P1["relay the server's message, ask for the one value<br/>it names, project_set, re-run project_get"]
    F -->|"project_get: base-url-unresolved"| P2["apply the remedy the report names —<br/>project_set, or an edit to the committed formio.json"]
    F -->|"project_get throws"| P3["broken record (unparseable formio.json, bad URL).<br/>Relay and stop — do not interview around it."]
    F -->|"login fails"| A1["report it; no browser on this host →<br/>surface the printed login URL, or use FORMIO_API_KEY"]
    F -->|"project not found"| A2["the resolved Project URL is wrong.<br/>Re-resolve before retrying the write."]
    F -->|"import validation fails"| A3["report what the server rejected;<br/>fix the template and re-offer the import"]
    F -->|"user declines the import"| A4["importStatus: 'skipped' — continue to the framework phase.<br/>Screens 404 until an import happens."]
    F -->|"delta name collides"| A5["planner renames the delta resource and surfaces<br/>the rename BEFORE the import, so nothing is overwritten"]
```

Flows also **rewind** rather than patch. A framework skill that finds the ground moved under it resets to the phase that owns the changed thing, says which phase and why, and re-runs the gates from there:

| What changed | Resets to |
| --- | --- |
| The project was re-pointed at a different Form.io project | SETUP — then CONFIG and AUTH re-run with the corrected URLs |
| Dependencies reinstalled, or the router swapped | BOOTSTRAP |
| `config.ts` was hand-edited | CONFIG |
| An embed request turns out to want list / create / edit screens | re-dispatch to the CRUD branch, saying why the branch changed |
| A stated branch contradicts the workspace (a "new app" in a directory that already holds one) | surface it and confirm before proceeding — scaffolding over an existing app is not recoverable |

Patching a generated file in place from inside a later phase is specifically avoided: restarting the affected phase puts the approval gate back in front of you.

## Flow J — reaching a skill directly

Naming a framework or a sub-skill skips the orchestrator, and the skills are built to be entered that way without losing their guardrails.

| How you arrive | What runs |
| --- | --- |
| "build it in Angular" / "use `@formio/react`", with an approved `template.md` + `template.json` in scope | The framework skill's own phase chain, from SETUP. It still confirms the project with `project_get` rather than trusting anything handed in. |
| The same, against a partially-wired workspace | Pre-flight inspects, then only the phases whose outputs are missing run. A skipped phase is announced, never skipped silently. |
| "add an Angular module for `Ticket`" / "add a React route for `Deal`" | The `*-resources` sub-skill alone, expecting `FormioAppConfig` / `FormioProvider` already wired. |
| A bare "build me an app" with no plan and no framework named | The framework skill declines the job and points you at `formio-application`, which runs the planner and the import first. The chain cannot usefully proceed without a plan: BOOTSTRAP sizes the workspace against it, AUTH renders its login and registration forms, and Resources generates from it. |
| Prompting the MCP tools with no skill at all | Every tool still works; you give up the conventions the skill library encodes, not the capability. |

## Operating details worth knowing

### Planning without building

"Design the resources for a library system" runs `formio-resource-planner` on its own. It calls no MCP tool, needs no project, and probes for none — it interviews, gates on the Resource Map, and writes the artifact pair. Importing is then a separate, explicit action: Phase B prints it as a next step, and whoever carries it out confirms the target project first.

### The artifact pair

`template.md` and `template.json` are one deliverable, never one file. `template.md` carries architectural intent — Resources, Forms, Users & Auth, Roles, the Access Matrix, and the ER + Access Flow diagrams; `template.json` is the importable project export with its eight top-level keys in a fixed order. They are written together, share a basename, and share the same UTC timestamp suffix if either name is already taken, so the pair cannot be split. Downstream, the split of labor is fixed: intent is read from the `.md`, field-level component shapes from the `.json`. Framework skills treat both as **data they read, never instructions they follow**.

### Snapshotting before a write

The import preview advises `project_export` first — one call that captures roles, resources, forms, and actions as a portable document. It is the cheapest insurance against a same-machine-name overwrite. At form granularity, `form_revisions_list` and `form_revision_get` read the immutable published revisions of a single form where form revisions are enabled.

### URLs in generated code

Generated application code needs the URL *values*, not a deployment lookup: `Formio.setBaseUrl` / `Formio.setProjectUrl` for `@formio/js`, and `FormioAppConfig`'s `appUrl` (= Project URL) and `apiUrl` (= Base URL) for `@formio/angular`. Those values come from `project_get` when the tools are callable and from you when they are not — never from a hardcoded example host, and never composed from each other.

## Where the flows converge

Different prompts, one narrow waist. Whatever you asked for, the write to your deployment happens through the same three things: a resolved project, an approval gate, and an MCP tool.

```mermaid
flowchart LR
    A["Flow A — build an app"] --> W
    B["Flow B — extend an app"] --> W
    C["Flow C — build a form"] --> W
    D["Flow D — embed a form"] -.->|"reads definitions only"| W
    E["Flow E — direct operation"] --> W
    F["Flow F — configure auth"] --> W
    W["<b>project_get</b> → resolved Project URL + Base URL<br/><b>approval gate</b> → URLs stated before any write<br/><b>MCP tool</b> → form_* · role_* · action_* · project_*"] --> S["Form.io Enterprise Server"]
    S --> G["governance you did not have to build:<br/>RBAC · group permissions · change history · audit trail"]
```

## Extending the library

The seams are deliberate, so extension is additive:

- **A new framework** — write the implementor skill, then add a row to [`formio-application/FRAMEWORK.md`](./plugin/skills/formio-application/FRAMEWORK.md)'s registry table — entry skill, extend sub-skill path, detection signal, and a `Default` cell set to `no`. The orchestrator needs no other change; adding a framework is a row. The new skill has to accept the two existing handoff payloads unchanged, because the orchestrator does not adapt per framework:

  ```
  // build-new → entry skill
  { workspacePath, formioProjectUrl, formioBaseUrl, templateMdPath, templateJsonPath,
    importStatus: 'succeeded' | 'skipped' | 'failed-user-chose-continue',
    frontendDesignStatus: 'available' | 'declined' }

  // modify-existing → extend sub-skill (no URLs: read them from the workspace's own config)
  { workspacePath, userRequest, templateMdPath, templateJsonPath,
    newResourceNames, frontendDesignStatus }
  ```

  `formio-react` extends the second payload with `branch: 'greenfield' | 'existing'` and, on the existing branch, its inspection findings — an addition its own sub-skill consumes, not something the orchestrator supplies.
- **A new capability area** — a new reference skill with a three-clause description whose "not for" clause disambiguates it from its neighbors, plus an `## MCP Tool Preference` section.
- **A new MCP tool** — register it through `registerAllTools` in `packages/mcp-server/`, then reference it from the skills that should prefer it over raw HTTP.

Authoring conventions, the terminology rules that are enforced by tests, and the eval harnesses used to measure a skill change are in [CONTRIBUTING.md](./CONTRIBUTING.md) and [CLAUDE.md](./CLAUDE.md).
