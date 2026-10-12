## MODIFIED Requirements

### Requirement: New API reference docs follow the consolidated layout

To add a new Form.io API capability group to the reference library, authors SHALL:

1. Create `plugin/skills/formio-api/references/<group>.md` (no frontmatter).
2. Include the five required section headings in order: `## Overview`, `## Root URL`, `## Authentication`, `## MCP Tool Preference`, `## Endpoints`.
3. Include the paragraph its scope requires in the `## Authentication` section: the canonical auth paragraph for a platform- or project-scope group, the runtime auth paragraph for a `runtime-` group, both for a group that documents build-time and runtime endpoints together (like `pdf-api`), and neither for an unauthenticated group (like `server-status`).
4. Document endpoints with `### <METHOD> <url>` headings rooted at `{baseUrl}` or `{projectUrl}` — the substitution-slot form, NOT an environment-variable name and NOT a raw Postman `{{baseUrl}}` / `{{projectName}}` placeholder outside code fences.
5. Add the group name to the library's required-groups registry.
6. Add a scope entry for the group in the matching scope registry.
7. Add a link `- [<group>](./references/<group>.md)` to the appropriate scope section in `plugin/skills/formio-api/SKILL.md`.

Adding a reference doc without performing steps 5–7 SHALL fail validation.

#### Scenario: A complete addition conforms

- **WHEN** an author creates `plugin/skills/formio-api/references/<group>.md` with no frontmatter and the five required headings in order
- **AND** the `## Authentication` section carries the paragraph its scope requires, or the group is unauthenticated
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
