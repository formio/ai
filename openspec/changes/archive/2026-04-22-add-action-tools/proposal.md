## Why

The MCP server currently only exposes form CRUD tools (form_create, form_get, form_list, form_update). Actions — the server-side behavior layer that powers email notifications, authentication, webhooks, role assignment, and more — have no first-class MCP tool support. Users must fall back to raw HTTP calls via skill documentation to manage actions, which is slower and error-prone. Adding action tools completes the form-configuration story: create a form, then wire up its behavior.

## What Changes

- Add 7 new MCP tools for action management, following the existing `form_*` registration pattern:
  - `action_types_list` — discover available action types for a form (catalog)
  - `action_type_get` — get action type info + settingsForm (runtime schema discovery)
  - `action_create` — attach an action to a form
  - `action_list` — list actions configured on a form
  - `action_get` — get a single action by ID
  - `action_update` — update an existing action
  - `action_delete` — remove an action from a form
- Use runtime schema discovery instead of hardcoded per-action-type Zod schemas. The `action_type_get` tool returns the settingsForm for any action type, which the LLM reads to construct the correct `settings` payload. This automatically supports all action types — open-source (6 types) and enterprise (13+) — without the MCP server needing to know the difference.
- Use loose Zod schema for `settings` (`z.record`) since the shape varies per action type and is discovered at runtime via `action_type_get`.
- Conditions use a structured conjunction-based schema only — no custom JavaScript/JSON Logic support. The Zod schema enforces `{ conjunction: "all"|"any", conditions: [{ component, operator, value }] }`.
- When a requested action type is not available on the connected server, return an error that includes the list of available types. This handles open-source vs enterprise differences without hardcoded edition detection — the server's action catalog is the source of truth.
- Register all new tools in `registerAllTools()` following the existing pattern.

## Capabilities

### New Capabilities

- `action-types-discovery`: Tools for listing available action types and retrieving their settings form schemas (action_types_list, action_type_get). Validates requested types against the server's catalog and returns available types on error.
- `action-crud`: Tools for creating, reading, updating, and deleting action instances on forms (action_create, action_list, action_get, action_update, action_delete). Conditions support conjunction-based format only (no custom code).

### Modified Capabilities

_(none — no existing spec requirements change)_

## Impact

- **New files**: 7 tool modules in `packages/mcp-server/src/tools/` plus corresponding test files in `__tests__/`
- **Modified files**: `packages/mcp-server/src/tools/index.ts` (register new tools)
- **API surface**: 7 new MCP tools exposed to clients
- **Dependencies**: No new dependencies — uses existing `formioFetch`, `toMcpTextResult`, `toMcpError`, Zod, and MCP SDK
- **Skills**: The existing `formio-api-project-actions` skill will direct Claude to prefer these MCP tools over raw HTTP calls
