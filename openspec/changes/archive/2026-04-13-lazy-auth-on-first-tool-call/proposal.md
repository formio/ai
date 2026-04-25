## Why

Authenticating at startup forces the MCP server to block on an interactive browser login before it can connect its stdio transport. MCP clients (e.g., Claude Code) have a connection timeout, so long user interactions during login can cause the client to give up before the server is ready. Additionally, users who never invoke a Form.io tool are forced through auth unnecessarily.

Deferring authentication until the first Form.io tool call lets the MCP server connect instantly, eliminates client connection timeouts, and only prompts for login when actually needed.

## What Changes

- **BREAKING** Remove the startup auth flow from `stdio.ts` — the server no longer calls `startupAuth` before connecting the transport
- **BREAKING** Rename `startupAuth` to `ensureAuthenticated` and change its semantics to be idempotent: safe to call on every tool invocation, it only performs work when `config.jwt` is missing or invalid
- Introduce a single-flight gate so that concurrent tool calls trigger exactly one browser login (no duplicate windows)
- Wire `ensureAuthenticated` into the Form.io API request path so every tool call checks auth before hitting the API
- Keep the 401 re-auth path in `formioFetch` (handles mid-session token expiry) — it should delegate to `ensureAuthenticated` to share the single-flight lock
- Remove the `src/startup-auth.ts` module; the on-demand auth orchestration lives in a new `src/ensure-auth.ts` module

## Capabilities

### New Capabilities

- `lazy-auth`: On-demand authentication gate that runs before every Form.io API call, with single-flight concurrency control and token cache integration

### Modified Capabilities

<!-- The specs from add-user-auth are not yet archived into openspec/specs/,
     so this change adds a new capability rather than modifying existing ones.
     The `user-auth`, `token-cache`, and `token-validation` capabilities from
     add-user-auth remain unchanged in behavior — they are re-wired, not altered. -->

## Impact

- **Code**: `packages/mcp-server/src/stdio.ts` (remove startup auth call), `packages/mcp-server/src/formio-client.ts` (integrate auth gate), delete `packages/mcp-server/src/startup-auth.ts`, add `packages/mcp-server/src/ensure-auth.ts`
- **Tests**: remove `startup-auth.test.ts`, add `ensure-auth.test.ts`, update `formio-client.test.ts` to verify auth gate integration
- **User experience**: MCP server becomes instantly connectable; first Form.io tool call has an added latency equal to the login flow duration (only on first use per session)
- **No new dependencies**
