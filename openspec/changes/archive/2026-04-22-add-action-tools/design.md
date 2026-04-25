## Context

The MCP server has 4 form tools (form_create, form_get, form_list, form_update) plus a hello tool. Each follows the same pattern: a `registerXxxTool(server, config)` function that defines a Zod input schema, calls `formioFetch`, and returns `toMcpTextResult` or `toMcpError`. Actions are the next layer — they attach server-side behavior to forms (email, auth, webhooks, etc.).

The Form.io action system has 13+ action types split across open-source and enterprise servers. Each type has unique settings. The server exposes a type catalog endpoint that returns available types and their settings form schemas at runtime.

## Goals / Non-Goals

**Goals:**

- Add 7 MCP tools covering the full action lifecycle (discovery + CRUD)
- Support any action type without hardcoding — open-source or enterprise
- Validate requested action types against the server's runtime catalog
- Support conjunction-based conditions (`all`/`any` with component/operator/value)

**Non-Goals:**

- Custom JavaScript or JSON Logic conditions (security concern, deferred)
- Legacy condition format support (auto-migrated on read by the server)
- Hardcoded server edition detection (inferred from catalog)
- Action execution or testing — these tools manage configuration only

## Decisions

### 1. Runtime schema discovery over hardcoded Zod unions

**Decision:** `settings` uses `z.record(z.string(), z.unknown())`. The LLM calls `action_type_get` to fetch the settingsForm before creating an action.

**Why over discriminated union:** 13+ action types with unique settings, split across server editions. A hardcoded union would be massive, require updates when action types change, and break on enterprise-only types the MCP server doesn't know about. The settingsForm endpoint already provides a machine-readable schema — use it.

### 2. Validate action types against server catalog

**Decision:** `action_type_get` and `action_create` validate the requested action type by fetching the catalog. On mismatch, return an error listing available types.

**Why over hardcoded lists:** The set of available types depends on the server edition and installed plugins. The catalog endpoint (`GET /form/:formId/actions`) is the source of truth. No maintained lists, no staleness risk.

**Implementation:** When `action_type_get` gets a 404 or the requested name isn't in the catalog, fetch the catalog and return: `"Action type '{name}' is not available on this server. Available types: email, login, save, ..."`. Same validation in `action_create` — check `name` against catalog before POSTing.

### 3. Conjunction-only conditions

**Decision:** The condition schema supports only the conjunction-based format:
```
{ conjunction: "all" | "any", conditions: [{ component, operator, value }] }
```

**Why not custom code:** Custom JavaScript execution in conditions is a security-sensitive feature. Conjunction-based conditions cover the common cases (field equals value, field is not empty, etc.) without eval risk. Custom code support can be added later behind explicit opt-in.

**Why not legacy format:** The server auto-migrates legacy conditions (`field`/`eq`/`value`) to conjunction format on read. No reason to create new actions with the legacy format.

### 4. One file per tool, same registration pattern

**Decision:** Each tool gets its own file (`action_types_list.ts`, `action_type_get.ts`, etc.) with a `registerXxxTool(server, config)` export. All wired in `tools/index.ts`.

**Why:** Matches the existing form tool pattern. Each file is independently testable. The registry function in `index.ts` is the single extension point.

### 5. All paths relative to projectUrl via formioFetch

**Decision:** Action endpoints use `form/${formId}/action*` paths through `formioFetch`, which prepends `config.projectUrl`.

**Why:** `formioFetch` already handles URL building, auth headers, token refresh, and error formatting. No changes needed to the client layer.

## Risks / Trade-offs

- **[Loose settings schema]** The LLM could send invalid settings if it skips the `action_type_get` step. → Mitigation: Tool descriptions explicitly instruct the LLM to call `action_type_get` first. The server also validates on POST/PUT and returns errors.
- **[Catalog fetch on validation]** Validating action types requires an extra HTTP call to fetch the catalog. → Mitigation: Only done on error paths (type not found). The happy path is a single API call.
- **[Condition operators are server-defined]** The set of valid operators (isEqual, isNotEqual, isEmpty, etc.) varies by component type and isn't enumerated in the Zod schema. → Mitigation: The Zod schema uses `z.string()` for operator. The server validates and returns errors for invalid operators.
