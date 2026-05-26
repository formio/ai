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

`plugin/skills/formio-schema/references/` SHALL NOT contain any `.md` file directly (only subdirectories).

The placeholder schema domains `submission` and `project` SHALL each be present as a subdirectory containing at minimum a `README.md` that describes what that domain will document and directs the user to the corresponding `formio-api` reference until the domain is authored.

#### Scenario: References live under domain subdirectories

- **WHEN** `plugin/skills/formio-schema/references/` is listed
- **THEN** its subdirectories SHALL be exactly `form/`, `submission/`, and `project/`
- **AND** it SHALL NOT contain `action/` or `role/` subdirectories
- **AND** it SHALL NOT contain any `.md` files at its top level

#### Scenario: Form domain has the full reference set

- **WHEN** `plugin/skills/formio-schema/references/form/` is listed
- **THEN** it SHALL contain `form-definition.md`, `base-component.md`, `input-components.md`, `layout-components.md`, and `data-components.md`
- **AND** every file in `references/form/` SHALL be non-empty

#### Scenario: Placeholder domains route to formio-api

- **WHEN** `plugin/skills/formio-schema/references/<domain>/README.md` is read for any `<domain>` in `{submission, project}`
- **THEN** the README SHALL be non-empty
- **AND** the README SHALL state that the domain is not yet authored
- **AND** the README SHALL name the corresponding `formio-api` reference document (`runtime-submissions` for submission, `platform-projects` for project) as the interim source of truth

### Requirement: Router SKILL.md indexes every domain

`plugin/skills/formio-schema/SKILL.md` SHALL contain a table (or equivalent structured list) that maps each domain to its references. The form domain SHALL list all five form references with their relative paths under `references/form/`. The submission and project domains SHALL each be listed with a "not yet authored" status and a pointer to the placeholder `README.md` plus the relevant `formio-api` reference. The router body SHALL NOT list `action` or `role` as domains owned by this skill.

#### Scenario: Router enumerates all five form-domain references

- **WHEN** `plugin/skills/formio-schema/SKILL.md` is parsed
- **THEN** its body SHALL reference the paths `references/form/form-definition.md`, `references/form/base-component.md`, `references/form/input-components.md`, `references/form/layout-components.md`, and `references/form/data-components.md`

#### Scenario: Router enumerates the placeholder domains and excludes action/role

- **WHEN** `plugin/skills/formio-schema/SKILL.md` is parsed
- **THEN** its body SHALL reference the paths `references/submission/README.md` and `references/project/README.md`
- **AND** its body SHALL NOT reference `references/action/` or `references/role/`
