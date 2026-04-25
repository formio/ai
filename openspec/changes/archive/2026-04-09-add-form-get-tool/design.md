## Context

The MCP server currently supports listing forms via the `form_list` tool, which calls `GET /form` with query parameters and returns an array of form summaries. The server already has a `formioFetch` HTTP client and `FormioConfig` for authenticated requests. Adding `form_get` follows the same patterns — it is a thin tool registration that delegates to `formioFetch`.

The Form.io API supports fetching a single form via `GET /form/{formIdOrPath}` where `formIdOrPath` is either a MongoDB ObjectId (`_id`) or the form's `path` (e.g., `user/login`). The response is a complete form JSON object including `components`, `access`, `submissionAccess`, `settings`, and all other form properties.

## Goals / Non-Goals

**Goals:**

- Register a `form_get` MCP tool that retrieves a single form's complete JSON by ID or path
- Follow the identical patterns established by `form_list` (Zod schema, `formioFetch`, MCP response format, error handling)
- Support optional `select` parameter for field filtering

**Non-Goals:**

- Form creation, update, or deletion (future tools)
- Caching or local storage of form definitions
- Component-level introspection or transformation of the returned JSON

## Decisions

### 1. Single `formIdOrPath` parameter instead of separate `id` / `path` params

The Form.io API uses the same endpoint for both ID and path lookups (`GET /form/{formIdOrPath}`). A single required string parameter keeps the tool interface simple and matches the API's design. The user provides whichever identifier they have.

**Alternative considered:** Two optional parameters (`id` and `path`) with validation that exactly one is provided. Rejected — adds complexity for no functional benefit since the API treats both the same.

### 2. Reuse `formioFetch` without modification

The existing `formioFetch(path, params, config)` already handles URL construction, authentication, query params, and error handling. Calling `formioFetch(`form/${formIdOrPath}`, params, config)` works directly. No changes to the HTTP client are needed.

### 3. No default `select` — return full form JSON by default

Unlike `form_list` which defaults to a summary projection, `form_get` should return the complete form definition by default. The whole point of fetching a single form is to see its full structure. An optional `select` parameter is still available for users who want to limit fields.

## Risks / Trade-offs

- **[Large responses]** → Complete form JSON can be large for complex forms with many components. Acceptable since the user explicitly requested a specific form. The optional `select` parameter provides an escape hatch if needed.
- **[Path ambiguity]** → A form path like `user/login` contains a slash, which works correctly since `formioFetch` constructs the URL via string concatenation. No encoding issues since the Form.io API expects the raw path segments.
