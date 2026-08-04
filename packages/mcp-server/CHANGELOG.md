# @formio/mcp

## 0.8.3

### Patch Changes

- 90119b4: Stop declaring the project URL as required configuration.

  The server starts with an empty environment, serves its full tool list, and answers `hello` without any configuration; the tools that read or write Form.io data raise an actionable error when called without a project. Declaring `FORMIO_PROJECT_URL` required told hosts to block installation on a value the server runs fine without, which made it harder to try than it actually is. The field description now says plainly that a useful install sets it.

## 0.8.2

### Patch Changes

- 3426aa0: Give Smithery a bundle whose tool definitions it accepts.

  Declaring tools in the `.mcpb` manifest made the Smithery publish fail with a 400 — `expected object, received undefined`, once per tool. Its CLI copies `manifest.tools` verbatim into the serverCard it uploads and validates against the MCP `Tool` type, so entries need an `inputSchema`. The MCPB schema permits only `name` and `description` per tool and rejects an `inputSchema` outright, so no single manifest satisfies both.

  The build now emits two archives wrapping identical server bytes: `formio-mcp.mcpb`, packed and validated by `mcpb pack` and attached to the GitHub release, and `formio-mcp.smithery.mcpb`, carrying the full definitions (input and output schemas plus annotations) for Smithery. If the MCPB schema ever admits full tool definitions the two collapse back into one.

## 0.8.1

### Patch Changes

- c74ccfd: Declare the server's tools in the `.mcpb` manifest.

  Directories that ingest the bundle read `manifest.tools` rather than launching the server: Smithery's listing reported no tools at all, because the manifest left discovery to runtime (`tools_generated: true`, no `tools` key). The list is now generated during the build by running the freshly bundled server and calling `tools/list`, so it stays accurate without being maintained by hand — a tool added in code appears on the next build. The build fails if the server lists nothing, rather than shipping a manifest that quietly claims no tools.

## 0.8.0

### Minor Changes

- 439c866: Start without configuration, and describe every tool fully.

  The server no longer exits when `FORMIO_PROJECT_URL` is unset. It starts, serves `tools/list`, and raises the (already clearer) missing-project error only when a tool actually needs the value. Previously any client that connected before being configured — including automated crawlers — saw a dead process and concluded the server exposed no tools at all.

  Every tool now declares an `outputSchema` and MCP annotations (`title`, `readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`), so a caller can type-check responses and tell a read from an overwrite before invoking anything.

  Breaking change to the list tools' payloads: `form_list`, `role_list`, `action_list`, `action_types_list`, and `form_revisions_list` now return a named object (`{ forms: [...], count: n }`) instead of a bare array, because structured content must be an object.

## 0.7.0

### Minor Changes

- d8dfe36: Make `cwd` optional when not running as the Claude Code plugin. The per-directory project map is only consulted in plugin context, so standalone and container callers were being asked for a value that could not affect the result — and were pointed at `project_set`, which is not registered outside the plugin. `cwd` stays required in plugin context, where the mapping is authoritative.

## 0.6.0

### Minor Changes

- c5f8408: Make browser login usable in headless environments instead of hanging. The login URL is now always written to stderr and included in the timeout error, a failed browser launch is reported rather than swallowed, `FORMIO_AUTH_HOST` and `FORMIO_AUTH_PORT` allow binding somewhere a host browser can reach, and `FORMIO_AUTH_TIMEOUT` (default 900s) fails with an actionable message instead of waiting forever. Also reports the real package version to clients — it had been hardcoded to `0.1.0`.

## 0.5.1

### Patch Changes

- f0ff32d: Register the server in the official MCP Registry as `io.form/formio-mcp`. Adds the `mcpName` field that the registry uses to verify npm ownership, a root `server.json` describing the stdio transport and supported environment variables, and a release-workflow step that publishes to the registry after npm.

## 0.5.0

### Minor Changes

- a9012a6: Adding `formio-form`, `formio-form-builder` skills and general cleanup.

## 0.4.1

### Patch Changes

- ae993dc: Fixed issues with baseURL not getting set correctly.
- 4237e6c: Check cached JWT expiry locally before use. The MCP server now decodes a cached
  token's `exp` claim and clears expired tokens — both from the on-disk cache and
  the in-process cache — before attempting any request, triggering re-auth instead
  of thrashing on failing calls with a known-dead token.

## 0.4.0

### Minor Changes

- f75be94: Added authenticated route guards to the angular skill.

## 0.3.0

### Minor Changes

- 736278e: Added better authentication indication in login page. Improved formio-angular for correct Auth module use. Encourage the use of frontend-design skill when building applications.

## 0.2.0

### Minor Changes

- d98a326: Added form revision support.
