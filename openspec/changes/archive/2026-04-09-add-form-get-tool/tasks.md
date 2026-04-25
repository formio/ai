## 1. form_get Tool

- [x] 1.1 Create `src/tools/form_get.ts` with `registerFormGetTool(server, config)` that registers the `form_get` tool with Zod parameter schema (required `formIdOrPath`, optional `select`)
- [x] 1.2 Write tests for `form_get`: fetch by ID, fetch by path, custom select param, no select returns full form, MCP response format, error handling with `isError: true`
- [x] 1.3 Modify `src/tools/index.ts` to call `registerFormGetTool()` alongside existing tool registrations

## 2. Fix alias path routing

- [x] 2.1 Add `isMongoId` helper in `form_get.ts` and update handler to use `form/{id}` for MongoDB IDs and `{alias}` for path aliases
- [x] 2.2 Update existing tests and add new tests: MongoDB ID uses `/form/{id}`, multi-segment alias uses `/{alias}`, single-segment alias uses `/{alias}`
