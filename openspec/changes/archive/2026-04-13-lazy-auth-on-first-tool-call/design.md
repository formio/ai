## Context

The MCP server currently calls `startupAuth(config)` in `stdio.ts` before connecting the stdio transport. This means the server process cannot respond to MCP protocol messages until authentication completes. Since JWT-mode auth involves opening a browser and waiting for the user to submit a login form, this can take many seconds — long enough for MCP clients (e.g., Claude Code) to hit their connection timeout and declare the server unresponsive.

The existing auth building blocks are well-factored: `readToken`, `validateToken`, `saveToken`, `clearToken`, and `authenticate` each do one thing. `formioFetch` already has a 401-retry path that calls a re-auth callback. What's missing is a gate that sits in front of every API call, checks that auth state is valid, and triggers the login flow only when needed — and does so without racing itself when multiple tool calls arrive in parallel.

## Goals / Non-Goals

**Goals:**

- MCP server connects its stdio transport immediately on launch, with no auth-related blocking
- First Form.io tool call triggers the full auth flow (cache read → validate → login if needed → save)
- Subsequent tool calls reuse the in-memory JWT without hitting the cache or validating again
- Parallel tool calls during the first invocation share a single login flow (one browser window, one cache write)
- 401 responses mid-session still trigger re-auth via the same gate
- API-key mode continues to validate the key on first use (not at startup)

**Non-Goals:**

- Background token refresh or proactive expiry checks
- Supporting multiple concurrent user identities
- Changing the login flow itself (HTML template, ephemeral Express server, browser launch) — that remains exactly as implemented
- Changing the `FormioConfig` shape or the `authenticate`/`validateToken`/`token-cache` modules' public APIs

## Decisions

### 1. New `ensure-auth` module, not a rename of `startup-auth`

Create `src/ensure-auth.ts` with an `ensureAuthenticated(config)` function. Delete `src/startup-auth.ts`. The semantics are materially different (idempotent, safe on every call, includes single-flight lock) and keeping the old name would mislead readers.

**Why over renaming in-place**: The change has different semantics and different test surface. A new module with a clean name makes the shift explicit; the old module's tests don't map 1:1 to the new behavior.

### 2. Single-flight lock via a cached promise

`ensureAuthenticated` uses a module-level `pendingAuth: Promise<void> | null`. If set, return it; otherwise start a new auth flow, store the promise, clear it on completion. This guarantees at most one concurrent login flow.

**Why over a mutex library or per-config locks**: The MCP server has exactly one auth identity per process lifetime. A module-level promise is simpler than a mutex and sufficient for the one-identity case. Per-config locks add generality we don't need.

### 3. Integrate the gate via `formioFetch`, not per-tool

Add an optional `ensureAuth?: () => Promise<void>` parameter to `formioFetch` (or inject it via the module that calls `formioFetch`). The gate runs before the outbound request. All existing tools call `formioFetch` and inherit the behavior without modification.

**Why over wrapping each tool handler**: Modifying every tool (and every future tool) to add an auth check violates Open/Closed — `formioFetch` is the natural extension point because it's the single choke point for API calls. Wrapping tools would also force the gate into every tool's tests, adding noise.

### 4. Reuse the existing 401 retry path for re-auth

`formioFetch` already calls an `onReauth` callback on 401. Point that callback at `ensureAuthenticated` (after clearing the cached token and `config.jwt`) so the re-auth path and the first-call path share the single-flight lock. This also means if a 401 fires while auth is pending, the 401 handler waits on the existing promise instead of starting a second login.

### 5. Remove `stdio.ts` startup auth call

The new `stdio.ts` is identical to the pre-`add-user-auth` version: read config, create server, connect transport. No auth logic in the entry point.

### 6. Auth errors propagate as tool errors, not startup failures

If a tool call triggers auth and auth fails (e.g., user closes the browser, API key invalid), the error bubbles up through `formioFetch` to the tool handler, which reports it as a tool error via the MCP response. The server stays connected and the user can retry by invoking another tool.

**Why over crashing the server**: The server is useful even when auth fails — the user may want to reconfigure `FORMIO_API_KEY` or restart the login. Killing the process forces a full MCP reconnect.

## Risks / Trade-offs

- **First-call latency**: The first tool call after MCP connection will take as long as the full login flow. Mitigation: none needed — this is strictly better than the client timing out before the server is reachable, and subsequent calls are unaffected.
- **Racy test setup**: Module-level `pendingAuth` state persists between tests. Mitigation: expose a `resetAuthState()` helper (test-only export) and call it in `beforeEach`.
- **Re-auth loop on persistent 401**: If auth succeeds but the fresh JWT still returns 401, the current single-retry guard in `formioFetch` prevents an infinite loop. No change needed, but we test for this.
- **Concurrency edge case**: Two tool calls arrive microseconds apart; both check `config.jwt`, both see it unset, both call `ensureAuthenticated`. The single-flight lock handles this correctly because the first call sets `pendingAuth` synchronously before returning control.
