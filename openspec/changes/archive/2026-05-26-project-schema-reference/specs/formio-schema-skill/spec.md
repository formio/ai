## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: Domain-partitioned references directory

The skill's reference documents SHALL live under `plugin/skills/formio-schema/references/<domain>/`, with one subdirectory per Form.io schema domain. The directory layout SHALL be additive: adding a new schema domain creates a new subdirectory under `references/` rather than placing files at the top level.

The set of domains the skill owns SHALL be exactly `form`, `submission`, and `project`. Action JSON and role JSON SHALL NOT be domains of this skill — there SHALL be no `references/action/` or `references/role/` subdirectory.

`plugin/skills/formio-schema/references/form/` SHALL contain the form-domain references:

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

#### Scenario: Router excludes action/role/role and placeholder README paths

- **WHEN** `plugin/skills/formio-schema/SKILL.md` is parsed
- **THEN** its body SHALL NOT reference `references/action/` or `references/role/`
- **AND** its body SHALL NOT reference `references/submission/README.md` or `references/project/README.md`
