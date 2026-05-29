## ADDED Requirements

### Requirement: Consolidated Form.io JSON schema skill

The `formio-schema` skill SHALL be the single Form.io JSON schema reference skill in the library. The repository SHALL NOT contain a separate `formio-form` skill; `plugin/skills/formio-form/` SHALL not exist.

`plugin/skills/formio-schema/SKILL.md` SHALL be the router entry point, carrying YAML frontmatter with at least `name: formio-schema` and a `description` that:

1. States the skill covers Form.io JSON schemas for project, form (and resource), and submission documents. It SHALL NOT claim to cover action or role JSON — action JSON is owned by the dedicated `formio-actions` skill, and role JSON is handled by `formio-api`'s `project-roles` reference.
2. Includes a "Use when…" trigger clause listing the form-builder phrases that previously activated `formio-form` (e.g., `components`, `wizard`, `textfield`, `datagrid`) so existing form-authoring prompts still activate the skill.
3. Includes a "Not for:" negative-trigger clause disambiguating from `formio-api`, `formio-actions`, `formio-resource-planner`, and `formio-application`. The clause SHALL NOT mention `formio-form`.

#### Scenario: formio-form skill is removed

- **WHEN** the repository is inspected
- **THEN** `plugin/skills/formio-form/` SHALL NOT exist
- **AND** no file under `plugin/skills/` SHALL reference `formio-form` by name

#### Scenario: formio-schema router has multi-domain description

- **WHEN** `plugin/skills/formio-schema/SKILL.md` is parsed
- **THEN** its frontmatter `name` SHALL equal `formio-schema`
- **AND** its frontmatter `description` SHALL mention the domains "submission" and "project" alongside "form"
- **AND** its frontmatter `description` SHALL include a "Not for:" clause that names `formio-api`, `formio-actions`, `formio-resource-planner`, and `formio-application`
- **AND** its frontmatter `description` SHALL NOT contain the string `formio-form`

### Requirement: Domain-partitioned references directory

The skill's reference documents SHALL live under `plugin/skills/formio-schema/references/<domain>/`, with one subdirectory per Form.io schema domain. The directory layout SHALL be additive: adding a new schema domain creates a new subdirectory under `references/` rather than placing files at the top level.

The set of domains the skill owns SHALL be exactly `form`, `submission`, and `project`. Action JSON and role JSON SHALL NOT be domains of this skill — there SHALL be no `references/action/` or `references/role/` subdirectory.

`plugin/skills/formio-schema/references/form/` SHALL contain the form-domain references previously located at `plugin/skills/formio-schema/references/`:

- `form-definition.md`
- `base-component.md`
- `input-components.md`
- `layout-components.md`
- `data-components.md`

`plugin/skills/formio-schema/references/submission/` SHALL contain authored reference files (`submission-definition.md`, `submission-state.md`, `submission-metadata.md`, `submission-access.md`, `submission-data.md`) — NOT a placeholder `README.md`.

`plugin/skills/formio-schema/references/project/` SHALL contain authored reference files (`project-definition.md`, `project-type-and-framework.md`, `project-settings.md`, `project-access.md`) — NOT a placeholder `README.md`. The project domain SHALL NOT include a billing-and-usage reference file.

`plugin/skills/formio-schema/references/` SHALL NOT contain any `.md` file directly (only subdirectories).

No domain owned by this skill SHALL be a placeholder — every domain subdirectory SHALL contain authored reference files.

#### Scenario: References live under domain subdirectories

- **WHEN** `plugin/skills/formio-schema/references/` is listed
- **THEN** its subdirectories SHALL be exactly `form/`, `submission/`, and `project/`
- **AND** it SHALL NOT contain `action/` or `role/` subdirectories
- **AND** it SHALL NOT contain any `.md` files at its top level

#### Scenario: Form domain has the full reference set

- **WHEN** `plugin/skills/formio-schema/references/form/` is listed
- **THEN** it SHALL contain `form-definition.md`, `base-component.md`, `input-components.md`, `layout-components.md`, and `data-components.md`
- **AND** every file in `references/form/` SHALL be non-empty

### Requirement: Router SKILL.md indexes every domain

`plugin/skills/formio-schema/SKILL.md` SHALL contain a table (or equivalent structured list) that maps each domain to its references. The form domain SHALL list all five form references with their relative paths under `references/form/`. The submission domain SHALL list all five authored submission references with their relative paths under `references/submission/`. The project domain SHALL list all four authored project references with their relative paths under `references/project/`. The router body SHALL NOT list `action` or `role` as domains owned by this skill. The router body SHALL NOT reference any `<domain>/README.md` placeholder path.

