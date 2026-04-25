## ADDED Requirements

### Requirement: Skills library directory layout

The project SHALL contain a dedicated Form.io API skills library at `skills/formio-api/`. The library SHALL be organized as a flat directory of Markdown skill files, one per API capability group, plus a single index skill (`README.md`). No nested sub-directories are permitted within `skills/formio-api/` other than an optional `_partials/` directory reserved for authoring helpers (initially unused).

#### Scenario: Library directory exists at expected path

- **WHEN** the repository is checked out fresh
- **THEN** the path `skills/formio-api/` exists and is a directory
- **AND** the path `skills/formio-api/README.md` exists

#### Scenario: No unexpected nesting

- **WHEN** the library directory is inspected
- **THEN** every `.md` file (other than `README.md`) sits directly under `skills/formio-api/`
- **AND** no capability-group skill is placed inside a sub-directory

### Requirement: Complete API coverage

The library SHALL include one skill file for each capability group enumerated below, covering every endpoint documented in the Form.io Postman collection. Merged groups (PDF, runtime access control) are explicitly allowed per design.

Required skill files:

- `platform-auth.md`
- `platform-projects.md`
- `platform-teams.md`
- `platform-staging.md`
- `platform-tenants.md`
- `project-auth.md`
- `project-roles.md`
- `project-forms.md`
- `project-form-revisions.md`
- `project-actions.md`
- `runtime-auth.md`
- `runtime-custom-users.md`
- `runtime-access-control.md`
- `runtime-reports.md`
- `runtime-submissions.md`
- `pdf-api.md`
- `server-status.md`

#### Scenario: All required skill files are present

- **WHEN** the library directory is enumerated
- **THEN** every filename listed above exists as a regular file
- **AND** no required file is a zero-byte placeholder

#### Scenario: Every documented endpoint maps to a skill

- **WHEN** an agent receives a user request referencing any endpoint from the Postman collection
- **THEN** exactly one skill in the library covers that endpoint in its `## Endpoints` section

### Requirement: Index skill routes between sub-skills

The `skills/formio-api/README.md` index skill SHALL provide a scope map (Platform / Project / Runtime / PDF / Server) and SHALL list every capability-group skill with a one-line description and a relative link. The index skill SHALL NOT duplicate endpoint documentation — its sole role is routing.

#### Scenario: Index lists every sub-skill

- **WHEN** a reader opens `skills/formio-api/README.md`
- **THEN** the file contains a scope map section grouping skills by scope
- **AND** each capability-group skill required by the coverage requirement is linked exactly once

#### Scenario: Index does not duplicate endpoint docs

- **WHEN** the index skill is inspected
- **THEN** it does not contain endpoint method/path documentation
- **AND** it does not contain request/response payload examples

### Requirement: Skill activation is deterministic per capability group

Each skill SHALL declare a `description` in its frontmatter that is specific enough for Claude's skill router to select only that skill for requests in its capability area. Two skills in the library SHALL NOT have overlapping descriptions that would both match the same user request.

#### Scenario: Descriptions are scope-qualified

- **WHEN** a skill covers a project-scope capability
- **THEN** its description explicitly mentions the project scope (e.g., "project admin", "form-level")
- **AND** does not use generic wording that would also match platform- or runtime-scope requests

#### Scenario: Authentication skills are disambiguated

- **WHEN** both `platform-auth.md` and `project-auth.md` and `runtime-auth.md` are present
- **THEN** each description names its intended audience (platform admin, project admin, end-user)
- **AND** no two descriptions share wording that would make Claude's router ambiguous
