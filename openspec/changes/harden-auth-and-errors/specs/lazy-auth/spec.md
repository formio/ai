## MODIFIED Requirements

### Requirement: 401 responses trigger re-authentication through the same gate

When `formioFetch` receives a 401 in JWT mode and `{baseUrl}/current` refuses the token, the re-auth callback SHALL clear the cached token and invoke the authentication gate. The gate SHALL then run the full read-cache → validate → login-if-needed flow, with the same single-flight semantics as the first-call path. A 401 whose token `/current` still accepts SHALL NOT clear the token or invoke the gate.

#### Scenario: 401 mid-session triggers re-auth and retry

- **WHEN** a tool call receives a 401 response from the Form.io API
- **AND** `config.jwt` was set (JWT mode)
- **AND** `{baseUrl}/current` refuses that token
- **THEN** the cached token is cleared for the current deployment
- **AND** `config.jwt` is cleared
- **AND** the authentication gate runs, populating a fresh `config.jwt`
- **AND** `formioFetch` retries the original request with the new JWT

#### Scenario: A permission refusal does not re-authenticate

- **WHEN** a tool call receives a 401 and `{baseUrl}/current` accepts the token
- **THEN** the cached token stays, the gate does not run, and no browser window opens

#### Scenario: Re-auth shares the single-flight lock

- **WHEN** the auth gate is mid-login
- **AND** a 401 arrives from another pending tool call
- **THEN** the 401 re-auth callback awaits the existing pending auth promise
- **AND** no second browser window opens

### Requirement: Concurrent tool calls share a single auth flow

When multiple Form.io tool calls arrive before the first authentication has completed, the gate SHALL ensure that exactly one login flow runs and all waiters resolve with the same result. Each tool call resolves its own configuration, so a call that joins a flow already in flight SHALL receive the resulting JWT on its own configuration, not only the call that started the flow.

#### Scenario: Parallel first-time tool calls open one browser window

- **WHEN** two or more tool calls invoke `formioFetch` within the same tick, before `config.jwt` is set
- **THEN** exactly one browser window is opened
- **AND** exactly one entry is written to the token cache
- **AND** all waiting tool calls proceed with the same JWT once the login completes, each on its own configuration

#### Scenario: A 401 retry during pending auth waits instead of starting a second login

- **WHEN** the auth gate is currently executing a login flow (`pendingAuth` is set)
- **AND** a separate tool call receives a 401 from the Form.io API and triggers the re-auth callback
- **THEN** the re-auth callback awaits the in-flight auth promise instead of starting a new login
- **AND** that call's retry carries the JWT the flow obtained

## ADDED Requirements

### Requirement: A token removed from the cache is not reused from memory

Before reusing a JWT held in memory for a deployment, the authentication gate SHALL check that deployment's entry in the on-disk token cache. When the file is missing, or is readable and has no entry for the deployment, or holds a different token, the in-memory token SHALL be discarded and the gate SHALL run the read-cache → validate → login-if-needed flow, so a sign-out from the CLI, or a sign-in under another account, takes effect on the next tool call without restarting the server. A file that exists but cannot be read or parsed says nothing about the token: the in-memory token SHALL be kept and no login SHALL start. The file SHALL be re-read only when its modification time, size, or inode changed since the last check; otherwise the last parsed result is reused.

#### Scenario: Signed out from the CLI

- **WHEN** a session holds a JWT in memory and `formio-mcp project logout` removes that deployment's cached token
- **THEN** the next tool call does not send the old token and starts the login flow

#### Scenario: Cache unchanged

- **WHEN** the on-disk entry holds the same token as memory
- **THEN** the gate reuses it without validating or logging in

#### Scenario: Cache file unreadable

- **WHEN** a session holds a JWT in memory and the cache file is torn or otherwise cannot be parsed
- **THEN** the gate reuses the in-memory token and no login starts

#### Scenario: File not changed since the last check

- **WHEN** the cache file's modification time, size, and inode are unchanged since the gate last read it
- **THEN** the gate reuses the last parsed result without reading the file
