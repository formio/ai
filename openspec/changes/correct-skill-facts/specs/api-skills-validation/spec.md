## MODIFIED Requirements

### Requirement: Authenticated references MUST contain the canonical auth paragraph

Every reference SHALL carry, verbatim in its `## Authentication` section, the paragraph its scope requires:

- a platform- or project-scope reference carries the canonical authentication paragraph, exposed as the exported constant `CANONICAL_AUTH_PARAGRAPH`;
- a runtime-scope reference — `runtime-*.md`, and `pdf-api.md`, whose submission downloads run in the application — carries the runtime authentication paragraph, exposed as `RUNTIME_AUTH_PARAGRAPH`, which states that application code sends the end user's JWT from login — or no token where the Anonymous role holds the permission — and that the portal-login JWT authorizes only the MCP server's own tool calls. It SHALL NOT carry the canonical paragraph, which requires the portal-login JWT on every request and so contradicts it; a runtime reference that also shows build-time setup states in its own words which token that setup carries.

`server-status.md` is exempt because its endpoints are unauthenticated.

#### Scenario: Reference lacking the canonical auth paragraph fails

- **WHEN** a platform- or project-scope reference doc (not `server-status`) `## Authentication` section omits `CANONICAL_AUTH_PARAGRAPH`
- **THEN** `validateReferenceContent` SHALL emit an `auth.canonical_paragraph` issue

#### Scenario: Runtime reference lacking the runtime paragraph fails

- **WHEN** a runtime-scope reference omits `RUNTIME_AUTH_PARAGRAPH`
- **THEN** `validateReferenceContent` SHALL emit an `auth.runtime_paragraph` issue

#### Scenario: Runtime reference carrying the canonical paragraph fails

- **WHEN** a runtime-scope reference carries `CANONICAL_AUTH_PARAGRAPH`, with or without `RUNTIME_AUTH_PARAGRAPH`
- **THEN** `validateReferenceContent` SHALL emit an `auth.canonical_in_runtime` issue
