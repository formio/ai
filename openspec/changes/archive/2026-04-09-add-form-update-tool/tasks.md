## 1. form_update Tool

- [x] 1.1 Create `src/tools/form_update.ts` with `registerFormUpdateTool(server, config)` that registers the `form_update` tool with a description guiding the LLM to fetch first via `form_get`, use the `formio-form` skill, then call this tool; Zod schema with required `formId` string and `form` object (requiring `components`, optional `title`, `name`, `path`, `type`, `display`, `tags`, passthrough for other fields)
- [x] 1.2 Write tests for `form_update`: tool listed with workflow guidance in description, sends PUT to `/form/{formId}`, passes form body, returns updated form JSON as MCP content, error handling with `isError: true`
- [x] 1.3 Modify `src/tools/index.ts` to call `registerFormUpdateTool()` alongside existing tool registrations
