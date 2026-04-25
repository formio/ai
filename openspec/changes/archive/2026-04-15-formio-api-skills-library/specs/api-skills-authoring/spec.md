## ADDED Requirements

### Requirement: Terminology

Skills and skill-related documentation SHALL use the following terms consistently. These terms are NOT interchangeable, and any skill violating these meanings SHALL fail validation.

- `baseUrl` / `base_url` → refers ONLY to the **platform deployment endpoint**, which resolves to the `FORMIO_BASE_URL` environment variable. It is the Postman collection's `{{baseUrl}}` variable when that placeholder appears bare (not followed by `{{projectName}}`).
- `projectUrl` / `project_url` / `{{baseUrl}}/{{projectName}}` → refers ONLY to the **project endpoint**, which resolves to the `FORMIO_PROJECT_URL` environment variable.
- `FORMIO_BASE_URL` and `FORMIO_PROJECT_URL` are distinct; `FORMIO_PROJECT_URL` is a sub-path of `FORMIO_BASE_URL` in the Postman collection's URL construction, but skills SHALL NOT derive one from the other. Each is used only where the API documentation dictates.

#### Scenario: Prose uses "baseUrl" only for platform

- **WHEN** a skill body uses the word `baseUrl` or `base_url` (outside of quoted Postman placeholders)
- **THEN** the surrounding sentence refers to the platform deployment endpoint
- **AND** the skill does not conflate `baseUrl` with the project endpoint

#### Scenario: Prose uses "projectUrl" only for project endpoint

