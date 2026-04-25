## Context

The MCP server currently exposes four form-level tools (`form_create`, `form_get`, `form_list`, `form_update`) but no project-level template operations. The Form.io API provides `GET /export` and `POST /import` endpoints that operate on an entire project's template — roles, resources, forms, and actions in a single JSON document. The resource planner skill (`formio-resource-planner`) produces exactly this template.json shape, and the `formio-api/references/platform-projects` skill documents both endpoints.

Existing infrastructure: `formioFetch` in `packages/mcp-server/src/formio-client.ts` handles auth headers, URL construction, and error handling. `toMcpTextResult` / `toMcpError` in `mcp-responses.ts` format responses. All existing tools follow the same pattern: one file per tool, registered in `tools/index.ts`.

## Goals / Non-Goals

**Goals:**

- Expose `GET /export` as a `project_export` MCP tool — returns the project's full template JSON
- Expose `POST /import` as a `project_import` MCP tool — accepts a template JSON and imports it into the project
- Follow the established tool registration pattern exactly
- Direct the LLM to the `formio-resource-planner` skill for template construction in the `project_import` tool description

**Non-Goals:**

- Template validation before import — the Form.io server validates on its own (returns 400 on malformed input)
- Diffing or merging templates — import is a wholesale merge handled server-side
- Platform-level project creation — that uses `POST /project` on the base URL, a different scope

## Decisions

**1. Two separate tools, not one "project_template" tool with a mode parameter.**

Each tool maps to one HTTP verb on one endpoint. This matches the existing pattern (`form_create` vs `form_get` vs `form_list` — not `form_crud`). It keeps tool descriptions focused and makes LLM tool selection clearer.

**2. `project_import` accepts the template object directly, not wrapped in `{ "template": ... }`.**

The Form.io API expects `{ "template": <object> }` as the request body, but the tool should accept just the template object and wrap it internally. This matches how `form_create` accepts a form object directly rather than making the caller wrap it. The wrapping is an API detail, not a user concern.

**3. `project_import` tool description references the `formio-resource-planner` skill.**

Same pattern as `form_create` referencing the `formio-form` skill — the description tells the LLM where to get the input artifact. The resource planner's Phase B output is the exact shape this tool expects.

**4. `project_export` returns the raw template JSON, not a summary.**

The template is the artifact. Summarizing it would lose information. The LLM can summarize if needed.

**5. Both tools use `formioFetch` with `config.projectUrl` — no base URL needed.**

Both `/export` and `/import` are project-scoped endpoints, not platform endpoints. They use the same base URL and auth as the existing form tools.

**6. The import endpoint returns plain text "Ok", not JSON.**

`formioFetch` currently expects JSON responses. The import response handler needs to handle the plain text "Ok" response. We'll pass a `responseType: 'text'` option or handle the non-JSON response in the tool itself.

## Risks / Trade-offs

- **Import is destructive** — it merges into the existing project and can overwrite resources/forms. The tool description should warn about this, but we don't add a confirmation gate (MCP tools don't have interactive confirmation). → Mitigation: the description tells the LLM to use `project_export` first to snapshot the current state.
- **Large templates** — a complex project export could be 1000+ lines of JSON, consuming significant context. → Acceptable: this is inherent to the operation; no mitigation needed.
- **`formioFetch` text response handling** — the import endpoint returns `"Ok"` not JSON. If `formioFetch` tries to JSON.parse this, it'll throw. → Mitigation: check how `formioFetch` handles responses and either add a text-response option or handle in the tool.
