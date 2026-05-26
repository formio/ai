## ADDED Requirements

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

## MODIFIED Requirements

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

`plugin/skills/formio-schema/references/` SHALL NOT contain any `.md` file directly (only subdirectories).

The placeholder schema domain `project` SHALL be present as a subdirectory containing at minimum a `README.md` that describes what that domain will document and directs the user to the corresponding `formio-api` reference until the domain is authored. The `submission` domain is no longer a placeholder.

#### Scenario: References live under domain subdirectories

- **WHEN** `plugin/skills/formio-schema/references/` is listed
- **THEN** its subdirectories SHALL be exactly `form/`, `submission/`, and `project/`
- **AND** it SHALL NOT contain `action/` or `role/` subdirectories
- **AND** it SHALL NOT contain any `.md` files at its top level

#### Scenario: Form domain has the full reference set

- **WHEN** `plugin/skills/formio-schema/references/form/` is listed
- **THEN** it SHALL contain `form-definition.md`, `base-component.md`, `input-components.md`, `layout-components.md`, and `data-components.md`
- **AND** every file in `references/form/` SHALL be non-empty

#### Scenario: Project placeholder routes to formio-api

- **WHEN** `plugin/skills/formio-schema/references/project/README.md` is read
- **THEN** the README SHALL be non-empty
- **AND** the README SHALL state that the domain is not yet authored
- **AND** the README SHALL name the `formio-api` reference `platform-projects` as the interim source of truth

### Requirement: Router SKILL.md indexes every domain

`plugin/skills/formio-schema/SKILL.md` SHALL contain a table (or equivalent structured list) that maps each domain to its references. The form domain SHALL list all five form references with their relative paths under `references/form/`. The submission domain SHALL list all five authored submission references with their relative paths under `references/submission/`. The project domain SHALL be listed with a "not yet authored" status and a pointer to the placeholder `README.md` plus the `formio-api` `platform-projects` reference. The router body SHALL NOT list `action` or `role` as domains owned by this skill.

#### Scenario: Router enumerates all five form-domain references

- **WHEN** `plugin/skills/formio-schema/SKILL.md` is parsed
- **THEN** its body SHALL reference the paths `references/form/form-definition.md`, `references/form/base-component.md`, `references/form/input-components.md`, `references/form/layout-components.md`, and `references/form/data-components.md`

#### Scenario: Router enumerates the project placeholder and excludes action/role

- **WHEN** `plugin/skills/formio-schema/SKILL.md` is parsed
- **THEN** its body SHALL reference the path `references/project/README.md`
- **AND** its body SHALL NOT reference `references/action/` or `references/role/`
- **AND** its body SHALL NOT reference `references/submission/README.md`
