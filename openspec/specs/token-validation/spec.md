## Purpose

Defines how a token is checked before use — validated against `GET /current` rather than trusted because it exists.

## Requirements

### Requirement: Token is validated on startup via GET /current

On startup, the MCP server SHALL validate any available token (cached JWT or API key) by sending a request to `GET {projectUrl}/current` with the appropriate auth header. A 200 response means the token is valid.

#### Scenario: Valid JWT token on startup

- **WHEN** the server starts with a cached JWT that is still valid
- **THEN** `GET {projectUrl}/current` returns 200
- **AND** the server proceeds without triggering the login flow

#### Scenario: Valid API key on startup

- **WHEN** the server starts with `FORMIO_API_KEY` set to a valid key
- **THEN** `GET {baseUrl}/current` with `x-token` header returns 200
- **AND** the server proceeds normally

#### Scenario: Expired JWT triggers login flow

- **WHEN** the server starts with a cached JWT that has expired
- **THEN** `GET {baseUrl}/current` returns 401
- **AND** the cached token is cleared
- **AND** the login flow is triggered

#### Scenario: Invalid API key fails with error

- **WHEN** the server starts with `FORMIO_API_KEY` set to an invalid key
- **THEN** `GET {baseUrl}/current` returns 401
- **AND** the server throws an error indicating the API key is invalid

#### Scenario: No token and no API key triggers login flow

- **WHEN** the server starts with no cached JWT and no `FORMIO_API_KEY`
- **THEN** the login flow is triggered immediately
