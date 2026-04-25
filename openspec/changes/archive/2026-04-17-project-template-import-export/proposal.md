## Why

The resource planner skill produces a complete `template.json` artifact, but there's no MCP tool to actually import it into a Form.io project. Users must manually curl the endpoint or hand-wire each resource/form/action through individual `form_create` calls. Similarly, there's no way to export a project's current template through the MCP server — useful for snapshotting before changes or migrating between deployments. Both endpoints exist in the Form.io API (`GET /export`, `POST /import`) but are not yet exposed as MCP tools.

## What Changes

- Add a `project_export` MCP tool that calls `GET ${FORMIO_PROJECT_URL}/export` and returns the project's template JSON
- Add a `project_import` MCP tool that calls `POST ${FORMIO_PROJECT_URL}/import` with a `{ "template": ... }` body, enabling one-call setup of an entire project from a template.json
- Register both tools in the existing `registerAllTools` function

## Capabilities

### New Capabilities

- `project-export`: Export a Form.io project's complete template (roles, resources, forms, actions) as a portable JSON document
- `project-import`: Import a template JSON into an existing Form.io project, merging roles, resources, forms, and actions in one call

### Modified Capabilities

(none — existing tools and specs are unaffected)

## Impact

- **Code:** Two new tool files in `packages/mcp-server/src/tools/`, registration in `tools/index.ts`
- **APIs:** Wraps existing Form.io endpoints `GET /export` and `POST /import` — no new server-side API work
- **Dependencies:** None — uses existing `formioFetch`, `toMcpTextResult`, `toMcpError`
- **Skills:** The `formio-api/references/platform-projects` skill already documents these endpoints; its `## MCP Tool Preference` section can be updated to reference the new tools once they ship
