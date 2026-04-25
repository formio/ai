## ADDED Requirements

### Requirement: Automated validation suite

The repository SHALL include an automated validation suite that verifies every skill file in `skills/formio-api/` against the authoring rules. The suite SHALL run as part of `pnpm test` and SHALL fail the test run if any skill violates the rules.

#### Scenario: Validation runs under pnpm test

- **WHEN** a developer runs `pnpm test` from the repository root
- **THEN** the skills-library validation suite executes
- **AND** its pass/fail status affects the overall exit code

#### Scenario: Validation fails loudly on violation

- **WHEN** any skill file has a missing frontmatter key, wrong `auth` value, missing required section, or forbidden legacy reference
- **THEN** the validation suite fails
- **AND** the failing test output names the skill file and the specific rule violated

### Requirement: Required-file coverage check

The validation suite SHALL verify that every skill file required by `api-skills-library` is present. Missing files SHALL cause a test failure naming each missing path.

#### Scenario: Missing required file fails validation

- **WHEN** `skills/formio-api/project-forms.md` is deleted
- **THEN** `pnpm test` fails
- **AND** the failure message includes the path `skills/formio-api/project-forms.md`

#### Scenario: Extra files are tolerated

- **WHEN** an additional file `skills/formio-api/custom-notes.md` is added with valid frontmatter and structure
- **THEN** the validation suite does not fail solely on the presence of the extra file
- **AND** the extra file is still validated against the authoring rules

### Requirement: Frontmatter and structural assertions

The validation suite SHALL assert each of the following for every skill file (excluding `README.md`):

1. Frontmatter contains exactly the keys `name`, `description`, `scope`, `root_url`, `auth`
2. `name` equals the filename stem
3. `auth` equals `pkce-jwt`
4. `scope` ↔ `root_url` relationship is consistent per the authoring spec
5. Required headings (`## Overview`, `## Root URL`, `## Authentication`, `## Endpoints`, `## Related Skills`) appear in order
6. Canonical authentication paragraph is present (except for `server-status.md`)
7. Legacy auth references (`x-token`, `FORMIO_API_KEY`, `api key`) are absent
8. Postman placeholder `{{baseUrl}}/{{projectName}}` is absent in project-, runtime-, and pdf-scope skills
9. Postman placeholder `{{baseUrl}}/` (bare prefix) is absent in platform-scope skills. Any `scope: server` value fails validation because `server` is not an allowed scope.
10. PDF-scope skills only document endpoints beginning with `${FORMIO_PROJECT_URL}/pdf-proxy`; no "PDF server direct API" endpoint appears
11. Terminology consistency — the tokens `baseUrl` / `base_url` SHALL appear only adjacent to `FORMIO_BASE_URL` (or inside a quoted Postman placeholder `{{baseUrl}}`); `projectUrl` / `project_url` SHALL appear only adjacent to `FORMIO_PROJECT_URL`. A sentence that uses `baseUrl` to refer to the project endpoint, or vice versa, SHALL fail validation.

#### Scenario: Wrong auth value fails validation

- **WHEN** a skill sets `auth: api-key` in frontmatter
- **THEN** validation fails with a message identifying the skill and the `auth` rule

#### Scenario: Missing section fails validation

- **WHEN** a skill omits the `## Endpoints` heading
- **THEN** validation fails with a message identifying the skill and the missing heading

#### Scenario: Forbidden reference fails validation

- **WHEN** a skill body contains the string `x-token` anywhere outside a code-fence showing forbidden usage
- **THEN** validation fails with a message identifying the skill and the forbidden token

#### Scenario: PDF direct API content fails validation

- **WHEN** `pdf-api.md` documents an endpoint whose path does not begin with `${FORMIO_PROJECT_URL}/pdf-proxy`
- **THEN** validation fails and names the offending endpoint
- **AND** the failure message references the "PDF server direct API is out of scope" rule

### Requirement: Index skill validation

The validation suite SHALL verify that `skills/formio-api/README.md` lists every capability-group skill required by the library spec. Adding a new required skill file without updating the index SHALL cause a test failure.

#### Scenario: Missing link in index fails validation

- **WHEN** a required skill file exists but is not linked from `README.md`
- **THEN** validation fails and names the skill file that is missing from the index

#### Scenario: Link target must resolve

- **WHEN** `README.md` links to `./nonexistent.md`
- **THEN** validation fails because the link target does not exist
