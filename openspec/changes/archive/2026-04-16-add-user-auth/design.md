## Context

The MCP server currently reads `FORMIO_PROJECT_URL` and `FORMIO_API_KEY` from environment variables at startup (`config.ts`). The `formioFetch` function sends every request with an `x-token` header set to the API key. This means all actions are attributed to the admin, regardless of who initiated them through the MCP client.

The Form.io API supports user-level authentication via `x-jwt-token` headers. The Form.io JavaScript SDK (`Formio.createForm`) can render any project's login form and handles the authentication flow, storing the resulting JWT via `Formio.getToken()`. The appserver already has an `authorize.html` that demonstrates this pattern.

Express is already a dependency of the mcp-server package.

## Goals / Non-Goals

**Goals:**

- Authenticate the MCP server user via the project's own login form so API calls are attributed to them
- Cache tokens to disk so users don't re-authenticate on every MCP server restart
- Validate cached tokens on startup and re-authenticate if expired
- Handle 401 responses mid-session by re-authenticating and retrying
- Preserve the API key path as a fallback for headless/CI environments

**Non-Goals:**

- Proactive token refresh (background polling for expiry) — reactive 401 handling is sufficient for now
- PKCE or OAuth flow — we capture the JWT directly from the Form.io SDK
- Supporting multiple simultaneous users — one user per MCP server instance
- Token encryption at rest — the cached JWT file has the same security posture as a `.env` file with an API key

## Decisions

### 1. Ephemeral Express server for the login flow

Spin up a temporary Express server on port 0 (OS-assigned), serve a login page that uses the Form.io SDK to render the project's login form, capture the JWT via a POST to `/callback`, then shut down.

**Why over alternatives:**

- **Over polling a submission resource**: No server-side form/action changes needed, no JWT sitting at rest in a submission, no polling latency
- **Over requiring the user to manually paste a JWT**: Poor UX, error-prone
- **Over PKCE flow**: Unnecessary complexity — we control the login page and can capture the JWT directly

The Express server listens only on `localhost`, is alive for seconds, and has exactly two routes (`GET /` and `POST /callback`).

### 2. Two auth modes in FormioConfig

`FormioConfig` supports two mutually exclusive auth modes determined at startup:

- **API key mode**: `FORMIO_API_KEY` is set → use `x-token` header, no login flow, 401 errors are fatal
- **JWT mode**: No API key → trigger login flow, use `x-jwt-token` header, 401 triggers re-auth

The config interface gains an optional `jwt` field that is set at runtime after login. The `apiKey` field becomes optional. A helper function determines which auth header to send.

**Why not a union type or separate config types**: The config is passed to every tool and to `formioFetch`. A single type with optional fields is simpler than threading a discriminated union through the entire codebase. The `formioFetch` function checks which field is present.

### 3. Token cache at `~/.formio/mcp-tokens.json`

Tokens are cached to disk keyed by project URL. On startup, the server reads the cache, and if a token exists for the current project URL, validates it before using it.

Structure: `{ "<projectUrl>": "<jwt>" }`

**Why `~/.formio/`**: Follows the convention of CLI tools storing config in a dotfile directory in the user's home. Keeps it separate from project-level config.

### 4. Token validation via `GET {baseUrl}/current`

On startup (after reading config and cache), send a request to the `/current` endpoint. If it returns 200, the token is valid. If 401, clear the cached token and trigger the login flow (or fail in API key mode).

**Why `/current`**: It's a lightweight endpoint that the Form.io API already exposes. It returns the current user object, which also confirms the token maps to a real user.

### 5. Reactive re-auth on 401 in formioFetch

When `formioFetch` receives a 401 in JWT mode, it triggers the login flow, updates `config.jwt`, and retries the original request exactly once. If the retry also fails, it throws.

**Why not proactive**: Adds complexity (background timers, token introspection) for marginal benefit. Most MCP sessions are short enough that a single JWT lifetime covers them. Re-auth on 401 is simple and correct.

### 6. Login page served by the ephemeral server

The login page is an HTML file (similar to appserver's `authorize.html`) that:

1. Loads the Form.io SDK from CDN (`https://cdn.form.io/js/5.2.2/formio.form.min.js`)
2. Renders the login form via `Formio.createForm(el, loginFormUrl)`
3. On form submission, reads `Formio.getToken()` and POSTs it to `/callback`

The login form URL defaults to `${projectUrl}/user/login` but can be overridden via `FORMIO_LOGIN_FORM`.

### 7. Auth module as a pure function

The auth module exports a function `authenticate(config: FormioConfig): Promise<void>` that mutates `config.jwt` in place. This keeps the auth logic decoupled from the server setup. The `createServer` function (or `stdio.ts`) calls it before connecting the transport.

`formioFetch` also needs access to this function for re-auth on 401. It receives a reference to the authenticate function (or the auth module) so it can trigger re-auth without circular dependencies.

## Risks / Trade-offs

- **Browser availability**: The login flow requires a browser. If running in a headless environment without `FORMIO_API_KEY`, the server will hang waiting for login. Mitigation: detect headless environments and log a clear error message suggesting `FORMIO_API_KEY`.
- **Port conflicts**: Using port 0 eliminates conflicts, but firewalls or security software could block localhost listeners. Mitigation: clear error message if Express fails to bind.
- **CDN dependency**: The login page loads the Form.io SDK from `cdn.form.io`. If the CDN is down, login fails. Mitigation: this is the same dependency the Form.io platform itself has; acceptable risk.
- **Token file security**: `~/.formio/mcp-tokens.json` contains JWTs in plaintext. Same security posture as `.env` files with API keys. Mitigation: set file permissions to 600 (owner-only read/write).
- **Stdio blocking during auth**: The MCP server can't respond to messages while waiting for the user to log in via the browser. Mitigation: authenticate before connecting the transport, so the MCP client sees the server as "not yet ready" rather than "unresponsive".