#### Scenario: Router enumerates all five form-domain references

- **WHEN** `plugin/skills/formio-schema/SKILL.md` is parsed
- **THEN** its body SHALL reference the paths `references/form/form-definition.md`, `references/form/base-component.md`, `references/form/input-components.md`, `references/form/layout-components.md`, and `references/form/data-components.md`

#### Scenario: Router excludes action/role and placeholder README paths

- **WHEN** `plugin/skills/formio-schema/SKILL.md` is parsed
- **THEN** its body SHALL NOT reference `references/action/` or `references/role/`
- **AND** its body SHALL NOT reference `references/submission/README.md` or `references/project/README.md`

### Requirement: Authored submission-domain references

`plugin/skills/formio-schema/references/submission/` SHALL contain exactly the following authored reference files, each non-empty and each carrying NO YAML frontmatter:

- `submission-definition.md`
- `submission-state.md`
- `submission-metadata.md`
- `submission-access.md`
- `submission-data.md`

`plugin/skills/formio-schema/references/submission/README.md` SHALL NOT exist — the router `SKILL.md` is the authoritative submission index.

#### Scenario: Every submission reference file exists and is non-empty

- **WHEN** `plugin/skills/formio-schema/references/submission/` is listed
- **THEN** it SHALL contain `submission-definition.md`, `submission-state.md`, `submission-metadata.md`, `submission-access.md`, and `submission-data.md`
- **AND** each file SHALL be non-empty
- **AND** none of those files SHALL begin with `---`
- **AND** `submission/README.md` SHALL NOT exist

#### Scenario: submission-definition.md documents every top-level property

- **WHEN** `plugin/skills/formio-schema/references/submission/submission-definition.md` is read
- **THEN** its body SHALL mention each of these property names: `_id`, `_fvid`, `form`, `project`, `owner`, `roles`, `state`, `access`, `metadata`, `data`, `externalIds`, `externalTokens`, `permission`, `created`, `modified`, `deleted`

#### Scenario: submission-state.md documents both lifecycle values

- **WHEN** `plugin/skills/formio-schema/references/submission/submission-state.md` is read
- **THEN** its body SHALL mention the string value `draft` and the string value `submitted`

#### Scenario: submission-metadata.md documents every documented metadata key

- **WHEN** `plugin/skills/formio-schema/references/submission/submission-metadata.md` is read
- **THEN** its body SHALL mention each of these keys: `timezone`, `offset`, `origin`, `referrer`, `browserName`, `userAgent`, `pathName`, `onLine`, `language`, `headers`, `ssoteam`, `memberCount`, `selectData`
- **AND** the body SHALL state that the metadata object is extensible (open-ended)

#### Scenario: submission-access.md documents every AccessType value

- **WHEN** `plugin/skills/formio-schema/references/submission/submission-access.md` is read
- **THEN** its body SHALL mention each of these access type values: `self`, `create_own`, `create_all`, `read_own`, `read_all`, `update_own`, `update_all`, `delete_own`, `delete_all`, `team_read`, `team_write`, `team_admin`, `team_access`

#### Scenario: submission-data.md cross-links to the form references for per-component value shapes

- **WHEN** `plugin/skills/formio-schema/references/submission/submission-data.md` is read
- **THEN** its body SHALL reference at least one path under `references/form/` (e.g., `references/form/input-components.md` or `references/form/data-components.md`)

### Requirement: Router SKILL.md indexes the submission domain

`plugin/skills/formio-schema/SKILL.md` SHALL list the submission domain as an authored domain — not as a "not yet authored" placeholder — with its own multi-row reference table (or equivalent structured list) enumerating all five authored submission references. The submission row SHALL NOT appear in any "not yet authored" table or paragraph.

#### Scenario: Router enumerates every submission reference

- **WHEN** `plugin/skills/formio-schema/SKILL.md` is parsed
- **THEN** its body SHALL reference the paths `references/submission/submission-definition.md`, `references/submission/submission-state.md`, `references/submission/submission-metadata.md`, `references/submission/submission-access.md`, and `references/submission/submission-data.md`
- **AND** its body SHALL NOT reference the path `references/submission/README.md`

### Requirement: Authored project-domain references

`plugin/skills/formio-schema/references/project/` SHALL contain exactly the following authored reference files, each non-empty and each carrying NO YAML frontmatter:

- `project-definition.md`
- `project-type-and-framework.md`
- `project-settings.md`
- `project-access.md`

