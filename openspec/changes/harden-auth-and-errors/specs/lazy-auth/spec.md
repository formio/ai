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

## ADDED Requirements

### Requirement: A token removed from the cache is not reused from memory

Before reusing a JWT held in memory for a deployment, the authentication gate SHALL read that deployment's entry in the on-disk token cache. When the entry is absent or holds a different token, the in-memory token SHALL be discarded and the gate SHALL run the read-cache → validate → login-if-needed flow, so a sign-out from the CLI, or a sign-in under another account, takes effect on the next tool call without restarting the server.

#### Scenario: Signed out from the CLI

- **WHEN** a session holds a JWT in memory and `formio-mcp project logout` removes that deployment's cached token
- **THEN** the next tool call does not send the old token and starts the login flow

#### Scenario: Cache unchanged

- **WHEN** the on-disk entry holds the same token as memory
- **THEN** the gate reuses it without validating or logging in
