## 1. Extend formioFetch for POST support

- [x] 1.1 Add optional `method` and `body` parameters to `formioFetch`; when body is provided, set `Content-Type: application/json` and serialize the body; default method to `"GET"`
- [x] 1.2 Write tests for `formioFetch` POST: sends POST method, sets Content-Type header, serializes body as JSON, returns parsed response, handles errors

## 2. form_create Tool

- [x] 2.1 Create `src/tools/form_create.ts` with `registerFormCreateTool(server, config)` that registers the `form_create` tool with a description instructing the LLM to use the `formio-form` skill to build the form JSON, and a Zod schema requiring `title`, `name`, `path`, `components` and accepting optional `type`, `display`, `tags`
- [x] 2.2 Write tests for `form_create`: successful creation, MCP response format, API error handling with `isError: true`, required fields passed to formioFetch
- [x] 2.3 Modify `src/tools/index.ts` to call `registerFormCreateTool()` alongside existing tool registrations