Billing and usage statistics SHALL NOT be a separate authored reference. The `billing`, `apiCalls`, `trial`, and `lastDeploy` fields appear as one-line rows in `project-definition.md`'s property table and SHALL NOT receive a dedicated reference file — they are operator/SaaS concerns, not schema-authoring concerns.

`plugin/skills/formio-schema/references/project/project-billing-and-usage.md` SHALL NOT exist.

`plugin/skills/formio-schema/references/project/README.md` SHALL NOT exist — the router `SKILL.md` is the authoritative project index.

#### Scenario: Every project reference file exists and is non-empty

- **WHEN** `plugin/skills/formio-schema/references/project/` is listed
- **THEN** it SHALL contain `project-definition.md`, `project-type-and-framework.md`, `project-settings.md`, and `project-access.md`
- **AND** each file SHALL be non-empty
- **AND** none of those files SHALL begin with `---`
- **AND** `project/README.md` SHALL NOT exist
- **AND** `project/project-billing-and-usage.md` SHALL NOT exist

#### Scenario: project-definition.md documents every top-level property

- **WHEN** `plugin/skills/formio-schema/references/project/project-definition.md` is read
- **THEN** its body SHALL mention each of these property names: `_id`, `title`, `name`, `type`, `description`, `tag`, `owner`, `externalOwner`, `project`, `remote`, `plan`, `billing`, `apiCalls`, `steps`, `framework`, `primary`, `access`, `trial`, `lastDeploy`, `stageTitle`, `machineName`, `config`, `protect`, `settings`, `remoteSecret`, `builderConfig`, `formDefaults`, `public`, `created`, `modified`, `deleted`

#### Scenario: project-type-and-framework.md enumerates every type and framework value

- **WHEN** `plugin/skills/formio-schema/references/project/project-type-and-framework.md` is read
- **THEN** its body SHALL mention each ProjectType value: `project`, `stage`, `tenant`
- **AND** its body SHALL mention each ProjectFramework value: `angular`, `angular2`, `react`, `vue`, `html5`, `simple`, `custom`, `aurelia`, `javascript`

#### Scenario: project-type-and-framework.md documents the Stage and Tenant creation patterns

- **WHEN** `plugin/skills/formio-schema/references/project/project-type-and-framework.md` is read
- **THEN** its body SHALL contain the literal string `"type": "stage"`
- **AND** its body SHALL contain the literal string `"type": "tenant"`
- **AND** its body SHALL state that a Stage's `project` field is set to the parent project's ObjectId
- **AND** its body SHALL state that the parent is typically the portal (or primary) project

#### Scenario: project-definition.md notes deployed projects use plan "commercial"

- **WHEN** `plugin/skills/formio-schema/references/project/project-definition.md` is read
- **THEN** its body SHALL mention the string value `commercial` in the context of the `plan` field

#### Scenario: project-settings.md documents every ProjectSettings key and the encryption contract

- **WHEN** `plugin/skills/formio-schema/references/project/project-settings.md` is read
- **THEN** its body SHALL mention each of these keys: `appOrigin`, `keys`, `cors`, `csp`, `secret`, `pdfserver`, `filetoken`, `allowConfig`, `allowConfigToForms`, `custom`, `formModule`, `email`, `captcha`, `recaptcha`, `esign`, `google`, `kickbox`, `sqlconnector`, `storage`, `tokenParse`, `oauth`, `ldap`, `saml`
- **AND** its body SHALL state that the `settings` object is encrypted at rest

#### Scenario: project-access.md documents the project access types

- **WHEN** `plugin/skills/formio-schema/references/project/project-access.md` is read
- **THEN** its body SHALL mention `ProjectRole`, `ProjectFormAccess`, and `ProjectAccessInfo`
- **AND** its body SHALL distinguish project-level access from form-level and submission-level access

### Requirement: Router SKILL.md indexes the project domain

`plugin/skills/formio-schema/SKILL.md` SHALL list the project domain as an authored domain — not as a "not yet authored" placeholder — with its own multi-row reference table (or equivalent structured list) enumerating all four authored project references. The project row SHALL NOT appear in any "not yet authored" table or paragraph. The router body SHALL NOT reference a billing-and-usage file.

#### Scenario: Router enumerates every project reference

- **WHEN** `plugin/skills/formio-schema/SKILL.md` is parsed
- **THEN** its body SHALL reference the paths `references/project/project-definition.md`, `references/project/project-type-and-framework.md`, `references/project/project-settings.md`, and `references/project/project-access.md`
- **AND** its body SHALL NOT reference the path `references/project/README.md`
- **AND** its body SHALL NOT reference any `references/project/project-billing-and-usage.md` path
