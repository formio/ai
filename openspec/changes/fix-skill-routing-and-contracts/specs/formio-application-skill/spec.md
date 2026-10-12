## MODIFIED Requirements

### Requirement: formio-application description claims plain-language triggers and names the framework skills

The `formio-application` `SKILL.md` frontmatter `description` SHALL claim plain-language build-an-app and extend-an-app triggers WITHOUT requiring the user to know any UI framework or Form.io terminology, and SHALL fit the library's description budget (see the `skill-description-budget` capability). Example triggers the description MUST claim include:

- Build-new: "build me an app", "create a CRM", bare domain archetypes ("task manager", "help desk").
- Extend-existing: "also track X", "add a way to see Y".

The description MUST state that this skill is the library's default build-an-app entry point, and MUST claim a build that needs planning whether or not the request names a UI framework ("build me a CRM in React"); the named framework is carried to Step 4, which then asks no framework question. The framework-selection behavior (auto-pick with one installed framework, ask with several) is a body concern and is NOT required in the description. The description and the body's routing table SHALL name only skills a client registers — `formio-angular` and `formio-react`, never the nested sub-skills they load by path.

The description MUST include `Not for:` clauses pointing at:

- `formio-angular` for Angular work on a project that is already planned — an Angular front-end for an imported project, or an Angular extension of an existing workspace.
- `formio-react` for the same React work.
- `formio-resource-planner` for data-model-only planning requests without building an app.
- `formio-api` for endpoint lookups.
- `formio-form` for embedding or rendering a single form in an existing page or application (no app build or orchestration).
- `formio-form-builder` for standalone single-form creation requests — one form to collect responses, not a data model, resources, or an app around the data.

#### Scenario: formio-application claims generic build-new triggers

- **WHEN** the user says "build me a tool to track maintenance requests" (no framework or Form.io terminology)
- **THEN** the `formio-application` skill activates
- **AND** neither `formio-angular` nor `formio-react` activates

#### Scenario: formio-application claims generic extend triggers

- **WHEN** the user says "also let customers leave reviews on products" in a workspace that already has a framework app wired
- **THEN** the `formio-application` skill activates
- **AND** no framework extend sub-skill activates directly

#### Scenario: A framework-named build with no plan routes through formio-application

- **WHEN** the user says "build me a CRM in React" and no approved planner pair exists
- **THEN** `formio-application` runs Intent, Plan, and Import
- **AND** Step 4 routes to `formio-react` without asking which framework

#### Scenario: Framework-explicit work on a planned project routes to the framework skill

- **WHEN** the user says "build it in Angular" for a project whose plan is approved and imported, or "add a React route for X" in an existing React workspace
- **THEN** the matching framework skill activates directly
- **AND** `formio-application` does not activate

#### Scenario: The description names no nested sub-skill

- **WHEN** the `formio-application` frontmatter `description` is inspected
- **THEN** it does not contain `formio-angular-resources`, `formio-react-resources`, `formio-angular-form`, or `formio-react-form`

#### Scenario: Embed-a-form phrasing does NOT route through formio-application

- **WHEN** the user says "embed this form in my existing site" or "render this form on my page" (no app build requested)
- **THEN** `formio-form` activates
- **AND** `formio-application` does not activate
- **AND** the `formio-application` description's `Not for:` clauses contain the literal substring `formio-form`

#### Scenario: Standalone form-creation phrasing does NOT route through formio-application

- **WHEN** the user says "build me a form to collect customer feedback" or "create a survey" (a standalone form, not an app or data model)
- **THEN** `formio-form-builder` activates
- **AND** `formio-application` does not activate
- **AND** the `formio-application` description's `Not for:` clauses name the backtick-delimited `` `formio-form-builder` ``

#### Scenario: Description names no MCP-configuration step

- **WHEN** the `formio-application` `SKILL.md` frontmatter is inspected
- **THEN** its `description` contains no `.mcp.json` reference and no restart-pause phrasing
- **AND** this matches the shipped skill body, which states there is no restart boundary on either branch

#### Scenario: Description fits the budget

- **WHEN** the `formio-application` `SKILL.md` frontmatter is inspected
- **THEN** its `description`, whitespace-normalized, is ≤ 1,024 characters

### Requirement: FRAMEWORK.md defines a registry with single- and multi-framework routing

`FRAMEWORK.md` SHALL contain a table of installed UI-framework skills in the following shape:

| Framework | Entry skill      | Extend sub-skill           | Detection signal                                                      | Default |
| --------- | ---------------- | -------------------------- | --------------------------------------------------------------------- | ------- |
| Angular   | `formio-angular` | `formio-angular-resources` | `angular.json` in workspace root OR `@angular/core` in `package.json` | yes     |
| React     | `formio-react`   | `formio-react-resources`   | `react` in `package.json` dependencies                                | no      |

Exactly one row SHALL carry `Default: yes`. It is Angular, because its implementor configures the library-provided `@formio/angular` `FormioResource` module while React's generates its runtime into the application.

`FRAMEWORK.md` body MUST document:

- That routing is driven by this table.
- That when the table has exactly one active row, Step 4 routes silently (no user question).
- That when the table has multiple active rows, Step 4 asks the user to pick, in one question round, using the client's structured question mechanism — which it MAY name as a parenthetical example only. With both Angular and React registered, this is now the live build-new path, and each option MUST be described in terms of what it generates ("Generate an Angular workspace using `@formio/angular`", "Generate a Vite + React Router workspace using `@formio/react`").
- That the `Default: yes` row is presented FIRST in that question round and labelled as the default, and that the question round MUST be a real choice rather than a confirmation of a decision already made — the prompt does not name a framework as chosen, and no framework work begins before the answer arrives.
- That the default resolves the question only when the user declines to choose — an explicit "no preference", "you pick", "whatever you recommend", a non-answer, or a dismissed question round. It is NOT a licence to skip asking. Step 4 SHALL state which framework it is proceeding with whenever the default resolves the choice, so a user who did not mean to defer can correct it.
- That modify-existing workspaces are detected via the "Detection signal" column, and if exactly one signal matches the routing is direct.
- That a workspace matching more than one signal — for example one carrying both `angular.json` and a `react` dependency — is a multi-match, and Step 4 asks the user to pick in one question round rather than guessing from signal order.
- That each row's Detection signal SHALL be written independently of every other row's, testing only for its own framework's presence. A signal that excludes another framework (`react` AND no `angular.json`) collapses the multi-match case into a single match and makes the tie-break branch unreachable, which puts the table's own routing rule in conflict with itself.
- The Step 4a `frontend-design` pre-check: detect the skill by name, accepting more than one registered form rather than a single client's prefix; when it is missing, offer the install in one question round, naming where the skill ships and deferring the mechanism to the running client's own skill-install route; on decline, apply the Bootstrap 5 brief from `formio-angular/BOOTSTRAP.md` Step 7d inline, disclose that on each UI approval gate, and hand `frontendDesignStatus` downstream. The document MUST NOT instruct a client-specific plugin-install command, plugin browser, or reload command.
- Nothing addressed to a contributor. `FRAMEWORK.md` ships to every installation, where a repository path or a test command means nothing; the checklist for adding a framework lives in `CONTRIBUTING.md`, outside `plugin/`, with a worked example that names a framework not already a row (Vue).

#### Scenario: Multi-framework registry asks the user

- **WHEN** intent = build-new and the table contains both the Angular and React rows
- **THEN** Step 4 presents both frameworks in one question round before routing
- **AND** the instruction names no client tool as the mechanism

#### Scenario: React workspace detection routes directly

- **WHEN** intent = modify-existing and the workspace has `react` in `package.json` and no Angular signal
- **THEN** exactly one row matches, so Step 4 loads `../formio-react/formio-react-resources/SKILL.md` by path without asking the user

#### Scenario: Existing Angular workspace still routes directly

- **WHEN** intent = modify-existing and the workspace contains `angular.json`
- **THEN** Step 4 routes to `formio-angular-resources` without asking the user

#### Scenario: Workspace matching both signals asks the user

- **WHEN** intent = modify-existing and the workspace contains both `angular.json` and a `react` dependency
- **THEN** Step 4 asks the user which framework to extend, in one question round

#### Scenario: FRAMEWORK.md carries no contributor instructions

- **WHEN** `FRAMEWORK.md` is inspected
- **THEN** it contains no "How to add a new framework" section, no `npm test`, and no `formio-vue` path
- **AND** the file contains no React detection signal other than the one in the registry table
- **AND** `CONTRIBUTING.md` carries the checklist, with a Vue worked example

#### Scenario: Pre-check degrades when frontend-design is declined

- **WHEN** Step 4a finds `frontend-design` unavailable and the user proceeds without it
- **THEN** `FRAMEWORK.md` instructs applying the Bootstrap 5 brief inline
- **AND** it instructs disclosing that on each UI approval gate
- **AND** it names where `frontend-design` ships without prescribing a client-specific install command
- **AND** it contains no `claude plugin install`, `claude-plugins-official`, or `/reload-plugins`

### Requirement: formio-application resolves its project configuration at its first deployment-touching step

The `formio-application` `SKILL.md` preflight SHALL gate the first step that reads from or writes to a deployment — Step 3 (Import) — rather than the turn. Steps 1 (Intent) and 2 (Plan) touch no deployment, so the preflight SHALL NOT block them, and the skill SHALL say where its first tool call is. When Step 3 is reached the preflight SHALL resolve the target project in this order:

1. Confirm `form_list` is callable, under whatever name this client exposes it. When it is not, route to `formio-mcp-setup` and stop — there is no server to ask for configuration, so the probe below cannot run. When `project_get` specifically is not callable, the connected server predates that tool: route to `formio-mcp-setup` as well, which moves the pin forward.
2. Call the `project_get` MCP tool with `cwd` set to the user's current working directory, and branch on the `status` it returns. On `ok`, confirm the resolved Project URL and Base URL in one line and continue. On `not-configured`, ask for the single value the message names, record it with the `project_set` tool, and call again. On `base-url-unresolved`, ask for the Base URL alone and record it with `project_set` passing `baseUrl` and leaving `projectUrl` out — the project is already on record and SHALL NOT be re-asked.
3. Use the resolved values for the Import step only. No handoff carries them: the framework skill and `formio-auth` each call `project_get` for the workspace directory the handoff names, so they read the same record the import used rather than a copy of it. The values are in the skill's working context, not environment variables: nothing reads them from the environment and nothing writes them there.

