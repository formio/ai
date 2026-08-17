## Purpose

Defines the authoring rules for the Form.io API reference library: strict URL terminology, the consolidated layout a new reference group must follow, how a group is removed, how scope determines the root URL, and the format each endpoint is documented in.

## Requirements

### Requirement: Terminology

Reference documents and the router skill SHALL use the following terms consistently. These terms are NOT interchangeable, and any drift SHALL fail validation.

- `baseUrl` / `base_url` → refers ONLY to the **platform deployment endpoint**, which resolves to the `FORMIO_BASE_URL` environment variable.
- `projectUrl` / `project_url` / `{{baseUrl}}/{{projectName}}` → refers ONLY to the **project endpoint**, which resolves to the `FORMIO_PROJECT_URL` environment variable.
- `FORMIO_BASE_URL` and `FORMIO_PROJECT_URL` are distinct environment variables. References SHALL NOT derive one from the other.

#### Scenario: Each term names only its own endpoint

- **WHEN** a reference documents a platform-scope endpoint
- **THEN** it SHALL root that endpoint at `${FORMIO_BASE_URL}`
- **AND** a reference documenting a project-scope endpoint SHALL root it at `${FORMIO_PROJECT_URL}`
- **AND** neither document SHALL use the two terms as though they were interchangeable

#### Scenario: Deriving one URL from the other is non-conformant

- **WHEN** a reference builds a project URL by appending a project name to `${FORMIO_BASE_URL}`, or infers a base URL from a project URL
- **THEN** the reference SHALL be treated as non-conformant
- **AND** the reason SHALL be that a customer deployment may route projects to sibling sub-domains, where the two hosts differ and neither can be reconstructed from the other

### Requirement: New API reference docs follow the consolidated layout

To add a new Form.io API capability group to the reference library, authors SHALL:

1. Create `plugin/skills/formio-api/references/<group>.md` (no frontmatter).
2. Include the five required section headings in order: `## Overview`, `## Root URL`, `## Authentication`, `## MCP Tool Preference`, `## Endpoints`.
3. Include the canonical auth paragraph in the `## Authentication` section (unless the group is unauthenticated like `server-status`).
4. Document endpoints with `### <METHOD> <url>` headings using resolved `${FORMIO_BASE_URL}` or `${FORMIO_PROJECT_URL}` (NOT raw Postman `{{baseUrl}}` / `{{projectName}}` placeholders outside code fences).
5. Add the group name to `REQUIRED_REFERENCE_GROUPS` in `packages/mcp-server/src/skills-validator.ts`.
6. Add a scope entry for the group in `GROUP_SCOPE` in the same file.
7. Add a link `- [<group>](./references/<group>.md)` to the appropriate scope section in `plugin/skills/formio-api/SKILL.md`.

Adding a reference doc without performing steps 5–7 SHALL fail validation.

#### Scenario: A complete addition conforms

- **WHEN** an author creates `plugin/skills/formio-api/references/<group>.md` with no frontmatter and the five required headings in order
- **AND** the `## Authentication` section carries the canonical auth paragraph, or the group is unauthenticated
- **AND** every endpoint heading resolves its root to `${FORMIO_BASE_URL}` or `${FORMIO_PROJECT_URL}` rather than leaving a raw Postman placeholder outside a code fence
- **AND** the group is registered in the library's required-groups and scope registries and linked from the router's matching scope section
- **THEN** the addition SHALL be conformant

#### Scenario: A reference missing a required heading is non-conformant

- **WHEN** a reference omits any of `## Overview`, `## Root URL`, `## Authentication`, `## MCP Tool Preference`, or `## Endpoints`, or carries them out of order
- **THEN** the reference SHALL be treated as non-conformant

#### Scenario: A registered group with no router link is unreachable

- **WHEN** a group is registered as required but no `- [<group>](./references/<group>.md)` link is added to the router
- **THEN** the addition SHALL be treated as non-conformant
- **AND** the reason SHALL be that the router is the library's only discovery surface, so an unlinked reference is one nothing navigates to

### Requirement: Removing a reference group

To remove a capability group from the reference library, authors SHALL:

1. Delete the reference file.
2. Remove the group name from `REQUIRED_REFERENCE_GROUPS`.
3. Remove the group's entry from `GROUP_SCOPE`.
4. Remove the router link.

#### Scenario: A complete removal conforms

- **WHEN** an author deletes the reference file and removes the group from the required-groups registry, the scope registry, and the router
- **THEN** the removal SHALL be conformant

#### Scenario: Deleting the file while the group stays registered is non-conformant

- **WHEN** the reference file is deleted but the group remains in the required-groups registry
- **THEN** the library SHALL be treated as non-conformant, reporting a required reference that is absent

#### Scenario: A router link left behind points at nothing

- **WHEN** the reference file is deleted but its router link remains
- **THEN** the router SHALL be treated as non-conformant, because it now offers a path to a document that does not exist

### Requirement: Scope determines root URL

The `GROUP_SCOPE` mapping determines placeholder-substitution rules for each reference:

- `platform` scope → root is `${FORMIO_BASE_URL}`; bare `{{baseUrl}}/` prose is disallowed.
- `project`, `runtime`, `pdf` scope → root is `${FORMIO_PROJECT_URL}`; `{{baseUrl}}/{{projectName}}` prose is disallowed.
- `pdf` scope → additionally, every endpoint path MUST start with `${FORMIO_PROJECT_URL}/pdf-proxy`.

#### Scenario: Author adds a new project-scope reference

- **WHEN** an author adds `project-webhooks` to `REQUIRED_REFERENCE_GROUPS` with `GROUP_SCOPE['project-webhooks'] = 'project'`
- **AND** creates `plugin/skills/formio-api/references/project-webhooks.md` with the required headings
- **AND** adds the router link `- [project-webhooks](./references/project-webhooks.md)` under the "Project scope" section
- **THEN** `validateLibrary` SHALL return no issues

#### Scenario: Author adds a new group but forgets the router link

- **WHEN** an author adds a new group to `REQUIRED_REFERENCE_GROUPS` without updating the router
- **THEN** `validateRouterLinks` SHALL emit an `index.missing_link` issue

### Requirement: Endpoint documentation format

Every endpoint documented under `## Endpoints` SHALL include:

- A level-3 heading of the form `### <METHOD> <PATH>`
- A one-sentence description
- A parameters table (if any parameters exist)
- A request-body example for `POST`, `PUT`, `PATCH`
- A response example
- An error-behavior note

#### Scenario: A read endpoint documented completely

- **WHEN** a `GET` endpoint is documented under `## Endpoints`
- **THEN** it SHALL carry a `### GET <PATH>` heading, a one-sentence description, a parameters table where it takes parameters, a response example, and an error-behavior note
- **AND** no request-body example SHALL be required of it

#### Scenario: A write endpoint carries a request-body example

- **WHEN** a `POST`, `PUT`, or `PATCH` endpoint is documented
- **THEN** it SHALL carry a request-body example in addition to everything a read endpoint carries
- **AND** the reason SHALL be that the body is the part a caller cannot infer from the path

#### Scenario: An endpoint missing its error-behavior note is non-conformant

- **WHEN** an endpoint documents only its success response
- **THEN** the reference SHALL be treated as non-conformant
- **AND** the reason SHALL be that a caller who cannot tell a 401 from a 404 from a validation failure has no way to branch on the outcome
