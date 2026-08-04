# @formio/mcp

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
