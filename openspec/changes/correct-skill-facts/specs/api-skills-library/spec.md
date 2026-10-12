## ADDED Requirements

### Requirement: Runtime references MUST document the requests the default project accepts

`plugin/skills/formio-api/references/runtime-*.md` SHALL document runtime behaviour as the Form.io server implements it:

- Self-registration posts to `{projectUrl}/user/register/submission`, whose Save and Login actions create the user and return the JWT in the `x-jwt-token` response header; `POST {projectUrl}/user/submission` is not presented as registration, because the default project grants Anonymous no create on `user`.
- An expired or revoked token is recognised by HTTP status 440, not by the response text.
- A login locked by the Login action's attempt limit answers 401.
- Validating a submission without saving it uses `?dryrun=1`.
- An action that always runs omits `condition`; no example sends `conjunction: ""`.
- Where a runtime reference documents an endpoint an MCP tool covers (`form_create`, `role_create`, `action_create`), its `## MCP Tool Preference` section names that tool.

#### Scenario: Registration uses the register form

- **WHEN** `runtime-auth.md` is read
- **THEN** its registration endpoint is `POST {projectUrl}/user/register/submission`

#### Scenario: Expiry keys on status

- **WHEN** token expiry handling in `runtime-auth.md` is read
- **THEN** it keys on status 440 and does not key on the text "Session no longer valid"

#### Scenario: No empty conjunction

- **WHEN** every reference under `formio-api` is searched for `"conjunction": ""`
- **THEN** no match is found

### Requirement: Platform references MUST describe PUT and import as the server behaves

- `platform-tenants.md` and `platform-projects.md` SHALL state that a PUT keeps every top-level field the body omits and replaces a sent array or object whole; `platform-projects.md` SHALL add the project PUT's own rules (the `_id` comes from the URL, an omitted `settings.licenseKey` is kept, `billing` is ignored, a body `template` is imported, PATCH answers 405).
- Every import body in `platform-projects.md` and `platform-staging.md` SHALL give `forms` and `resources` as objects keyed by machine name, both present.

#### Scenario: PUT keeps omitted fields

- **WHEN** the PUT sections of `platform-tenants.md` and `platform-projects.md` are read
- **THEN** neither says omitted fields are reset

#### Scenario: Import bodies use objects

- **WHEN** the import examples in `platform-projects.md` and `platform-staging.md` are parsed
- **THEN** `forms` and `resources` are objects, not arrays

### Requirement: The router and revision reference MUST describe the tools as registered

`formio-api/SKILL.md`'s preferred-tool list SHALL name every tool the MCP server registers that reaches a deployment, plus `project_get` and `project_set`. `project-form-revisions.md` SHALL describe `form_update`'s draft save as refusing a changed non-draft field, `form_revert` as refusing the draft version, and `form_create`'s note as optional. `formio-form-builder/SAVE.md` SHALL NOT claim that `form_create` validates a form against `formio-schema`'s conventions.

#### Scenario: Router names every tool

- **WHEN** the preferred-tool list in `formio-api/SKILL.md` is compared with the server's registered tools
- **THEN** every registered tool except `server_status` is named

#### Scenario: Draft save is described as refusing

- **WHEN** the draft-save text in `project-form-revisions.md` is read
- **THEN** it states that a changed non-draft field is refused, not ignored
