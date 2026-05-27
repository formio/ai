## Why

The MCP server currently authenticates all API requests using a shared admin API key (`x-token` header). This means every action — form creates, updates, submission reads — is logged as the administrator. We need user-level authentication so the Form.io API attributes actions to the actual user making requests, preserving accurate audit trails and respecting per-user access controls.

## What Changes

- Add an authentication module that spins up an ephemeral Express server, renders the project's login form via the Form.io SDK, captures the user's JWT on successful login, and shuts down
- Add token caching to disk (`~/.formio/mcp-tokens.json`) keyed by project URL so users don't re-authenticate on every MCP server restart
- Add a startup token validation step that hits `GET {baseUrl}/current` to check if a cached or provided token is still valid
- **BREAKING**: `FORMIO_API_KEY` becomes optional instead of required — if not provided, the server triggers the browser login flow
- Add `FORMIO_LOGIN_FORM` optional env var to override the default login form URL (`{projectUrl}/user/login`)
- Modify `formioFetch` to send `x-jwt-token` header when using a user JWT, falling back to `x-token` when using an API key
- Modify `formioFetch` to handle 401 responses by triggering re-authentication (in JWT mode) and retrying the request
- Modify `FormioConfig` to support both auth modes (API key and user JWT) with runtime-mutable JWT state

## Capabilities

### New Capabilities

- `user-auth`: Ephemeral Express login flow that renders the project's login form, captures the user's JWT, and provides it to the MCP server
- `token-cache`: Persistent token storage on disk keyed by project URL, with read/write/clear operations
- `token-validation`: Startup check that validates a cached or existing token against the Form.io API before proceeding

### Modified Capabilities

- `server-config`: `FORMIO_API_KEY` becomes optional; add optional `FORMIO_LOGIN_FORM`; `FormioConfig` gains a mutable `jwt` field and auth mode concept
- `formio-client`: `formioFetch` sends `x-jwt-token` or `x-token` based on auth mode; handles 401 with re-auth and retry in JWT mode

## Impact

- **Config**: `FormioConfig` interface changes (jwt field, apiKey becomes optional) — affects every tool file that receives config
- **HTTP client**: `formioFetch` header logic and error handling change — affects all API calls
- **Dependencies**: New dependencies on `express` and `open` (for browser launch) in the mcp-server package
- **Startup**: `createServer` or its caller must run token validation and potentially the login flow before the server is ready
- **All existing tests**: Tests that mock `formioFetch` or construct `FormioConfig` with a required `apiKey` will need updates
