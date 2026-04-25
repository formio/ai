## Context

The MCP server has a working STDIO transport and a hello tool. The codebase follows functional patterns with pure functions and immutable data. Tools are registered via `registerAllTools()` in `tools/index.ts`. The server uses `@modelcontextprotocol/sdk` v1.29.0 with Zod 4 for parameter schemas. Native `fetch` is available (Node 24).

The Form.io API uses a project-scoped base URL pattern (`{base}/{project}/form`) with `x-token` header authentication for API keys.

## Goals / Non-Goals

**Goals:**

- Provide a `form_list` tool that returns form summaries from a Form.io project
- Establish reusable configuration and HTTP client modules for future Form.io tools
- Fail fast on missing configuration so developers get clear errors immediately
- Expose full query parameter flexibility (type, limit, skip, sort, select, tags)

**Non-Goals:**

- Full form retrieval with components (future `form_get` tool)
- JWT/password authentication (API key only for now)
- Caching or rate limiting
- Form creation, update, or deletion tools

## Decisions

### 1. Environment variables for configuration

**Decision:** Read `FORMIO_PROJECT_URL` and `FORMIO_API_KEY` from `process.env`, validate at startup.

**Rationale:** MCP servers are configured once per project in `.mcp.json`. Environment variables are the standard mechanism — the `env` field in `.mcp.json` passes them to the server process. No need for per-call overrides since all tools in a session target the same project.

**Alternatives:**

- Tool parameters for URL/key: Verbose, requires passing on every call
- Config file: Extra complexity, not standard for MCP servers

### 2. Fail-fast validation

**Decision:** `getConfig()` throws with a descriptive error if either env var is missing. Called during `createServer()` before tool registration.

**Rationale:** A server without Form.io credentials can't do anything useful. Failing at startup with a clear message ("FORMIO_PROJECT_URL is required") is better than a cryptic 401 on first tool call.

### 3. Shared `formioFetch` function

**Decision:** A single `formioFetch(path, params, config)` function that constructs the full URL, sets the `x-token` header, appends query parameters, calls native `fetch`, and returns parsed JSON.

**Rationale:** Every future tool (form_get, submission_list, etc.) needs the same URL construction and auth. A pure function with explicit config parameter keeps it testable without environment coupling.

**Alternatives:**

- Class-based client: Unnecessary state for what is essentially URL + headers + fetch
- Inline fetch per tool: Duplicates auth/URL logic immediately

### 4. Default field selection

**Decision:** When `select` is not provided, default to `_id,title,name,path,type,tags`. This excludes the `components` array which can be very large.

**Rationale:** The form list is for browsing/discovery. Component details belong in a dedicated `form_get` tool. Keeping responses lean means the LLM context isn't overwhelmed with schema data.

### 5. Native fetch, no new dependencies

**Decision:** Use Node's built-in `fetch` API. No axios, node-fetch, or other HTTP libraries.

**Rationale:** Node 24 has stable `fetch`. Zero new dependencies to maintain. The use case is simple GET requests with headers.

## Risks / Trade-offs

- **[API key in env var]** The API key is stored in `.mcp.json` which may be committed to git. **Mitigation:** `.mcp.json` is already in `.gitignore` or should be. Document this clearly.
- **[No retry logic]** Network failures return a single error. **Mitigation:** Acceptable for a developer tool — the LLM can retry the tool call. Retry logic can be added later if needed.
- **[Default select may miss fields]** If Form.io adds useful metadata fields, the default select won't include them. **Mitigation:** Users can override with the `select` parameter. Default can be updated as needed.
