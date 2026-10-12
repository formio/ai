## MODIFIED Requirements

### Requirement: Authenticated references MUST contain the canonical auth paragraph

Every reference SHALL carry, verbatim in its `## Authentication` section, the paragraph its scope requires:

- a platform- or project-scope reference carries the canonical authentication paragraph, exposed as the exported constant `CANONICAL_AUTH_PARAGRAPH`;
- a runtime-scope reference (`runtime-*.md`) carries the runtime authentication paragraph, exposed as `RUNTIME_AUTH_PARAGRAPH`, which states that application code sends the end user's JWT from login — or no token where the Anonymous role holds the permission — and that the portal-login JWT authorizes only the MCP server's own tool calls; it MAY carry the canonical paragraph as well when it also documents build-time endpoints;
- `pdf-api.md`, which documents build-time and runtime endpoints together, carries both.

`server-status.md` is exempt because its endpoints are unauthenticated.

#### Scenario: Reference lacking the canonical auth paragraph fails

- **WHEN** a platform- or project-scope reference doc (not `server-status`) `## Authentication` section omits `CANONICAL_AUTH_PARAGRAPH`
- **THEN** `validateReferenceContent` SHALL emit an `auth.canonical_paragraph` issue

#### Scenario: Runtime reference lacking the runtime paragraph fails

- **WHEN** a `runtime-*.md` or `pdf-api.md` reference omits `RUNTIME_AUTH_PARAGRAPH`
- **THEN** `validateReferenceContent` SHALL emit an `auth.runtime_paragraph` issue

#### Scenario: Runtime reference carrying only the canonical paragraph fails

- **WHEN** a `runtime-*.md` reference carries `CANONICAL_AUTH_PARAGRAPH` and not `RUNTIME_AUTH_PARAGRAPH`
- **THEN** `validateReferenceContent` SHALL emit an `auth.runtime_paragraph` issue