The skill SHALL NOT shell out to `npx -y @formio/mcp@<pinned> project get` for this. The connected server answers it over the open transport with the same resolver every other tool uses, so a subprocess adds an npm download and the chance of one server version reporting a resolution a different connected version will not honor.

A `project_get` call that fails outright instead of returning a status SHALL be relayed rather than interviewed around: it could not answer at all, so a `project_set` would fail for the same unreported reason.

This SHALL run on BOTH branches. On modify-existing the workspace's own `FormioAppConfig` is not the server's mapping, and `project_import` resolves against the mapping — so a cloned workspace with URLs in its source and nothing on record is resolved here rather than failing at import.

The skill SHALL NOT carry its own URL interview: it asks only for what the server's message names, and SHALL NOT restate the valid URL shapes, plain-language URL descriptions, example values, validation rules, or Base-URL derivation. It SHALL NOT edit `~/.formio/projects.json` by any means other than the server's own tool.

#### Scenario: An existing mapping is confirmed rather than interviewed

- **WHEN** `project_get` returns `ok` for the working directory
- **THEN** the skill confirms the resolved project and base URL in one line
- **AND** it does not ask for either URL
- **AND** the Import step proceeds immediately

#### Scenario: The preflight asks only for the value the server names

- **WHEN** `project_get` returns `not-configured`
- **THEN** the skill asks for the project URL and records it with the `project_set` tool
- **AND** when the next call returns `base-url-unresolved`, the skill asks only for the base URL and calls `project_set` without a `projectUrl`
- **AND** the skill does not present its own list of valid URL shapes or validation rules

#### Scenario: Planning runs before any server is required

- **WHEN** the user asks for an app and no Form.io tools are callable
- **THEN** the skill runs Intent and Plan in full and writes `template.md` + `template.json`
- **AND** it raises the missing server at Step 3 rather than opening the turn with it

#### Scenario: Missing tools route to setup before the probe runs

- **WHEN** Step 3 is reached and no Form.io tools are available under any name
- **THEN** the skill routes to `formio-mcp-setup`
- **AND** it does not attempt `project_get` or any import
- **AND** it does not write any MCP configuration file
- **AND** it does not claim the user's original request is finished

#### Scenario: A server too old to expose project_get is repaired, not interviewed around

- **WHEN** the other Form.io tools are callable and `project_get` is not
- **THEN** the skill hands off to `formio-mcp-setup` to re-pin the configured version
- **AND** it does not decide that case from a version number written in prose

#### Scenario: Modify-existing resolves the mapping too

- **WHEN** the user says "also track attendees in each event" in an existing Angular workspace
- **THEN** the preflight calls `project_get` at Step 3 and completes the configuration from the status it returns
- **AND** it does not read the URLs out of the workspace and assume the mapping exists

#### Scenario: No handoff carries a URL

- **WHEN** Step 4 hands off to a framework skill or Step 3.5 hands off to `formio-auth`
- **THEN** the payload names `workspacePath` and carries no `projectUrl`, `baseUrl`, `formioProjectUrl`, or `formioBaseUrl`
- **AND** the receiving skill resolves the project with `project_get` for that directory

## ADDED Requirements

### Requirement: FRAMEWORK.md holds the one handoff contract

`FRAMEWORK.md`'s handoff reference SHALL be the single statement of what `formio-application` hands each downstream skill, and SHALL define `workspacePath` as the `cwd` the Step 3 Preflight's `project_get` reported — the directory the import ran for. It SHALL state, per branch (build-new, modify-existing) and per receiver (framework entry skill, extend sub-skill, `formio-auth`): the fields passed, that no URL is among them, and which skill calls `project_get`. `SKILL.md`, `INTENT.md`, `IMPORT.md`, `formio-angular/SKILL.md`, `formio-react/SKILL.md`, and both resources sub-skills SHALL link to it rather than restating fields.

#### Scenario: Handoff fields are stated once

- **WHEN** the files above are searched for a list of handoff fields
- **THEN** only `FRAMEWORK.md` lists them
- **AND** every other file links to `FRAMEWORK.md`'s handoff reference

### Requirement: formio-auth runs once, after import

In an orchestrated build `formio-auth` SHALL run at Step 3.5, after the project is imported, and nowhere earlier. Step 3.5's trigger SHALL match the planner's auth concerns: a non-`none` SSO field, Custom JWT, or any auth concern beyond resource-backed login with Role and Group Assignment, RBAC tuning included.

#### Scenario: One auth handoff per build

- **WHEN** an approved Resource Map's Users & Auth section names SSO
- **THEN** `formio-auth` runs at Step 3.5 after the import
- **AND** the planner does not invoke it at map approval
- **AND** `formio-auth` calls `project_get` with `cwd` set to the `workspacePath` it was handed

