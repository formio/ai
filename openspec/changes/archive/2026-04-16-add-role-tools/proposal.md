## Why

The MCP server currently only exposes form CRUD tools. Project roles are a fundamental building block in Form.io — they govern access on every form and submission. Adding role management tools lets AI agents create, list, and update roles without dropping to raw HTTP, keeping the same ergonomic pattern as the existing form tools.

## What Changes

- Add `role_list` tool — lists all roles in the project (GET /role)
- Add `role_create` tool — creates a new role (POST /role)
- Add `role_update` tool — updates an existing role by ID (PUT /role/:roleId)
- Wire all three tools into the tool registry (`registerAllTools`)
- Update the `formio-api/references/project-roles` skill's MCP Tool Preference section to reference the new tools

## Capabilities

### New Capabilities

- `role-list`: List all roles defined in a Form.io project with optional field selection
- `role-create`: Create a new role in a Form.io project with title, description, default, and admin fields
- `role-update`: Update an existing role by ID with full replacement semantics

### Modified Capabilities

- `api-skills-validation`: The project-roles skill will gain MCP tool references in its MCP Tool Preference section

## Impact

- New files: `packages/mcp-server/src/tools/role_list.ts`, `role_create.ts`, `role_update.ts`
- Modified files: `packages/mcp-server/src/tools/index.ts` (register new tools)
- Modified files: `plugin/skills/formio-api/references/project-roles.md` (update MCP Tool Preference)
- No new dependencies — uses existing `formioFetch`, `toMcpTextResult`, `toMcpError`
