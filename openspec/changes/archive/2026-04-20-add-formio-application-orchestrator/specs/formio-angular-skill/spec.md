## MODIFIED Requirements

### Requirement: Parent skill description and trigger surface

The parent `formio-angular` `SKILL.md` frontmatter `description` SHALL claim ONLY framework-explicit Angular triggers — phrases that explicitly name Angular or request Angular-specific behavior. The description MUST include at least the following positive triggers:

- "build it in Angular"
- "Angular front-end for this Form.io project"
- "use Angular"
- "the Angular skill"
- Invocation from `formio-application` via handoff context (the orchestrator passes the framework choice explicitly).

The description MUST drop all plain-language "build me an app" triggers (those now belong to `formio-application`). The description MUST NOT contain generic phrases like "build me an app", "build me a tool", "spin up an app", "I need a tool to track", or bare domain archetypes like "task manager", "help desk", "CRM", "booking system".

The description MUST include a `Not for:` clause pointing at `formio-application` for generic build-an-app requests and for framework-agnostic "I want to build X" requests.

The description MUST continue to include the existing `Not for:` clause pointing at `formio-angular-resources` for add-a-feature-to-an-existing-app requests.

#### Scenario: formio-angular only fires on Angular-explicit phrasing

- **WHEN** the user says "build it in Angular" or "I want an Angular front-end for my Form.io project"
- **THEN** the `formio-angular` skill activates
- **AND** `formio-application` does not activate

#### Scenario: formio-angular does not fire on generic build-an-app phrasing

- **WHEN** the user says "build me a CRM" (no mention of Angular)
- **THEN** the `formio-angular` skill does NOT activate
- **AND** `formio-application` activates instead

#### Scenario: formio-angular description Not-for clause names the orchestrator

- **WHEN** the `formio-angular` `SKILL.md` frontmatter is inspected
- **THEN** its `description` contains the literal substring `formio-application`
- **AND** it contains a `Not for:` clause pointing at `formio-application`

### Requirement: Sub-skill description and trigger surface

The sub-skill `formio-angular-resources` (`skills/formio-angular/resources/SKILL.md`) frontmatter `description` SHALL claim ONLY framework-explicit Angular-extension triggers. The description MUST include at least:

- "add an Angular module for X"
- "regenerate the Angular X resource module"
- "in my Angular app, wire Y to Z"
- "fix the Angular <component> component"
- Invocation from `formio-angular` via handoff context.

The description MUST drop all plain-language "also track X" / "add Y to the app" triggers (those now belong to `formio-application`'s modify-existing branch). The description MUST NOT contain generic phrases like "also track", "also let", "add a way to see", "each X should have a list of Y", or "let users do Z".

The description MUST include a `Not for:` clause pointing at `formio-application` for generic extend-an-app requests.

#### Scenario: Sub-skill only fires on Angular-explicit extension phrasing

- **WHEN** the user says "add an Angular module for Participant in my Event app"
- **THEN** the `formio-angular-resources` sub-skill activates

#### Scenario: Sub-skill does not fire on generic extend phrasing

- **WHEN** the user says "also track attendees for each event" (no mention of Angular)
- **THEN** `formio-angular-resources` does NOT activate
- **AND** `formio-application` activates instead

### Requirement: Parent skill orchestration order

The parent `formio-angular` `SKILL.md` SHALL instruct Claude to execute the following phases in the following strict order, with a user-approval gate between each:

1. **SETUP** — capture the Form.io `Project URL` and `Base URL` via interview, UNLESS they were already captured by `formio-application`'s Deployment step and handed in as context. When handed in, the skill SHALL confirm the values with the user in one short acknowledgement and proceed without re-interviewing.
2. **CONFIG** — generate `src/app/config.ts` exporting `AppConfig: FormioAppConfig` with `appUrl` = project URL and `apiUrl` = base URL, and wire it into `AppModule` via `{ provide: FormioAppConfig, useValue: AppConfig }`.
3. **AUTH** — generate `src/app/auth/auth.module.ts` configuring `FormioAuthConfig` from the `template.json` auth resources and roles. Import `AuthModule` into `AppModule`.
4. **Resources** — delegate to the `formio-angular-resources` sub-skill with the accumulated context.

The skill SHALL NOT run an Inference phase (planner handoff). Planner invocation is `formio-application`'s responsibility. When `formio-angular` is invoked directly by a user (framework-explicit trigger), the skill SHALL expect an already-approved `template.json` and a workspace ready for file generation; if neither exists, it SHALL ask the user to invoke `formio-application` first rather than running the planner itself.

The skill SHALL NOT run an Import phase. Template import into a Form.io project is `formio-application`'s responsibility.

#### Scenario: Parent accepts handoff from formio-application

- **WHEN** `formio-application` invokes `formio-angular` after completing its Deployment and Import steps
- **THEN** `formio-angular` SHALL skip its SETUP interview
- **AND** confirm the handed-in URLs with a short acknowledgement
- **AND** proceed to CONFIG

#### Scenario: Parent rejects invocation without upstream plan

- **WHEN** the user invokes `formio-angular` directly with a framework-explicit request and no `template.json` is in scope
- **THEN** `formio-angular` SHALL point the user at `formio-application` rather than running the planner itself

#### Scenario: Parent enforces phase order for file generation

- **WHEN** `formio-angular` runs its SETUP → CONFIG → AUTH → Resources sequence
- **THEN** each phase ends with an approval gate before files are written
- **AND** a declined gate stops the flow without writing partial state

### Requirement: Planner persists template.json to the working directory

When the `formio-resource-planner` skill emits Phase B, it SHALL also write the `template.json` content to a file on disk in the user's working directory, not only as a fenced JSON block in the chat transcript.

- Default filename: `template.json` in the current working directory.
- If `template.json` already exists in the cwd, the planner SHALL write to `template-<timestamp>.json` and MUST report the chosen filename to the user.
- The planner's `SKILL.md` MUST explicitly document the file-write behavior in its Phase B section.
- The planner's "does not call the MCP server" stance is preserved — local filesystem writes are explicitly permitted.

When `formio-application` invokes the planner as part of its build-new branch, the planner MUST persist the file so that `formio-application`'s Import step can pass a real file path to `project_import`.

#### Scenario: Planner writes template.json on Phase B

- **WHEN** the planner emits Phase B after user approval, in a working directory that contains no existing `template.json`
- **THEN** a file named `template.json` exists in the working directory and contains the same JSON that appeared in the chat transcript

#### Scenario: Planner avoids overwriting an existing file

- **WHEN** the planner emits Phase B in a working directory that already contains `template.json`
- **THEN** the planner writes to `template-<timestamp>.json` instead
- **AND** the planner tells the user the filename it used
- **AND** the original `template.json` is not modified