- **WHEN** a skill body uses the phrase `projectUrl`, `project_url`, or refers to the project endpoint
- **THEN** the surrounding sentence refers to `FORMIO_PROJECT_URL` (equivalent to Postman's `{{baseUrl}}/{{projectName}}`)
- **AND** the skill does not conflate it with `FORMIO_BASE_URL`

### Requirement: Frontmatter schema

Every skill file in `skills/formio-api/` (excluding `README.md`) SHALL begin with a YAML frontmatter block containing exactly the following keys with valid values:

- `name` (string, kebab-case) — MUST equal the filename without the `.md` extension
- `description` (string, single sentence) — MUST describe the capability covered and its scope
- `scope` (enum) — MUST be one of: `platform`, `project`, `runtime`, `pdf`. The Postman "Server API" (Health, Status) is NOT a separate scope; its skill file SHALL use `scope: platform`.
- `root_url` (enum) — MUST be one of: `FORMIO_PROJECT_URL`, `FORMIO_BASE_URL`
- `auth` (constant) — MUST be the literal string `pkce-jwt`

#### Scenario: Frontmatter parses and contains required keys

- **WHEN** any skill file is parsed as YAML frontmatter + Markdown body
- **THEN** the frontmatter contains exactly the keys `name`, `description`, `scope`, `root_url`, and `auth`
- **AND** no additional top-level keys are present

#### Scenario: `name` matches filename

- **WHEN** a skill file at `skills/formio-api/<filename>.md` is parsed
- **THEN** its `name` frontmatter value equals `<filename>`

#### Scenario: `auth` is always pkce-jwt

- **WHEN** any skill in the library is parsed
- **THEN** its `auth` value is the literal string `pkce-jwt`
- **AND** any other value causes validation to fail

### Requirement: Scope and root URL consistency

The `root_url` value SHALL be consistent with the `scope` value according to the following mapping:

- `scope: project` → `root_url: FORMIO_PROJECT_URL`
- `scope: runtime` → `root_url: FORMIO_PROJECT_URL`
- `scope: pdf` → `root_url: FORMIO_PROJECT_URL` (PDF operations are proxied through `${FORMIO_PROJECT_URL}/pdf-proxy`; the Postman "PDF server direct API" group is out of scope)
- `scope: platform` → `root_url: FORMIO_BASE_URL` (this also covers `server-status.md`, since Server API shares the platform root)

#### Scenario: Project-scope skill references FORMIO_PROJECT_URL

- **WHEN** a skill has `scope: project`
- **THEN** its `root_url` is `FORMIO_PROJECT_URL`
- **AND** no occurrence of `{{baseUrl}}/{{projectName}}` appears in its body (it must be resolved to `${FORMIO_PROJECT_URL}`)

#### Scenario: Runtime-scope skill references FORMIO_PROJECT_URL

- **WHEN** a skill has `scope: runtime`
- **THEN** its `root_url` is `FORMIO_PROJECT_URL`
- **AND** no occurrence of `{{baseUrl}}/{{projectName}}` appears in its body

#### Scenario: PDF-scope skill references FORMIO_PROJECT_URL via pdf-proxy

- **WHEN** a skill has `scope: pdf`
- **THEN** its `root_url` is `FORMIO_PROJECT_URL`
- **AND** every documented endpoint path begins with `${FORMIO_PROJECT_URL}/pdf-proxy`
- **AND** the skill does not document any endpoint from the Postman "PDF server direct API" group

#### Scenario: Platform-scope skill references FORMIO_BASE_URL

- **WHEN** a skill has `scope: platform`
- **THEN** its `root_url` is `FORMIO_BASE_URL`
- **AND** every documented endpoint path begins with `${FORMIO_BASE_URL}/`
- **AND** no occurrence of `{{baseUrl}}/` (bare or followed by `{{projectName}}`) appears in its body

#### Scenario: server-status.md is platform-scoped

- **WHEN** the file `server-status.md` is validated
- **THEN** its `scope` is `platform` (not `server`)
- **AND** its `root_url` is `FORMIO_BASE_URL`
- **AND** any `scope: server` value in any skill file fails validation because `server` is not an allowed scope

### Requirement: Required body sections

The Markdown body of every skill file (excluding `README.md`) SHALL contain the following second-level headings in this order: `## Overview`, `## Root URL`, `## Authentication`, `## Endpoints`, `## Related Skills`.

#### Scenario: All required sections present and ordered

- **WHEN** a skill file's body is parsed
- **THEN** the five required headings appear as level-2 Markdown headings
- **AND** they appear in the specified order
- **AND** no required heading is missing

#### Scenario: No renaming of required sections

- **WHEN** a skill uses a heading named similarly (e.g., `## Auth`, `## Endpoint`)
- **THEN** validation fails and requires the exact heading text

### Requirement: Canonical authentication paragraph

The `## Authentication` section of every skill file (excluding `README.md` and `server-status.md`) SHALL contain the canonical authentication paragraph verbatim. The canonical text SHALL reference: PKCE flow, the `x-jwt-token` header, and the MCP server's `user-auth` capability.

#### Scenario: Authentication paragraph matches canonical text

- **WHEN** a skill file is parsed
- **THEN** its `## Authentication` section contains the canonical paragraph string exactly
- **AND** any drift (added/removed words, reformatting) causes validation to fail

#### Scenario: server-status.md is exempt

- **WHEN** `server-status.md` is validated
- **THEN** the canonical authentication paragraph is not required because server status endpoints do not require auth
- **AND** the `## Authentication` section may instead state that the endpoints are unauthenticated

### Requirement: Endpoint documentation format

Every endpoint documented under `## Endpoints` SHALL include: a level-3 heading of the form `### <METHOD> <PATH>`, a one-sentence description, a parameters table (if any), a request body example (for `POST`, `PUT`, `PATCH`), a response example, and an error-behavior note.

#### Scenario: Endpoint has required sub-parts

- **WHEN** a reader inspects any endpoint subsection
- **THEN** an HTTP method and path appear in the heading
- **AND** a description sentence follows
- **AND** a worked example is provided

#### Scenario: Paths use FORMIO_PROJECT_URL substitution

- **WHEN** an endpoint in a project-, runtime-, or pdf-scope skill documents its path
- **THEN** the path is expressed as `${FORMIO_PROJECT_URL}/<rest-of-path>` (or `${FORMIO_PROJECT_URL}/pdf-proxy/<rest-of-path>` for pdf scope)
- **AND** the literal Postman placeholder `{{baseUrl}}/{{projectName}}` does not appear

#### Scenario: Paths use FORMIO_BASE_URL substitution

- **WHEN** an endpoint in a platform-scope skill documents its path
- **THEN** the path is expressed as `${FORMIO_BASE_URL}/<rest-of-path>`
- **AND** the literal Postman placeholder `{{baseUrl}}/` does not appear as a bare prefix

### Requirement: No legacy auth references

Skill content SHALL NOT reference the legacy `x-token` header, the `FORMIO_API_KEY` environment variable, or API-key-based authentication in any example, guidance, or prose.

#### Scenario: API-key references are forbidden

- **WHEN** any skill file body is scanned
- **THEN** the strings `x-token`, `FORMIO_API_KEY`, and `api key` (case-insensitive) are absent
- **AND** validation fails if any are present
