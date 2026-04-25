## 1. ensure-auth module
<!-- depends_on: none -->

### Red

- [x] 1.1 Write failing test: `ensureAuthenticated(config)` sets `config.jwt` from a valid cached token without launching the login flow
- [x] 1.2 Write failing test: `ensureAuthenticated(config)` launches the login flow when no cached token and no API key, then saves the new JWT to the cache
- [x] 1.3 Write failing test: `ensureAuthenticated(config)` clears the cached token and launches the login flow when the cached token fails validation
- [x] 1.4 Write failing test: `ensureAuthenticated(config)` throws when `FORMIO_API_KEY` is set but `validateToken` returns false
- [x] 1.5 Write failing test: `ensureAuthenticated(config)` returns immediately without any I/O when `config.jwt` is already set
- [x] 1.6 Write failing test: concurrent calls to `ensureAuthenticated(config)` resolve via a single login flow (one call to `authenticate`, one cache write, one browser open)
- [x] 1.7 Write failing test: after `ensureAuthenticated` rejects, a subsequent call retries fresh (the pending promise is cleared on failure)
- [x] 1.8 Write failing test: `resetAuthState()` (test-only export) clears the internal `pendingAuth` reference

### Green

- [x] 1.9 Create `src/ensure-auth.ts` with `ensureAuthenticated(config)` and `resetAuthState()` exports; implement the happy path with cache read → validate → login → save → set `config.jwt`
- [x] 1.10 Add API-key-mode branch that validates and throws on failure without touching cache or login
- [x] 1.11 Add the short-circuit for when `config.jwt` is already populated
- [x] 1.12 Add module-level `pendingAuth` promise for single-flight concurrency control; ensure it is cleared on both success and failure
- [x] 1.13 Delete `src/startup-auth.ts` and its test file

### Refactor

- [x] 1.14 Review implementation and refactor as needed

## 2. formio-client integration
<!-- depends_on: 1 -->

### Red

- [x] 2.1 Write failing test: `formioFetch` invokes the auth gate before sending the outbound HTTP request
- [x] 2.2 Write failing test: `formioFetch` passes the same gate function as its 401 `onReauth` callback (after clearing the cached token and `config.jwt`)
- [x] 2.3 Write failing test: if the auth gate throws, `formioFetch` propagates the error without sending any HTTP request
- [x] 2.4 Write failing test: when the gate succeeds during a 401 retry, the retry uses the refreshed `config.jwt` header

### Green

- [x] 2.5 Wire `formioFetch` to call `ensureAuthenticated(config)` before the outbound request
- [x] 2.6 Update the 401 retry path in `formioFetch` to: clear cached token, clear `config.jwt`, call `ensureAuthenticated`, retry once
- [x] 2.7 Fix any existing `formioFetch` tests that break due to the new gate call (mock `ensureAuthenticated` where appropriate)

### Refactor

- [x] 2.8 Review implementation and refactor as needed

## 3. stdio entry point simplification
<!-- depends_on: 2 -->

### Red

- [x] 3.1 Write failing test (or static assertion): `src/stdio.ts` does not import from `ensure-auth`, `startup-auth`, `auth`, `token-validation`, or `token-cache`
- [x] 3.2 Write failing test: when the MCP server is constructed and connected, no browser open command is issued and no cache file is read

### Green

- [x] 3.3 Remove the `startupAuth` import and call from `src/stdio.ts`; the file should read config, call `createServer(config)`, connect the transport
- [x] 3.4 Remove the `config?` optional fallback in `createServer` if no longer needed by the new flow (or leave as-is if tests still use it)

### Refactor

- [ ] 3.5 Review implementation and refactor as needed

## 4. End-to-end behavior
<!-- depends_on: 3 -->

### Red

- [x] 4.1 Write failing integration test: simulate two concurrent tool calls against a mocked Form.io API with an unset `config.jwt`; assert exactly one `authenticate` call, one `saveToken` call, and both tool calls succeed with the same JWT
- [x] 4.2 Write failing integration test: simulate a tool call that receives a 401, then a second concurrent tool call during the re-auth; assert both resolve and `authenticate` is called exactly once

### Green

- [x] 4.3 Adjust `ensure-auth` or `formioFetch` as needed to make both integration tests pass without regressing unit tests

### Refactor

- [x] 4.4 Review implementation and refactor as needed
