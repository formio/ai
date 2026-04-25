## 1. Configuration

- [x] 1.1 Create `src/config.ts` with `getConfig()` that reads and validates `FORMIO_PROJECT_URL` and `FORMIO_API_KEY` from environment variables (strips trailing slash from URL)
- [x] 1.2 Write tests for `getConfig()`: valid config, missing URL, missing key, trailing slash stripping
- [x] 1.3 Modify `src/server.ts` to call `getConfig()` at startup and pass config to `registerAllTools()`

## 2. Form.io HTTP Client

- [x] 2.1 Create `src/formio-client.ts` with `formioFetch(path, params, config)` that constructs URL, sets `x-token` header, appends query params, and returns parsed JSON
- [x] 2.2 Write tests for `formioFetch()`: URL construction, header setting, query param handling, undefined param omission, HTTP error handling (mock fetch)

## 3. form_list Tool

- [x] 3.1 Create `src/tools/form_list.ts` with `registerFormListTool(server, config)` that registers the `form_list` tool with Zod parameter schema (type, limit, skip, sort, select, tags)
- [x] 3.2 Write tests for `form_list`: default params (select + limit defaults), each query param override, tags array joining, MCP response format, error handling with `isError: true`
- [x] 3.3 Modify `src/tools/index.ts` to call `registerFormListTool()` and accept config parameter

## 4. MCP Configuration

- [x] 4.1 Update `.mcp.json` to include `env` block with `FORMIO_PROJECT_URL` and `FORMIO_API_KEY`
