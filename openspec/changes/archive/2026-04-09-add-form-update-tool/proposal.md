## Why

The MCP server can create and read forms but cannot modify existing ones. Users need to update forms — adding fields, removing fields, modifying field settings, or changing form-level properties (title, display mode, tags, etc.). This completes the form CRUD lifecycle (create, read, update).

## What Changes

- Add a `form_update` MCP tool that accepts a form ID and the complete updated form JSON, then sends it via `PUT {projectUrl}/form/{formId}`
- The tool's description SHALL instruct the LLM to first fetch the current form using `form_get`, apply the user's requested modifications (add/remove/modify fields, change settings), and then call `form_update` with the full updated form definition
- Extend `formioFetch` to support PUT requests (reuses the existing `method` + `body` options added for POST)

## Capabilities

### New Capabilities

- `form-update`: Registers the `form_update` tool on the MCP server, accepting a form ID and the updated form JSON definition, and saving it via the Form.io Update API

### Modified Capabilities

None — `formioFetch` already supports `method` and `body` options from the `form_create` change. PUT works with the same mechanism.

## Impact

- **New file:** `src/tools/form_update.ts` — tool registration and handler
- **Modified file:** `src/tools/index.ts` — register the new tool
- **Dependencies:** No new dependencies; reuses existing `formioFetch` with `method: "PUT"`
