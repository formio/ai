## Why

The MCP server can list and read forms but cannot create new ones. Users need the ability to create forms directly through the MCP tool — for example, saying "create a college application form" and having the tool generate the form JSON definition and POST it to the Form.io API. This completes the basic form CRUD workflow (create + read).

## What Changes

- Extend `formioFetch` to support POST requests with a JSON body, in addition to the existing GET support
- Add a `form_create` MCP tool that accepts the form definition as a JSON object and creates it via `POST {projectUrl}/form`
- The tool's description SHALL instruct the LLM to use the `formio-form` skill (`.claude/skills/formio-form/SKILL.md`) to construct the form JSON definition before calling the tool. This ensures the form JSON follows the correct Form.io schema structure (component types, required properties, layout patterns, etc.)
- The tool accepts the complete form JSON (title, name, path, type, display, components, etc.) and returns the created form JSON from the API response

## Capabilities

### New Capabilities

- `form-create`: Registers the `form_create` tool on the MCP server, accepting a form JSON definition and creating it in the Form.io project via the API

### Modified Capabilities

- `formio-client`: The `formioFetch` function needs to support HTTP methods beyond GET (specifically POST with a JSON body)

## Impact

- **New file:** `src/tools/form_create.ts` — tool registration and handler
- **Modified file:** `src/formio-client.ts` — add method and body support to `formioFetch`
- **Modified file:** `src/tools/index.ts` — register the new tool
- **Dependencies:** No new dependencies
