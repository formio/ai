## Requirements

### Requirement: Terminology

Reference documents and the router skill SHALL use the following terms consistently. These terms are NOT interchangeable, and any drift SHALL fail validation.

- `baseUrl` / `base_url` → refers ONLY to the **platform deployment endpoint**, which resolves to the `FORMIO_BASE_URL` environment variable.
- `projectUrl` / `project_url` / `{{baseUrl}}/{{projectName}}` → refers ONLY to the **project endpoint**, which resolves to the `FORMIO_PROJECT_URL` environment variable.
- `FORMIO_BASE_URL` and `FORMIO_PROJECT_URL` are distinct environment variables. References SHALL NOT derive one from the other.

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

### Requirement: Removing a reference group

To remove a capability group from the reference library, authors SHALL:

1. Delete the reference file.
2. Remove the group name from `REQUIRED_REFERENCE_GROUPS`.
3. Remove the group's entry from `GROUP_SCOPE`.
4. Remove the router link.

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
