## 1. Server Config (make API key optional, add login form URL and JWT field)

### Red

- [x] 1.1 Write failing test: `getConfig()` returns successfully when only `FORMIO_PROJECT_URL` is set (no `FORMIO_API_KEY`)
- [x] 1.2 Write failing test: `getConfig()` returns `loginFormUrl` from `FORMIO_LOGIN_FORM` when set
- [x] 1.3 Write failing test: `getConfig()` returns `apiKey: undefined` and `loginFormUrl: undefined` when optional env vars are not set
- [x] 1.4 Write failing test: `FormioConfig` has a mutable `jwt` field that is initially `undefined`

### Green

- [x] 1.5 Update `FormioConfig` interface: make `apiKey` optional, add optional `loginFormUrl` and mutable `jwt` fields
- [x] 1.6 Update `getConfig()`: remove the `FORMIO_API_KEY` required check, read `FORMIO_LOGIN_FORM`, return new shape
- [x] 1.7 Fix any existing tests that depend on `apiKey` being required

### Refactor

- [x] 1.8 Review implementation and refactor as needed

## 2. Token Cache (read/write/clear cached JWTs to disk)

### Red

- [x] 2.1 Write failing test: `saveToken()` writes JWT to `~/.formio/mcp-tokens.json` keyed by project URL
- [x] 2.2 Write failing test: `readToken()` returns cached JWT for a given project URL, or `null` if not found
- [x] 2.3 Write failing test: `readToken()` returns `null` when cache file does not exist
- [x] 2.4 Write failing test: `clearToken()` removes the entry for a project URL without affecting others
- [x] 2.5 Write failing test: cache file is created with `0600` permissions

### Green

- [x] 2.6 Create `src/token-cache.ts` with `saveToken(projectUrl, jwt)`, `readToken(projectUrl)`, and `clearToken(projectUrl)` functions
- [x] 2.7 Implement directory creation, JSON read/write, and file permission setting

### Refactor

- [x] 2.8 Review implementation and refactor as needed

## 3. Formio Client (auth header selection and 401 re-auth)

### Red

- [x] 3.1 Write failing test: `formioFetch` sends `x-jwt-token` header when `config.jwt` is set
- [x] 3.2 Write failing test: `formioFetch` sends `x-token` header when `config.apiKey` is set and `jwt` is not
- [x] 3.3 Write failing test: `formioFetch` prefers `x-jwt-token` when both `jwt` and `apiKey` are present
- [x] 3.4 Write failing test: `formioFetch` throws when neither `jwt` nor `apiKey` is set
- [x] 3.5 Write failing test: on 401 in JWT mode, `formioFetch` calls the re-auth function and retries the request
- [x] 3.6 Write failing test: on 401 retry that also fails, `formioFetch` throws without infinite loop
- [x] 3.7 Write failing test: on 401 in API key mode, `formioFetch` throws without retry

### Green

- [x] 3.8 Update `formioFetch` to select auth header based on `config.jwt` vs `config.apiKey`
- [x] 3.9 Add re-auth callback parameter to `formioFetch` and implement 401 retry logic in JWT mode
- [x] 3.10 Fix any existing tests broken by the `formioFetch` signature or header changes

### Refactor

- [x] 3.11 Review implementation and refactor as needed

## 4. Token Validation (startup check via GET /current)

### Red

- [x] 4.1 Write failing test: `validateToken()` returns `true` when `GET /current` responds 200
- [x] 4.2 Write failing test: `validateToken()` returns `false` when `GET /current` responds 401
- [x] 4.3 Write failing test: `validateToken()` sends `x-jwt-token` header when config has JWT
- [x] 4.4 Write failing test: `validateToken()` sends `x-token` header when config has API key

### Green

- [x] 4.5 Create `src/token-validation.ts` with `validateToken(config)` that sends `GET {projectUrl}/current` with the appropriate auth header and returns a boolean

### Refactor

- [x] 4.6 Review implementation and refactor as needed

## 5. User Auth (ephemeral Express login flow)

### Red

- [x] 5.1 Write failing test: `authenticate()` starts an Express server on a random port and returns a JWT after `/callback` is hit
- [x] 5.2 Write failing test: `authenticate()` shuts down the Express server after capturing the JWT
- [x] 5.3 Write failing test: `GET /` serves an HTML page containing the Form.io SDK script tag and a `Formio.createForm` call with the login form URL
- [x] 5.4 Write failing test: `POST /callback` with `{ "token": "<jwt>" }` resolves the authenticate promise with the JWT
- [x] 5.5 Write failing test: `authenticate()` uses `FORMIO_LOGIN_FORM` when set, otherwise defaults to `{projectUrl}/user/login`

### Green

- [x] 5.6 Create `src/auth.ts` with `authenticate(config)` that starts Express, serves the login page, handles the callback, opens the browser, and resolves with the JWT
- [x] 5.7 Create the login HTML template (inline or template literal) that loads the Form.io SDK and renders the login form

### Refactor

- [x] 5.8 Review implementation and refactor as needed

## 6. Startup Integration (wire auth into server startup)

### Red

- [x] 6.1 Write failing test: startup validates a cached token and proceeds without login if valid
- [x] 6.2 Write failing test: startup triggers login flow when no cached token and no API key
- [x] 6.3 Write failing test: startup triggers login flow when cached token is expired (401 from /current)
- [x] 6.4 Write failing test: startup throws when API key is invalid (401 from /current in API key mode)
- [x] 6.5 Write failing test: after successful login, the JWT is saved to the token cache

### Green

- [x] 6.6 Create `src/startup-auth.ts` (or integrate into `server.ts`) that orchestrates: read cache → validate → login if needed → save cache → set `config.jwt`
- [x] 6.7 Update `stdio.ts` to call the startup auth flow before connecting the transport

### Refactor

- [x] 6.8 Review implementation and refactor as needed
