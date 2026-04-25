## Context

The MCP server exposes Form.io operations as MCP tools. Four form tools exist (`form_list`, `form_get`, `form_create`, `form_update`), all following the same pattern: a single-file module exporting a `register*Tool` function that uses `formioFetch` for HTTP and `toMcpTextResult`/`toMcpError` for response formatting. The tool registry in `index.ts` wires everything together.

The Form.io Roles API (`/role`) follows the same REST conventions as the Forms API but with a simpler document shape — no `components`, just `title`, `description`, `default`, and `admin`.

## Goals / Non-Goals

**Goals:**

- Add `role_list`, `role_create`, and `role_update` MCP tools following the established form tool pattern
- Reuse existing infrastructure (`formioFetch`, `toMcpTextResult`, `toMcpError`, `isMongoId`)
- Update the `formio-api/references/project-roles` skill to reference the new MCP tools

**Non-Goals:**

- `role_get` (single role by ID) — not in the documented API skill
- `role_delete` — not documented
- Role assignment to users or form access control — planned as a separate change
- New shared abstractions — the tool pattern is simple enough that each file stands alone

## Decisions

**One file per tool, mirroring the form tool pattern.** Each role tool gets its own file (`role_list.ts`, `role_create.ts`, `role_update.ts`) with a single exported `register*Tool` function. This matches the existing convention and keeps the Open/Closed principle — new tools are added by adding files, not modifying existing tool implementations.

Alternative considered: a single `role_tools.ts` file with all three. Rejected because it breaks the one-file-per-tool convention and makes diffs noisier.

**`role_update` takes a top-level `roleId` parameter plus a `role` object.** This mirrors `form_update` which takes `formId` and `form` separately. The `roleId` is validated with `isMongoId` before making the request.

**`role_list` uses simple query parameters, no pagination defaults.** Unlike forms, the roles list is typically small (3-10 entries). A `select` parameter is available but no default projection — roles are simple documents where all fields are useful.

## Risks / Trade-offs

**[Low] Role list size assumption** → Roles are typically few per project, so no pagination defaults. If a project has hundreds of custom roles, the full list is still small. No mitigation needed.

**[Low] PUT is full replacement** → The Form.io API uses PUT (full replace), not PATCH. The tool description must make this clear so AI agents include all fields they want to preserve. Mitigation: clear parameter descriptions.
