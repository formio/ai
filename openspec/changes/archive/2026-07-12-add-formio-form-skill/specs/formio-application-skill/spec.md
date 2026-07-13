## MODIFIED Requirements

### Requirement: formio-application description claims plain-language triggers and names the framework skills

The `formio-application` `SKILL.md` frontmatter `description` SHALL claim plain-language build-an-app and extend-an-app triggers WITHOUT requiring the user to know any UI framework or Form.io terminology. Example triggers the description MUST claim include:

- Build-new: "build me an app", "create a CRM", "I need a tool to track X", "spin up a system for Y", bare domain archetypes ("task manager", "help desk").
- Extend-existing: "also track X", "add a way to see Y", "each Z should have a list of W", "let users also submit V".

The description MUST state that this skill is the library's default build-an-app entry point; that it picks a UI framework automatically when only one is installed and asks the user when multiple are installed; that the user does NOT need to mention "Angular", "React", "framework", "resource", or "NgModule".

The description MUST include `Not for:` clauses pointing at:

- `formio-angular` for framework-explicit Angular requests.
- `formio-angular-resources` for framework-explicit Angular extension requests.
- `formio-resource-planner` for data-model-only planning requests without building an app.
- `formio-api` for endpoint lookups.
- `formio-form` for embedding or rendering a single form in an existing page or application (no app build or orchestration).

The description MUST also state that the skill writes a `.mcp.json` file in the workspace root as part of the flow (so users know a file will be created and why) and that the flow pauses for a Claude Code restart after the `.mcp.json` write.

#### Scenario: formio-application claims generic build-new triggers

- **WHEN** the user says "build me a tool to track maintenance requests" (no framework or Form.io terminology)
- **THEN** the `formio-application` skill activates
- **AND** neither `formio-angular` nor `formio-angular-resources` activates

#### Scenario: formio-application claims generic extend triggers

- **WHEN** the user says "also let customers leave reviews on products" in a workspace that already has a framework app wired
- **THEN** the `formio-application` skill activates
- **AND** `formio-angular-resources` does not activate directly

#### Scenario: Framework-explicit phrasing does NOT route through formio-application

- **WHEN** the user says "build it in Angular" or "add an Angular module for X"
- **THEN** `formio-angular` (or `formio-angular-resources`) activates directly
- **AND** `formio-application` does not activate

#### Scenario: Embed-a-form phrasing does NOT route through formio-application

- **WHEN** the user says "embed this form in my existing site" or "render this form on my page" (no app build requested)
- **THEN** `formio-form` activates
- **AND** `formio-application` does not activate
- **AND** the `formio-application` description's `Not for:` clauses contain the literal substring `formio-form`

#### Scenario: Description mentions the .mcp.json write

- **WHEN** the `formio-application` `SKILL.md` frontmatter is inspected
- **THEN** its `description` contains the literal substring `.mcp.json`

#### Scenario: Description mentions the restart pause

- **WHEN** the `formio-application` `SKILL.md` frontmatter is inspected
- **THEN** its `description` mentions restarting Claude Code (or an equivalent "pause and restart" phrasing) so the user knows the flow is multi-invocation
