## ADDED Requirements

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
