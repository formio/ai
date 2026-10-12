## MODIFIED Requirements

### Requirement: Direct invocation without an upstream plan

`formio-react` SHALL NOT run `formio-resource-planner`, and SHALL NOT import a template into a Form.io project. Planning and import are `formio-application`'s responsibilities, exactly as they are for `formio-angular`.

When `formio-react` is invoked directly by a framework-explicit trigger, it SHALL expect an already-approved `template.json` and a project the template has been imported into. When neither exists, it SHALL hand the request to `formio-application` with React named as the framework — after telling the user in one line that planning comes first — rather than planning itself or asking the user to re-invoke anything; that skill runs the planner, imports, and hands back. The greenfield chain cannot usefully proceed without the plan in any case: BOOTSTRAP sizes the workspace against it, AUTH renders the planner's login and registration forms, and Resources generates from it.

#### Scenario: Direct invocation with no plan hands off to the orchestrator

- **WHEN** the user says "build it in React" in a directory with no approved `template.json`
- **THEN** the skill hands the request to `formio-application` with React as the framework
- **AND** it does not run the planner itself and does not import anything

#### Scenario: Handoff supplies the plan

- **WHEN** `formio-application` hands off with `templateMdPath` and `templateJsonPath`
- **THEN** the skill proceeds without asking for a plan

## ADDED Requirements

### Requirement: The existing-app branch gates on rendering mode first

`formio-react/EXISTING.md` SHALL check the workspace's rendering mode before its data-router gate. A workspace with `next` in its dependencies or a `next.config.*` file, or with `@react-router/dev`, a `react-router.config.*` file, or an `@remix-run/*` dependency, is a server-rendering or framework-mode app, which this skill does not build into: the skill SHALL stop, say so, and offer the embed branch for placing individual forms, and SHALL NOT offer to convert the application.

#### Scenario: A Next.js app is not offered a router migration

- **WHEN** the existing branch runs in a workspace with `next` in `package.json`
- **THEN** the skill stops before the data-router gate and offers the embed branch
- **AND** it does not offer a `createBrowserRouter` migration

### Requirement: A workspace about to be scaffolded is recorded first

`formio-react/SETUP.md` SHALL, when the workspace root holds no application yet and `project_get` returns `ok` from anything but the workspace root's own mapping, record the pair for the workspace root with `project_set` before the scaffold — the reported Project URL, and the reported Base URL whenever its `baseUrlSource` is not `derived` — because the server's mapping lookup and committed-file walk stop at the first directory containing `.git`.

#### Scenario: A parent's mapping is recorded for the new workspace

- **WHEN** the project resolves from a mapping on the workspace's parent directory and the workspace holds no application
- **THEN** SETUP records the pair for the workspace root before the scaffold
