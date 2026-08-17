## Purpose

Defines when the server authenticates: not at startup, but at the first Form.io API call — with the JWT reused afterwards, concurrent calls sharing one flow, 401s re-entering the same gate, failures surfacing as tool errors rather than crashes, and API-key mode bypassing the flow entirely.

## Requirements

### Requirement: Authentication is deferred until the first Form.io API call

The MCP server SHALL NOT perform any authentication work during process startup or stdio transport connection. Authentication SHALL be triggered only when a Form.io tool makes its first outbound API request.

#### Scenario: Server starts without prompting for authentication

- **WHEN** the MCP server process starts and connects its stdio transport
- **THEN** no token cache read is performed
- **AND** no browser window is opened
- **AND** the MCP client can successfully complete the MCP handshake

#### Scenario: Authentication is triggered by the first tool call

- **WHEN** a Form.io tool handler invokes `formioFetch` for the first time in the process
- **THEN** the authentication gate runs before the HTTP request leaves the process
- **AND** the gate reads the cached token, validates it, and launches the login flow only if needed

### Requirement: Subsequent tool calls reuse the in-memory JWT

Once the authentication gate has successfully populated `config.jwt`, subsequent tool calls SHALL NOT re-read the token cache, re-validate, or re-launch the login flow on the happy path.

#### Scenario: Second tool call skips the auth flow

- **WHEN** the authentication gate has already set `config.jwt` in this process
- **AND** a second tool call invokes `formioFetch`
- **THEN** the gate returns immediately without reading the cache or calling `validateToken`
- **AND** the HTTP request proceeds with the existing `x-jwt-token` header

### Requirement: Concurrent tool calls share a single auth flow

When multiple Form.io tool calls arrive before the first authentication has completed, the gate SHALL ensure that exactly one login flow runs and all waiters resolve with the same result.

#### Scenario: Parallel first-time tool calls open one browser window

- **WHEN** two or more tool calls invoke `formioFetch` within the same tick, before `config.jwt` is set
- **THEN** exactly one browser window is opened
- **AND** exactly one entry is written to the token cache
- **AND** all waiting tool calls proceed with the same JWT once the login completes

#### Scenario: A 401 retry during pending auth waits instead of starting a second login

- **WHEN** the auth gate is currently executing a login flow (`pendingAuth` is set)
- **AND** a separate tool call receives a 401 from the Form.io API and triggers the re-auth callback
- **THEN** the re-auth callback awaits the in-flight auth promise instead of starting a new login

### Requirement: 401 responses trigger re-authentication through the same gate

When `formioFetch` receives a 401 in JWT mode, the re-auth callback SHALL clear the cached token and invoke the authentication gate. The gate SHALL then run the full read-cache → validate → login-if-needed flow, with the same single-flight semantics as the first-call path.

#### Scenario: 401 mid-session triggers re-auth and retry

- **WHEN** a tool call receives a 401 response from the Form.io API
- **AND** `config.jwt` was set (JWT mode)
- **THEN** the cached token is cleared for the current project URL
- **AND** `config.jwt` is cleared
- **AND** the authentication gate runs, populating a fresh `config.jwt`
- **AND** `formioFetch` retries the original request with the new JWT

#### Scenario: Re-auth shares the single-flight lock

- **WHEN** the auth gate is mid-login
- **AND** a 401 arrives from another pending tool call
- **THEN** the 401 re-auth callback awaits the existing pending auth promise
- **AND** no second browser window opens

### Requirement: Authentication failures surface as tool errors, not server crashes

When the authentication gate fails (e.g., user closes the browser, API key invalid, login server cannot bind), the error SHALL propagate through `formioFetch` to the tool handler and be returned to the MCP client as a tool error. The MCP server process SHALL remain connected and capable of handling subsequent tool calls.

#### Scenario: Login abandonment results in a tool error

- **WHEN** the user closes the browser window without submitting the login form
- **AND** the tool call's `formioFetch` call was awaiting the auth gate
- **THEN** the tool call receives an authentication error as its result
- **AND** the MCP server remains connected
- **AND** a subsequent tool call can trigger a fresh login attempt

#### Scenario: Invalid API key produces a tool error on first call

- **WHEN** `FORMIO_API_KEY` is set to an invalid key
- **AND** the first Form.io tool call invokes the auth gate
- **THEN** `validateToken` returns false
- **AND** the gate throws an error
- **AND** the tool returns an error to the MCP client
- **AND** the server remains connected

### Requirement: API key mode bypasses the login flow

When `FORMIO_API_KEY` is set, the authentication gate SHALL validate the key on first use and set no JWT. It SHALL NOT open a browser or read/write the token cache.

#### Scenario: Valid API key passes the gate

- **WHEN** `FORMIO_API_KEY` is set
- **AND** a tool call triggers the auth gate for the first time
- **AND** `validateToken(config)` returns true
- **THEN** the gate succeeds without touching the token cache or launching a browser
- **AND** `config.jwt` remains undefined
- **AND** subsequent requests send the `x-token` header

### Requirement: The `stdio.ts` entry point does not perform authentication

The stdio entry point SHALL read configuration, create the MCP server, and connect the stdio transport in that order, with no authentication calls between those steps.

#### Scenario: Entry point has no auth imports

- **WHEN** inspecting `packages/mcp-server/src/stdio.ts`
- **THEN** it does not import `ensureAuthenticated`, `startupAuth`, `authenticate`, `validateToken`, or `token-cache`
- **AND** the transport is connected synchronously after `createServer(config)`
