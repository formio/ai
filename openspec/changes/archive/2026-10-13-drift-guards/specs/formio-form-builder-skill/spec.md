## MODIFIED Requirements

### Requirement: SAVE persists via form_create and handles auth through the portal-login flow

`SAVE.md` SHALL script the SAVE step: an approval gate summarizing the form (title, path, type) and target project before the call; invoking the MCP server's `form_create` tool with the authored definition; on success, confirming the saved form path and full form URL (`{FORMIO_PROJECT_URL}/{formPath}`) back to the user. On an authentication error, the script SHALL retry the call, which starts the server's browser-based portal login — the login that captures a JWT attached as `x-jwt-token` — when no valid token is cached; PKCE and API keys SHALL NOT be used or mentioned as alternatives. No MCP server changes are required — `form_create` already exists and already instructs use of `formio-schema`.

#### Scenario: Saved form confirmed by URL

- **WHEN** `form_create` succeeds
- **THEN** the user is shown the saved form's path and its full form URL under `FORMIO_PROJECT_URL`

#### Scenario: Auth error routes through the portal login

- **WHEN** `form_create` returns an authentication error
- **THEN** `SAVE.md` directs the agent to retry the save, which starts the browser-based portal login (`x-jwt-token`) when no valid token is cached
- **AND** neither PKCE nor API keys appear as an auth mechanism in any `formio-form-builder` document

### Requirement: SKILL.md includes an MCP Tool Preference section

`plugin/skills/formio-form-builder/SKILL.md` SHALL include a `## MCP Tool Preference` section instructing Claude to prefer the MCP server's first-party tools — `form_create` and `form_get` — over ad-hoc HTTP requests, and stating that authentication uses the browser-based portal-login flow that captures a JWT attached as `x-jwt-token` on every request (never PKCE or API keys).

#### Scenario: MCP Tool Preference present

- **WHEN** `plugin/skills/formio-form-builder/SKILL.md` is inspected
- **THEN** it contains a `## MCP Tool Preference` heading
- **AND** the section names `form_create` and `form_get`, and no `authenticate` tool
- **AND** it contains the canonical portal-login JWT auth guidance (`x-jwt-token`, no PKCE, no API keys)
