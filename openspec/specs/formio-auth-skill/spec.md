## ADDED Requirements

### Requirement: Skill directory and entry point

The skills library SHALL include a stand-alone skill at `plugin/skills/formio-auth/` whose entry point is `plugin/skills/formio-auth/SKILL.md` containing valid YAML frontmatter with `name: formio-auth` and a non-empty `description`.

#### Scenario: SKILL.md exists and parses

- **WHEN** `plugin/skills/formio-auth/SKILL.md` is parsed
- **THEN** the file SHALL exist and be non-empty
- **AND** its frontmatter SHALL contain `name: formio-auth`
- **AND** its frontmatter SHALL contain a non-empty `description` field

#### Scenario: Reference directory exists

- **WHEN** the skill is inspected
- **THEN** `plugin/skills/formio-auth/references/` SHALL exist as a directory

### Requirement: Activation description uses the three-clause router template

`plugin/skills/formio-auth/SKILL.md`'s `description` SHALL contain three discrete clauses in order: (1) a capability statement, (2) a "Use when the user asks to …" trigger clause, and (3) a "Not for: …" negative-trigger clause that explicitly disambiguates `formio-auth` from `formio-resource-planner`, `formio-application`, `formio-api`, `formio-angular`, and `formio-actions` — with `formio-actions` cited for per-form action JSON mechanics (action settings, priorities, conditions, handler/method combinations), while `formio-auth` keeps the auth architecture (SSO, Token Swap, Custom JWT, JWT/session mechanics, 2FA, RBAC tuning).

#### Scenario: Description contains the trigger clause

- **WHEN** the SKILL.md frontmatter is read
- **THEN** the `description` SHALL contain the phrase `Use when` (case-insensitive)

#### Scenario: Description contains the negative-trigger clause

- **WHEN** the SKILL.md frontmatter is read
- **THEN** the `description` SHALL contain the phrase `Not for` (case-insensitive)
- **AND** the negative-trigger clause SHALL name `formio-resource-planner` and at least one of `formio-application` / `formio-api` / `formio-angular`

#### Scenario: Negative clause names formio-actions

- **WHEN** the SKILL.md frontmatter is read
- **THEN** the `Not for:` clause SHALL name the backtick-delimited `` `formio-actions` `` for per-form action JSON mechanics

### Requirement: Auth-mechanism coverage

The skill SHALL provide a dedicated reference document for each of the following Form.io authentication and authorization mechanisms:

- Resource-backed login (Login Action + Role Assignment Action)
- Login and registration form patterns
- Roles and the eight-permission RBAC matrix (`create_own`, `create_all`, `read_own`, `read_all`, `update_own`, `update_all`, `delete_own`, `delete_all`) across project, form-definition, and submission-data scopes
- Group Assignment Action and field-based resource access (single-level + transitive group access)
- SSO via OIDC / OAuth (with OAuth Role Mapping)
- SSO via SAML (with SAML Role Mapping)
- SSO via LDAP (with LDAP Role Mapping)
- Token Swap (exchanging an external OIDC token for a Form.io JWT)
- Custom JWT (Enterprise / on-prem, signed with `JWT_SECRET`)
- Email-token authentication
- JWT and session mechanics (`x-jwt-token` header, `jti` Session ID, logout semantics, 2FA, reCAPTCHA)

Each topic SHALL be covered by exactly one reference document under `plugin/skills/formio-auth/references/`.

#### Scenario: Required reference docs all exist

- **WHEN** the skill is inspected
- **THEN** the following files SHALL all exist and be non-empty under `plugin/skills/formio-auth/references/`:
  - `resource-auth.md`
  - `login-forms.md`
  - `roles-and-permissions.md`
  - `group-permissions.md`
  - `sso-oidc.md`
  - `sso-saml.md`
  - `sso-ldap.md`
  - `token-swap.md`
  - `custom-jwt.md`
  - `email-auth.md`
  - `jwt-and-sessions.md`

#### Scenario: Reference docs name their topic in a top-level heading

