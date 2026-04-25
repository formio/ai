## ADDED Requirements

### Requirement: Consolidated Form.io API skill structure

The Form.io API skill library SHALL be implemented as a single activatable skill at `plugin/skills/formio-api/SKILL.md` whose body indexes per-capability-group reference documents stored under `plugin/skills/formio-api/references/<group>.md`.

Reference documents SHALL NOT have YAML frontmatter. Only the router `SKILL.md` carries frontmatter (`name: formio-api`, `description`).

The library SHALL cover these 17 capability groups as reference documents:

- `platform-auth`, `platform-projects`, `platform-teams`, `platform-staging`, `platform-tenants` (platform scope)
- `project-auth`, `project-roles`, `project-forms`, `project-form-revisions`, `project-actions` (project scope)
- `runtime-auth`, `runtime-custom-users`, `runtime-access-control`, `runtime-reports`, `runtime-submissions` (runtime scope)
- `pdf-api` (pdf scope)
- `server-status` (platform scope, unauthenticated)

#### Scenario: Router skill exists with correct frontmatter

- **WHEN** `plugin/skills/formio-api/SKILL.md` is parsed
- **THEN** its frontmatter SHALL contain exactly `name` and `description`
- **AND** `name` SHALL equal `formio-api`

#### Scenario: Every required reference group has a file

- **WHEN** the library is inspected
- **THEN** `plugin/skills/formio-api/references/<group>.md` SHALL exist and be non-empty for every group in `REQUIRED_REFERENCE_GROUPS`

#### Scenario: Reference files have no frontmatter

- **WHEN** any `plugin/skills/formio-api/references/*.md` is parsed
- **THEN** the parsed frontmatter SHALL be empty (the file SHALL NOT begin with `---`)
