# The Form.io Agentic Coding Toolset

`@formio/ai` is what brings Form.io into your agentic coding environment. It provides a series of tools that enable any developer to perform a number of complex actions against the Form.io Enterprise Server using their favorite Agentic Coding toolsets (starting with Claude Code). This turns the Form.io Enterprise Server into a **Composable Backend for Agentically Coded Applications**.

## Getting Started
Getting started is easy.  First install Claude Code as follows:

 1. [Install Claude Code](https://github.com/anthropics/claude-code#get-started)
 2. Run `claude` in your Terminal.
 3. Run the following command within **Claude Code**.

```bash
/plugin marketplace add https://github.com/formio/ai.git
/plugin install formio-ai@formio
```

Claude Code prompts for the `Project URL` and the `Base URL` on install. These are described as follows:

 - **Project URL**: This is the endpoint for your 'project'. If you are using our SaaS environment (https://portal.form.io), then your project URL will be a sub-domain, such https://myproject.form.io.  However, for most use cases, when Form.io is deployed in your own enviornment, then the project url is typically a 'sub-directory' structure like https://forms.mysite.com/myproject.
 - **Base URL**: This is the endpoint for the deployment. If you are using the SaaS environment (https://portal.form.io), then this is always going to be https://api.form.io. However, for most use cases, when Form.io is deployed in your own environment, then this is the URL of the deployment like https://forms.mysite.com. 

 ## What you get

- **Claude Code plugin: `@formio/ai`.** One-command install. Bundles the MCP server and skill library, registers them with Claude Code.
- **MCP server: `@formio/mcp`.** Form.io operations (`form_*`, `role_*`, `action_*`, `project_*`) as MCP tools. Works with any MCP-aware client: Claude Code, Claude Desktop, VS Copilot, and whatever comes next.
- **Skills library:** Nine activatable skills covering app orchestration, resource planning, Form building, JSON-schema authoring, action configuration, authentication & authorization, the `@formio/js` SDK surface, and the full Form.io REST surface.

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
| `form-builder` *(coming soon)* | Orchestrates any "form building" prompt — complex forms, multi-page conditional wizards, and schema-compliant form definitions (e.g. FHIR) — from intent through creation in your deployment. |

### All skills

| Skill | What it does |
| --- | --- |
| `formio-application` | Orchestration entry point for building or extending an application on the Form.io platform (see above). |
| `formio-resource-planner` | Plans the resource structure, field configuration, and access/permission model from high-level requirements, then emits a ready-to-import `template.json`. |
| `formio-schema` | Reference for Form.io JSON schema — the document shapes for projects, forms/resources, and submissions. Used when constructing, editing, or interpreting any Form.io JSON. |
| `formio-actions` | Reference for configuring Form.io actions — the server-side behavior layer for email notifications, authentication, webhooks, role assignment, and form-to-form saves. |
| `formio-auth` | Authentication and authorization specialist — login/registration, RBAC, SSO (OIDC/SAML/LDAP), Token Swap, Custom JWT, passwordless email tokens, and JWT/session mechanics. |
| `formio-api` | Comprehensive Form.io REST API reference — every endpoint across platform admin, project admin, runtime, and PDF scopes. |
| `formio-sdk` | Reference for the `@formio/js` JavaScript SDK and `@formio/js/utils` Utilities — static and instance methods, VanillaJS rendering, plugins, and helpers. |
| `formio-angular` | Angular framework implementor. Turns an approved `template.json` plus a target project into a working Angular app using `@formio/angular`. Delegated to by `formio-application`. |

## Examples and Use Cases
Once this is installed, you are ready to do the following:

 - [Build an Enterprise 'greenfield' form-based workflow application from a single prompt](#build-an-enterprise-greenfield-form-based-workdlow-application-from-a-single-prompt)
 - [Introduce new Form.io features within existing applications](#introduce-new-formio-features-within-existing-applications)
 - [Prompt your agent to build conditional forms and wizards with complex validations](#prompt-your-agent-to-build-conditional-forms-and-wizards-with-complex-validations)
 - [Build forms using descriptions of data models and integration interfaces](#build-forms-using-descriptions-of-data-models-and-integration-interfaces)
 - [Create new Resource / Model structures using the REST API's within your Form.io project via prompt](#create-new-resource--model-structures-using-the-rest-apis-within-your-formio-project-via-prompt)
 - [Embed a simple form.io form within a bespoke application](#embed-a-simple-formio-form-within-a-bespoke-application)

## Build an Enterprise 'greenfield' form-based workdlow application from a single prompt.
With this plugin, you can create a brand-new 'greenfield' form-based [application](#this-library-currently-only-supports-angular-other-frameworks-are-coming-soon) using the `formio-application` skill. To get started, simply create a new folder within your computer and then start claude code within that folder as follows:

```bash
mkdir form-app
cd form-app
claude
```

From this prompt, you can then perform the following to create a new application, like the following:

```bash
/formio-application I would like to create a story board application for my Sales Team to keep track of the sales status of leads. This application should allow each user create their own story board, and with those story boards create custom swim lanes, and then within those swim lanes create new "Leads". These Leads can then be dragged-and-dropped between the swim lanes to keep track of the status of the lead. Each user should then be able to create Teams, and then add new users to that team, and then add that team to the story board where that user would then have read/write access to the story board they have been added to.
```

The plugin will then use the `formio-application` skill as the orchestration skill to create this new application using the Form.io platform as the composable backend for the full application logic.

## Introduce new Form.io features within existing applications.
In addition to being able to create new 'greenfield' [applications](#this-library-currently-only-supports-angular-other-frameworks-are-coming-soon), it is also possible to use this plugin to introduce new complex form-based workflow features within existing [applications](#this-library-currently-only-supports-angular-other-frameworks-are-coming-soon). This can also be achieved using the `formio-application` skill as follows.

```bash
/formio-application Within this EMR portal application, I would like to add the ability for each Clinic to create their own Patient Onboarding forms within the Form.io Platform portal, and then embed those patient onboarding forms within their own clinic websites. When a potential patient fills out the patient onboarding form, I would like to introduce a new section within this EMR application called "Patient Onboarding" that displays a table view of all the new patient applications (forms). The clinic administrator should be able to click on each patient onboarding submission, call that patient, and through their own phone call convert that into a scheduled patient appointment within the EMR portal."
```

From this prompt, the `formio-application` should understand that this is a new 'form-based' feature that is being added within an exsting [application](#this-library-currently-only-supports-angular-other-frameworks-are-coming-soon), and then initiate the development process for introducing this new feature using the Form.io platform as the underlying platform for such feature.

## Prompt your agent to build conditional forms and wizards with complex validations
Using the `form-builder` skill, you can easily prompt your agent to create complex forms, as well as multi-page conditional wizards. Not only will the agent create the JSON for this form, but it will also automatically create the form within any stage of your deployment.

```bash
/form-builder I would like to create a new multi-page wizard form that is responsible for collecting college applications, which we will embed within our content management system. This wizard should have multiple sections where it first collects the applicants personal information, followed by scholastic achievements, followed by extra curricular activities. It should follow up with them selecting their desired program, and based on what they select, the following wizard pages should contain the specific onboarding questions for that program.
```

## Build forms using descriptions of data models and integration interfaces
The `form-builder` skill is also capable of enabling an Agent to produce form definitions that are capable of producing submission data structures that adhere to well defined schemas. This is very useful when a form is needed to produce a data object that meets a very specific structure, such as when that data is to be used against an already defined integration or standard. For example, you can use this skill to produce forms that are [FHIR compliant](https://hl7.org/fhir).

```bash
/form-builder I am building a new patient onboarding application that must adhere to the FHIR Patient resource definitions described at https://build.fhir.org/patient.html. Can you create a form that will onboard a new patient and the data that it produces generate FHIR compliant data for Patients?
```

## Create new Resource / Model structures using the REST API's within your Form.io project via prompt
The `formio-api` skill is fully aware how to interface with your Form.io Enterprise Deployment via REST API's. This provides the ability to create any Resource, Form, Submission, or any other entity using the REST API's of that deployment.

```bash
/formio-api I would like to create a new Patient resource within my Form.io deployment.
```

## Embed a simple form.io form within a bespoke application.
In addition to building new 'greenfield' applications, the `formio-application` skill is also capable of embedding a form or wizard within any HTML-based application.

```bash
/formio-application I would like to create and embed a multi-page student onbaording wizard within my application.
```

#### ***This library currently only supports Angular application framework for new 'greenfield' applications. Other frameworks are coming soon***

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

## License

[MIT](./LICENSE)
