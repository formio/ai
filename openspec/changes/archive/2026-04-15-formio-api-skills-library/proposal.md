## Why

The Form.io platform exposes a large REST API surface (documented at [Postman](https://documenter.getpostman.com/view/684631/2sBXiok9LB)) spanning Platform, Project, and Runtime scopes — forms, submissions, actions, roles, teams, stages, tenants, PDFs, reports, and more. Today, AI agents interacting with the MCP server only know how to handle the four first-party tools (`form_create`, `form_get`, `form_list`, `form_update`); everything else requires the agent to guess endpoints, headers, and payloads. We need a library of Claude skills — one per API capability group — that gives agents accurate, self-contained operational knowledge for every documented endpoint so they can drive Form.io end-to-end via the MCP server's authenticated HTTP surface.

## What Changes

- Add a library of skills under `skills/formio-api/` — one skill file per API capability group from the Postman documentation — authored using the `skill-creator` skill
- Each skill documents: the endpoints it covers, HTTP method/path, required/optional parameters, request/response shapes, error behaviors, and worked examples
- Each skill declares a focused activation `description` so Claude selects the right skill for a given user request
- Skills resolve Postman placeholders to environment variables as follows:
  - `{{baseUrl}}/{{projectName}}/...` → `${FORMIO_PROJECT_URL}/...`
  - `{{baseUrl}}/...` (when NOT followed by `{{projectName}}`) → `${FORMIO_BASE_URL}/...`
  - PDF endpoints use `${FORMIO_PROJECT_URL}/pdf-proxy` — the `PDF server direct API` group from Postman is explicitly **out of scope** and not covered by the library
- All skills reference the PKCE-provided `x-jwt-token` (from the existing `user-auth` / `token-cache` capabilities) as the sole authorization mechanism — no API-key fallback is documented in skills
- Add an index skill (`skills/formio-api/README.md` or equivalent) that lists available sub-skills and explains the overall scope map (Platform / Project / Runtime / PDF). The Postman "Server API" (Health, Status) is treated as part of Platform scope — it shares `FORMIO_BASE_URL` — though its skill file remains a distinct `server-status.md` for activation clarity.
- Add a lightweight validation step (script or test) that asserts every skill file has the required frontmatter (`name`, `description`) and passes Markdown lint
- **Non-goals**: This change does NOT add new MCP tools, does NOT implement an HTTP client for every endpoint, and does NOT change existing auth behavior. Skills are documentation artifacts consumed by Claude at runtime.

## Capabilities

### New Capabilities

- `api-skills-library`: The overall library of Form.io API skills — directory layout, naming conventions, frontmatter schema, and index skill that routes between sub-skills
- `api-skills-authoring`: Authoring rules for individual skill files (auth documentation, endpoint formatting, example shape, FORMIO_PROJECT_URL substitution, error handling guidance) so every skill is produced to the same standard
- `api-skills-validation`: Static validation that every skill in the library has valid frontmatter, references only PKCE/JWT auth, and follows the authoring rules

### Modified Capabilities

<!-- None. Existing capabilities (user-auth, token-cache, formio-client, server-config, form-*) are unchanged. -->

## Impact

- **New directory**: `skills/formio-api/` containing ~15 skill files grouped by API scope (Platform / Project / Runtime / PDF / Server)
- **Documentation**: `CLAUDE.md` or README pointer so users know where the skill library lives and how skills are activated
- **Tests**: A new Vitest suite under `packages/mcp-server/src/__tests__/` (or a repo-root script) that reads `skills/formio-api/**/*.md` and asserts frontmatter + authoring rules
- **No runtime code changes**: The MCP server itself is not modified. Skills are consumed by the Claude client, not the MCP server runtime.
- **Dependencies**: Optionally `gray-matter` (or equivalent) for parsing skill frontmatter during validation — evaluated in design
- **Authoring workflow**: Future API additions require adding a new skill file and rerunning the validation test; captured in a short authoring guide
