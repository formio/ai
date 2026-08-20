## MODIFIED Requirements

### Requirement: Terminology

Reference documents and the router skill SHALL use the following terms consistently. These terms are NOT interchangeable, and any drift SHALL fail validation.

- `projectUrl` → the **project endpoint**: the project an application reads and writes.
- `baseUrl` → the **platform deployment endpoint**: the deployment hosting that project.

An `FORMIO_*` name SHALL appear ONLY where the subject is the environment variable itself. Three uses were previously conflated under one spelling, and separating them is the point of this rule:

1. **A substitution slot in an endpoint heading or example** SHALL be written `{projectUrl}` / `{baseUrl}` — single braces, no `FORMIO_` prefix, no `${…}`. It is a placeholder for a value the reader supplies, not a variable to read. Spelling it `${FORMIO_PROJECT_URL}` told an agent to go find an environment variable in order to build a URL, which is not what the document means.
2. **A value carried between phases or skills** SHALL be named in prose — "the Project URL", "the Base URL" — or as a payload field named `projectUrl` / `baseUrl`. There is no variable involved, so no variable name SHALL be used for it.
3. **The environment variable** SHALL be spelled `FORMIO_PROJECT_URL` or `FORMIO_BASE_URL`, and only where the document is talking about the environment — a client configuration `env` block, an environment table, or the resolution order's weakest source.

Single braces are required rather than double so the slot stays visually distinct from a Postman placeholder (`{{baseUrl}}`), which remains disallowed.

References SHALL NOT derive one URL from the other in prose. A customer deployment may route projects to sibling sub-domains, where the two hosts differ and neither can be reconstructed from the other; where the base URL CAN be derived, the server does it, and a reference stating the rule invites a reader to hand-derive the case that cannot be.

#### Scenario: Each term names only its own endpoint

- **WHEN** a reference documents a platform-scope endpoint
- **THEN** it SHALL root that endpoint at `{baseUrl}`
- **AND** a reference documenting a project-scope endpoint SHALL root it at `{projectUrl}`
- **AND** neither document SHALL use the two terms as though they were interchangeable

#### Scenario: An endpoint root carries no environment-variable name

- **WHEN** any endpoint heading under `## Endpoints` is inspected
- **THEN** its root is `{projectUrl}` or `{baseUrl}`
- **AND** it contains no `FORMIO_PROJECT_URL`, `FORMIO_BASE_URL`, or `${…}` form

#### Scenario: An environment-variable name appears only for the environment

- **WHEN** a reference or skill document names `FORMIO_PROJECT_URL` or `FORMIO_BASE_URL`
- **THEN** the surrounding text is about the environment variable — an `env` block, an environment table, or the resolution order
- **AND** it is not naming a substitution slot or a value passed between phases

#### Scenario: Deriving one URL from the other is non-conformant

- **WHEN** a reference builds a project URL by appending a project name to `{baseUrl}`, or infers a base URL from a project URL
- **THEN** the reference SHALL be treated as non-conformant
- **AND** the reason SHALL be that a customer deployment may route projects to sibling sub-domains, where the two hosts differ and neither can be reconstructed from the other

### Requirement: Scope determines root URL

The `GROUP_SCOPE` mapping determines placeholder-substitution rules for each reference:

- `platform` scope → root is `{baseUrl}`; bare `{{baseUrl}}/` prose is disallowed.
- `project`, `runtime`, `pdf` scope → root is `{projectUrl}`; `{{baseUrl}}/{{projectName}}` prose is disallowed.
- `pdf` scope → additionally, every endpoint path MUST start with `{projectUrl}/pdf-proxy`.

#### Scenario: Author adds a new project-scope reference

- **WHEN** an author adds `project-webhooks` to `REQUIRED_REFERENCE_GROUPS` with `GROUP_SCOPE['project-webhooks'] = 'project'`
- **AND** creates `plugin/skills/formio-api/references/project-webhooks.md` with the required headings, rooting its endpoints at `{projectUrl}`
- **AND** adds the router link `- [project-webhooks](./references/project-webhooks.md)` under the "Project scope" section
- **THEN** `validateLibrary` SHALL return no issues

#### Scenario: Author adds a new group but forgets the router link

- **WHEN** an author adds a new group to `REQUIRED_REFERENCE_GROUPS` without updating the router
- **THEN** `validateRouterLinks` SHALL emit an `index.missing_link` issue

### Requirement: New API reference docs follow the consolidated layout

To add a new Form.io API capability group to the reference library, authors SHALL:

1. Create `plugin/skills/formio-api/references/<group>.md` (no frontmatter).
2. Include the five required section headings in order: `## Overview`, `## Root URL`, `## Authentication`, `## MCP Tool Preference`, `## Endpoints`.
3. Include the canonical auth paragraph in the `## Authentication` section (unless the group is unauthenticated like `server-status`).
4. Document endpoints with `### <METHOD> <url>` headings rooted at `{baseUrl}` or `{projectUrl}` — the substitution-slot form, NOT an environment-variable name and NOT a raw Postman `{{baseUrl}}` / `{{projectName}}` placeholder outside code fences.
5. Add the group name to the library's required-groups registry.
6. Add a scope entry for the group in the matching scope registry.
7. Add a link `- [<group>](./references/<group>.md)` to the appropriate scope section in `plugin/skills/formio-api/SKILL.md`.

Adding a reference doc without performing steps 5–7 SHALL fail validation.

#### Scenario: A complete addition conforms

- **WHEN** an author creates `plugin/skills/formio-api/references/<group>.md` with no frontmatter and the five required headings in order
- **AND** the `## Authentication` section carries the canonical auth paragraph, or the group is unauthenticated
- **AND** every endpoint heading is rooted at `{baseUrl}` or `{projectUrl}` rather than at an environment-variable name or a raw Postman placeholder outside a code fence
- **AND** the group is registered in the library's required-groups and scope registries and linked from the router's matching scope section
- **THEN** the addition SHALL be conformant

#### Scenario: A reference missing a required heading is non-conformant

- **WHEN** a reference omits any of `## Overview`, `## Root URL`, `## Authentication`, `## MCP Tool Preference`, or `## Endpoints`, or carries them out of order
- **THEN** the reference SHALL be treated as non-conformant

#### Scenario: A registered group with no router link is unreachable

- **WHEN** a group is registered as required but no `- [<group>](./references/<group>.md)` link is added to the router
- **THEN** the addition SHALL be treated as non-conformant
- **AND** the reason SHALL be that the router is the library's only discovery surface, so an unlinked reference is one nothing navigates to
