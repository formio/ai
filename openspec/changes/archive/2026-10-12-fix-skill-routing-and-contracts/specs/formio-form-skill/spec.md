## MODIFIED Requirements

### Requirement: SKILL.md includes an MCP Tool Preference section

`plugin/skills/formio-form/SKILL.md` SHALL include a `## MCP Tool Preference` section instructing Claude to prefer the MCP server's first-party tools when an embed task requires the form definition — `form_get` to read it, instead of ad-hoc HTTP requests — and to send any change to a saved form's definition to `formio-form-builder`'s edit lane, which shows the change and asks before `form_update` writes it, and stating that authentication uses the browser-based portal-login flow that captures a JWT attached as `x-jwt-token` (never PKCE or API keys).

#### Scenario: MCP Tool Preference present

- **WHEN** `plugin/skills/formio-form/SKILL.md` is inspected
- **THEN** it contains a `## MCP Tool Preference` heading
- **AND** the section names `form_get` and routes saved-form edits to `formio-form-builder`
- **AND** it does not name an `authenticate` tool
- **AND** it contains the canonical portal-login JWT auth guidance (`x-jwt-token`, no PKCE, no API keys)

