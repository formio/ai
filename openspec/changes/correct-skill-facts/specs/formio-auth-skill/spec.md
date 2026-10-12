## MODIFIED Requirements

### Requirement: MCP Tool Preference names first-party tools

Each reference doc's `## MCP Tool Preference` section SHALL state explicitly which first-party MCP tools (any of `role_create`, `role_list`, `role_update`, `form_create`, `form_get`, `form_list`, `form_update`, `form_publish`, `form_revert`, `form_revision_list`, `form_revision_get`, `action_create`, `action_list`, `action_get`, `action_update`, `action_delete`, `action_type_get`, `action_type_list`, `project_get`, `project_set`, `project_export`, `project_import`) SHOULD be used for the operations the doc covers, OR state explicitly that the configuration MUST be performed via the Form.io project portal because no MCP tool covers it.

#### Scenario: Tool Preference is non-empty and specific

- **WHEN** any reference doc's `## MCP Tool Preference` section is read
- **THEN** the section SHALL be non-empty
- **AND** the section SHALL either name at least one first-party MCP tool from the approved list above, or state explicitly that the operation requires the Form.io project portal

#### Scenario: No retired tool name is approved

- **WHEN** the approved list above is compared with the tools the MCP server registers
- **THEN** every listed name SHALL be a registered tool
- **AND** neither `authenticate` nor `action_types_list` SHALL appear in any `formio-auth` reference

### Requirement: Canonical portal-login JWT paragraph in JWT-aware docs

`plugin/skills/formio-auth/references/jwt-and-sessions.md` and `plugin/skills/formio-auth/references/resource-auth.md` document the end user's JWT, so each SHALL contain the runtime authentication paragraph used by the `formio-api` runtime references (the constant `RUNTIME_AUTH_PARAGRAPH` in `packages/skill-tests/src/library-validation/validate-library.ts`) and SHALL NOT tell application code to obtain its token from the MCP server's portal-login flow. Other reference docs in `formio-auth` MAY link to that paragraph instead of copying it.

#### Scenario: Runtime paragraph present in JWT-aware docs

- **WHEN** `jwt-and-sessions.md` and `resource-auth.md` are read
- **THEN** each file SHALL contain the runtime authentication paragraph verbatim
- **AND** neither SHALL contain the canonical portal-login paragraph

## ADDED Requirements

### Requirement: formio-auth MUST state the server's auth behaviour exactly

`formio-auth`'s references SHALL state:

- **Token swap:** a swapped user whose claims match no role mapping holds no role — not Authenticated, not Anonymous; a mapping row with no claim applies to every swapped user.
- **Email token:** the `[[token(<fieldPath>=<resource>[,<resource>…])[,<minutes>]]]` macro is placed in the standard Email action's message; `<fieldPath>` is the field on the searched resource matched against the recipient address, the default lifetime is 120 minutes, it is replaced only in the message body of a single-recipient email, and an unmatched recipient yields `INVALID_TOKEN`. `SKILL.md` SHALL NOT call it a separate "Email Authentication" action.
- **Project `_id`:** for Custom JWT, the project `_id` is the `project` field of any form in the project (for example `form_get` on the user resource with `select: "_id,project"`); `project_export` is not a source, because the export omits it.
- **Everyone role:** its id is `000000000000000000000000` (24 zeros).
- **Docs links:** every link to Form.io's documentation carries its host.
- **Persona roles:** the conditional Role Assignment actions a multi-role user resource carries run on create only, by design; changing an existing user's persona is an administrator task.

#### Scenario: Everyone id has 24 zeros

- **WHEN** `roles-and-permissions.md` is read
- **THEN** the Everyone role id it gives is 24 characters long

#### Scenario: Custom JWT does not read _id from export

- **WHEN** `custom-jwt.md` is read
- **THEN** it does not direct the reader to `project_export` for the project `_id`

#### Scenario: Token swap does not grant Authenticated by default

- **WHEN** `token-swap.md` is read
- **THEN** it states that a user matching no mapping holds no role
