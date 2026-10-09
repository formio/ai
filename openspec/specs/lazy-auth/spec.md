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

`FORMIO_API_KEY` is issued by one project, so it SHALL apply only to that project: the key SHALL be in effect for a tool call when `FORMIO_PROJECT_URL` is set and the resolved Project URL is the same Project URL once both are normalized. Origins are not enough: the projects of a sub-directory deployment share one origin. When it is in effect, the authentication gate SHALL validate the key on first use and set no JWT, SHALL NOT open a browser or read/write the token cache, and requests SHALL send the `x-token` header.

When the key is set but not in effect — `FORMIO_PROJECT_URL` is unset, or the resolved project (from a committed `formio.json` or a directory mapping) is a different project — the resolved configuration SHALL carry no API key, the `x-token` header SHALL NOT be sent, and the gate SHALL run the portal-login flow exactly as it does when no key is set. The `project_get` report SHALL state that `FORMIO_API_KEY` is set but not applied to the resolved project, and name the project it applies to (or that `FORMIO_PROJECT_URL` is unset). A portal-login failure that names the API key as a remedy — no browser on the host, or the login timing out — SHALL state that reason instead of asking the user to set the key.

#### Scenario: Valid API key passes the gate

- **WHEN** `FORMIO_API_KEY` is set
- **AND** `FORMIO_PROJECT_URL` is `https://examples.form.io` and the resolved Project URL is `https://examples.form.io`
- **AND** a tool call triggers the auth gate for the first time
- **AND** `validateToken(config)` returns true
- **THEN** the gate succeeds without touching the token cache or launching a browser
- **AND** `config.jwt` remains undefined
- **AND** subsequent requests send the `x-token` header

#### Scenario: The key's own sub-directory project uses the key

- **WHEN** `FORMIO_API_KEY` is set and `FORMIO_PROJECT_URL` is `https://forms.mysite.com/myproject`
- **AND** the resolved Project URL is `https://forms.mysite.com/myproject`
- **THEN** requests send the `x-token` header and no browser is opened

#### Scenario: Another project on the same sub-directory deployment does not receive the key

- **WHEN** `FORMIO_API_KEY` is set and `FORMIO_PROJECT_URL` is `https://forms.mysite.com/myproject`
- **AND** a committed `formio.json` resolves the Project URL `https://forms.mysite.com/other`
- **THEN** no request carries the `x-token` header
- **AND** the resolution notes state the key is not applied

#### Scenario: A browserless login names the withheld key

- **WHEN** the key is set but not applied and the portal login fails because the host has no browser
- **THEN** the error states why the key was not applied
- **AND** it does not ask the user to set `FORMIO_API_KEY`

#### Scenario: A committed project on another origin does not receive the key

- **WHEN** `FORMIO_API_KEY` is set and `FORMIO_PROJECT_URL` is `https://examples.form.io`
- **AND** a committed `formio.json` resolves the Project URL `https://other.form.io`
- **THEN** no request carries the `x-token` header
- **AND** the gate runs the portal-login flow for the resolved deployment

#### Scenario: A key without FORMIO_PROJECT_URL is not applied

- **WHEN** `FORMIO_API_KEY` is set and `FORMIO_PROJECT_URL` is unset
- **AND** a directory mapping resolves a Project URL
- **THEN** no request carries the `x-token` header
- **AND** `project_get` states the key is not applied because `FORMIO_PROJECT_URL` is unset

### Requirement: The `stdio.ts` entry point does not perform authentication

The stdio entry point SHALL read configuration, create the MCP server, and connect the stdio transport in that order, with no authentication calls between those steps.

#### Scenario: Entry point has no auth imports

- **WHEN** inspecting `packages/mcp-server/src/stdio.ts`
- **THEN** it does not import `ensureAuthenticated`, `startupAuth`, `authenticate`, `validateToken`, or `token-cache`
- **AND** the transport is connected synchronously after `createServer(config)`

