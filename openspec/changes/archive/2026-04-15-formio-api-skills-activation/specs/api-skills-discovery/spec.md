## ADDED Requirements

### Requirement: Skills MUST live under the project-level `.claude/skills/` directory

Every Form.io API skill SHALL be stored at `<project>/.claude/skills/<skill-name>/SKILL.md` so that Claude Code's native skill loader enumerates it. Skills MUST NOT be stored at `skills/formio-api/`, at `~/.claude/skills/`, or at any other path.

#### Scenario: Capability-group skill is located at the project-level path

- **WHEN** a capability-group skill named `formio-api/references/project-forms` is created
- **THEN** its content file SHALL be `plugin/skills/formio-api/references/project-forms.md`
- **AND** no other file for that skill SHALL exist under `skills/formio-api/`

#### Scenario: Library validation fails when a required skill is outside `.claude/skills/`

- **WHEN** `validateLibrary` is invoked against the repository
- **AND** any required skill from the canonical list is present under `skills/formio-api/` instead of `.claude/skills/`
- **THEN** validation SHALL fail with a `library.required_file` issue pointing at the expected `.claude/skills/<name>/SKILL.md` path

### Requirement: Skill directories MUST use the `formio-api-` namespace prefix

Every capability-group skill directory and its frontmatter `name` field SHALL use the prefix `formio-api-` followed by the capability group slug (e.g., `formio-api/references/project-forms`, `formio-api/references/runtime-submissions`). The router skill SHALL use the bare name `formio-api`.

#### Scenario: Capability-group skill name matches its directory

- **WHEN** a skill file at `plugin/skills/formio-api/references/project-forms.md` is validated
- **THEN** the frontmatter `name` field SHALL equal `formio-api/references/project-forms`

#### Scenario: Router skill uses the bare namespace name

- **WHEN** the router skill at `.claude/skills/formio-api/SKILL.md` is validated
- **THEN** the frontmatter `name` field SHALL equal `formio-api`

### Requirement: The canonical skill directory set MUST be complete

The validator SHALL maintain a canonical list of 17 capability-group skill directories plus 1 router directory. Validation SHALL fail if any directory on that list is missing its `SKILL.md` file or if the `SKILL.md` file is empty.

The 17 capability-group directories are:

`formio-api/references/platform-auth`, `formio-api/references/platform-projects`, `formio-api/references/platform-teams`, `formio-api/references/platform-staging`, `formio-api/references/platform-tenants`, `formio-api/references/project-auth`, `formio-api/references/project-roles`, `formio-api/references/project-forms`, `formio-api/references/project-form-revisions`, `formio-api/references/project-actions`, `formio-api/references/runtime-auth`, `formio-api/references/runtime-custom-users`, `formio-api/references/runtime-access-control`, `formio-api/references/runtime-reports`, `formio-api/references/runtime-submissions`, `formio-api/references/pdf-api`, `formio-api/references/server-status`.

#### Scenario: Missing capability-group directory fails validation

- **WHEN** one of the 17 required directories has no `SKILL.md`
- **THEN** validation SHALL emit a `library.required_file` issue naming the missing path

#### Scenario: Empty SKILL.md fails validation

- **WHEN** a required `SKILL.md` exists but is zero bytes
- **THEN** validation SHALL emit a `library.required_file` issue indicating the empty file

### Requirement: The old flat library path MUST be removed

After this change is applied, the directory `skills/formio-api/` SHALL NOT exist in the repository. No redirect stubs, placeholder files, or symbolic links SHALL be left behind.

#### Scenario: Flat legacy directory is absent after change applies

- **WHEN** the repository is inspected after this change is applied
- **THEN** the path `skills/formio-api/` SHALL NOT exist

### Requirement: The router skill MUST be pointer-only

The router skill at `.claude/skills/formio-api/SKILL.md` SHALL contain the capability map and links to every sibling skill. It SHALL NOT contain endpoint documentation (no `### <METHOD> <path>` headings) and SHALL NOT declare `scope`, `root_url`, or `auth` frontmatter fields.

#### Scenario: Router skill has no endpoint headings

- **WHEN** the router `SKILL.md` is parsed
- **THEN** no line SHALL match the pattern `^###\s+(GET|POST|PUT|PATCH|DELETE)\s+`
- **AND** its frontmatter SHALL contain only `name` and `description`

#### Scenario: Router skill links to every required sibling

- **WHEN** the router `SKILL.md` is scanned for Markdown links
- **THEN** every required capability-group directory SHALL be linked at least once
- **AND** every link target SHALL resolve to an existing `SKILL.md` file on disk

### Requirement: CLAUDE.md and README.md MUST point to the new library root

Repository-level documentation SHALL reference `.claude/skills/` as the Form.io API skills library location. References to `skills/formio-api/` SHALL be removed.

#### Scenario: CLAUDE.md references the new library path

- **WHEN** `CLAUDE.md` is inspected
- **THEN** the "Skills Library" section SHALL reference `.claude/skills/` (or a specific child path within it)
- **AND** SHALL NOT reference `skills/formio-api/`

#### Scenario: README.md pointers are updated

- **WHEN** `README.md` is inspected
- **THEN** any link to the skills library SHALL target a path under `.claude/skills/`