- **WHEN** each reference doc is parsed
- **THEN** the first top-level heading (`#` or `##`) SHALL name the topic covered by the file

### Requirement: Reference docs have no YAML frontmatter

Files under `plugin/skills/formio-auth/references/` SHALL NOT begin with a YAML frontmatter block. Only `SKILL.md` carries frontmatter.

#### Scenario: Reference doc without frontmatter passes

- **WHEN** any `plugin/skills/formio-auth/references/*.md` is parsed
- **THEN** the file SHALL NOT begin with a line equal to `---`

### Requirement: Reference doc section layout

Every reference doc under `plugin/skills/formio-auth/references/` SHALL contain these top-level Markdown headings, in this order:

1. `## Overview`
2. `## When to use this`
3. `## Configuration`
4. `## MCP Tool Preference`
5. `## See also`

#### Scenario: Reference doc layout present

- **WHEN** any reference doc is parsed
- **THEN** the parsed top-level (`##`) headings SHALL include `Overview`, `When to use this`, `Configuration`, `MCP Tool Preference`, and `See also`
- **AND** these headings SHALL appear in the order listed above

### Requirement: MCP Tool Preference names first-party tools

Each reference doc's `## MCP Tool Preference` section SHALL state explicitly which first-party MCP tools (any of `authenticate`, `role_create`, `role_list`, `role_update`, `form_create`, `form_get`, `form_list`, `form_update`, `action_create`, `action_list`, `action_get`, `action_update`, `action_delete`, `action_type_get`, `action_types_list`, `project_export`, `project_import`) SHOULD be used for the operations the doc covers, OR state explicitly that the configuration MUST be performed via the Form.io project portal because no MCP tool covers it.

#### Scenario: Tool Preference is non-empty and specific

- **WHEN** any reference doc's `## MCP Tool Preference` section is read
- **THEN** the section SHALL be non-empty
- **AND** the section SHALL either name at least one first-party MCP tool from the approved list above, or state explicitly that the operation requires the Form.io project portal

### Requirement: Canonical portal-login JWT paragraph in JWT-aware docs

`plugin/skills/formio-auth/references/jwt-and-sessions.md` and `plugin/skills/formio-auth/references/resource-auth.md` SHALL each contain the canonical portal-login JWT authentication paragraph used elsewhere in the library (the same paragraph enforced by `packages/mcp-server/src/skills-validator.ts` for `formio-api` references). Other reference docs in `formio-auth` MAY link to that paragraph instead of copying it.

#### Scenario: Canonical paragraph present in JWT-aware docs

- **WHEN** `jwt-and-sessions.md` and `resource-auth.md` are read
- **THEN** each file SHALL contain the canonical portal-login JWT auth paragraph verbatim

### Requirement: Terminology — baseUrl vs projectUrl

Reference docs under `plugin/skills/formio-auth/references/` SHALL NOT describe the project endpoint using `baseUrl` / `base_url`, and SHALL NOT describe the platform deployment endpoint using `projectUrl` / `project_url`. The canonical mapping is:

- `baseUrl` / `base_url` → `FORMIO_BASE_URL` (platform deployment endpoint)
- `projectUrl` / `project_url` → `FORMIO_PROJECT_URL` (project endpoint)

#### Scenario: baseUrl misuse fails review

- **WHEN** a reference doc contains prose that uses `baseUrl` to describe a project-scoped operation
- **THEN** the doc SHALL be corrected before merge

### Requirement: Cross-skill handoff to formio-resource-planner

Every reference doc under `plugin/skills/formio-auth/references/` SHALL contain a `## See also` section that names `formio-resource-planner` whenever the configuration covered by the doc depends on resources, roles, or forms that the planner is responsible for creating (Resource-backed login, login forms, registration forms, roles and permissions, group permissions). For SSO / Token Swap / Custom JWT / email-token docs the `## See also` section SHALL cross-reference at least one neighboring reference inside `plugin/skills/formio-auth/references/` (for example, `jwt-and-sessions.md`).

