## Purpose

Defines when the Form.io API router skill activates: the trigger and negative-trigger clauses its description must carry, and the MCP Tool Preference guidance that sends first-party operations to the MCP tools rather than to raw HTTP.

## Requirements

### Requirement: Router description MUST contain trigger and negative-trigger clauses

The `formio-api` router SKILL.md `description` field SHALL contain both:

- A positive trigger phrase (the substring `use when`, case-insensitive) listing action verbs the user might say.
- A negative-trigger phrase (the substring `not for:`, case-insensitive) naming the orchestrator and planner skills this skill is NOT for (e.g., `formio-application`, `formio-resource-planner`).

Because the router is the single activatable entry-point into the API reference library, Claude selects it whenever the user asks about a Form.io REST endpoint. The description MUST make both the positive and negative selection criteria explicit.

#### Scenario: Router description with valid trigger and negative-trigger passes validation

- **WHEN** the router description contains both `Use when the user asks to ...` and `Not for: ... (see formio-application) ...`
- **THEN** `validateRouterDescriptionTriggers` SHALL NOT emit an issue

#### Scenario: Router description missing "use when" fails validation

- **WHEN** the router description lacks any case-insensitive occurrence of `use when`
- **THEN** `validateRouterDescriptionTriggers` SHALL emit a `description.trigger_phrase` issue

#### Scenario: Router description missing "not for:" fails validation

- **WHEN** the router description lacks any case-insensitive occurrence of `not for:`
- **THEN** `validateRouterDescriptionTriggers` SHALL emit a `description.negative_trigger` issue

### Requirement: Router MUST include MCP Tool Preference guidance

The router `SKILL.md` body SHALL contain guidance instructing Claude to prefer first-party MCP tools (`form_create`, `form_get`, `form_list`, `form_update`, `role_create`, `role_list`, `role_update`, `project_export`, `project_import`) over raw HTTP when both paths exist. This guidance MAY be a dedicated section heading or inline text. Authentication is implicit — any authenticated MCP tool call triggers the portal-login flow on first use, so no explicit `authenticate` tool is exposed.

#### Scenario: Router body carries the tool-preference guidance

- **WHEN** `plugin/skills/formio-api/SKILL.md` is read
- **THEN** its body SHALL contain guidance to prefer first-party MCP tools over raw HTTP where both reach the same operation
- **AND** that guidance SHALL name the tools it prefers, so a reader can tell which operations have one

#### Scenario: Router body omitting the guidance is non-conformant

- **WHEN** the router body contains no tool-preference guidance
- **THEN** the router SHALL be treated as non-conformant
- **AND** the reason SHALL be that the router is the only surface a reader passes through on the way to a reference, so guidance absent here sends them to raw HTTP for an operation a first-party tool already covers

#### Scenario: The guidance describes authentication as implicit rather than as a tool call

- **WHEN** the tool-preference guidance explains how an authenticated call is authorized
- **THEN** it SHALL state that the first authenticated tool call triggers the portal-login flow
- **AND** it SHALL NOT direct the reader to call an `authenticate` tool first, because this server registers none
