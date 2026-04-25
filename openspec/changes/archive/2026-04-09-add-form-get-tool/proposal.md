## Why

The MCP server can list forms but cannot retrieve the full definition of a specific form. Users need to inspect a form's complete JSON (components, settings, access permissions) to understand its structure, debug issues, or feed it into downstream tooling. Adding a `form_get` tool completes the basic form-read workflow.

## What Changes

- Add a `form_get` MCP tool that fetches a single form by path or ID via `GET {projectUrl}/form/{formIdOrPath}`
- The tool accepts an `formIdOrPath` parameter (the form `_id` or the form `path`) and an optional `select` parameter for field filtering
- Returns the complete form JSON as MCP text content, following the same patterns as `form_list`

## Capabilities

### New Capabilities

- `form-get`: Registers the `form_get` tool on the MCP server, accepting a form identifier and optional field selection, returning the full form JSON via the Form.io API

### Modified Capabilities

None — the existing `formio-client`, `server-config`, and `form-list` capabilities are reused as-is without requirement changes.

## Impact

- **New file:** `src/tools/form_get.ts` — tool registration and handler
- **Modified file:** `src/tools/index.ts` — register the new tool
- **Dependencies:** Reuses existing `formioFetch` and `FormioConfig` — no new dependencies