#### Scenario: Resource-dependent doc references the planner

- **WHEN** `resource-auth.md`, `login-forms.md`, `roles-and-permissions.md`, or `group-permissions.md` is read
- **THEN** the `## See also` section SHALL name `formio-resource-planner`

#### Scenario: SSO / Token-Swap / Custom-JWT / email-token docs cross-link neighbors

- **WHEN** `sso-oidc.md`, `sso-saml.md`, `sso-ldap.md`, `token-swap.md`, `custom-jwt.md`, or `email-auth.md` is read
- **THEN** the `## See also` section SHALL link to at least one other reference doc in `plugin/skills/formio-auth/references/`

### Requirement: Planner skill emits a handoff to formio-auth

`plugin/skills/formio-resource-planner/SKILL.md` SHALL be updated so that:

- Its `description` includes a "Not for" negative-trigger clause that names SSO (OIDC / SAML / LDAP), Token Swap, Custom JWT, email-token authentication, JWT/session mechanics, and 2FA as topics that route to `formio-auth`.
- Its "Users & Auth" Resource Map section emits an `SSO: <none | OIDC | SAML | LDAP>` field and a `Custom JWT: <yes | no>` field.
- Its narrative includes a "Next steps" pointer naming `formio-auth` whenever the user's requirements include any of: SSO, Token Swap, Custom JWT, email-token auth, JWT customization, 2FA, or RBAC tuning beyond default roles.

The planner's JSON-shape references (`references/template-json.md`) SHALL remain the single source of truth for Login Action, Role Assignment Action, Group Assignment Action, role objects, `access` arrays, `submissionAccess` arrays, and field-based `submissionAccess` on group-reference selects. The `formio-auth` skill SHALL reference those shapes by file path rather than forking them.

#### Scenario: Planner description names the auth handoff

- **WHEN** `plugin/skills/formio-resource-planner/SKILL.md` frontmatter is read
- **THEN** the `description` SHALL contain a "Not for" clause that names `formio-auth` and at least three of: SSO, OIDC, SAML, LDAP, Token Swap, Custom JWT, email token, JWT, 2FA

#### Scenario: Planner Users & Auth emits SSO and Custom JWT fields

- **WHEN** the planner's "Users & Auth" Resource Map template is read
- **THEN** the template SHALL include an `SSO:` field whose value is one of `none | OIDC | SAML | LDAP`
- **AND** the template SHALL include a `Custom JWT:` field whose value is `yes` or `no`

#### Scenario: Planner action JSON shapes remain canonical

- **WHEN** `plugin/skills/formio-resource-planner/references/template-json.md` is read
- **THEN** the Login Action, Role Assignment Action, and Group Assignment Action JSON shapes SHALL remain present and unmodified except for narrative scoping changes that route SSO / Token-Swap / Custom-JWT / email-token questions to `formio-auth`

### Requirement: CLAUDE.md lists formio-auth in the Skills Library section

`CLAUDE.md`'s "Skills Library" section SHALL list `formio-auth` as a peer of `formio-api`, `formio-application`, `formio-resource-planner`, and `formio-angular`, and SHALL describe the planner ↔ auth handoff contract (planner emits roles, login forms, and group joins; `formio-auth` covers SSO, Token Swap, Custom JWT, email-token, and RBAC tuning).

#### Scenario: CLAUDE.md mentions formio-auth

- **WHEN** `CLAUDE.md` is read
- **THEN** the "Skills Library" section SHALL contain the string `formio-auth`
- **AND** the section SHALL describe the planner ↔ auth handoff

### Requirement: Definition of Done — pnpm test, lint, and format pass

After implementation, the change SHALL satisfy the repository's Definition of Done: `pnpm test`, `pnpm lint`, and `pnpm format` SHALL all complete successfully.

#### Scenario: All gates green

- **WHEN** a developer runs `pnpm test`, `pnpm lint`, and `pnpm format` from the repo root
- **THEN** all three commands SHALL exit with status 0
