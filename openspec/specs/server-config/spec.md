## ADDED Requirements

### Requirement: Server reads Form.io configuration from environment variables

The server SHALL read `FORMIO_PROJECT_URL` (required), `FORMIO_API_KEY` (optional), and `FORMIO_LOGIN_FORM` (optional) from `process.env` and return them as a typed configuration object. The config SHALL include a mutable `jwt` field (initially `undefined`) that is set at runtime after login.

#### Scenario: All environment variables are set

- **WHEN** `FORMIO_PROJECT_URL` is set to `https://form.local/example`, `FORMIO_API_KEY` is set to `abc123`, and `FORMIO_LOGIN_FORM` is set to `https://form.local/example/custom/login`
- **THEN** `getConfig()` returns `{ projectUrl: "https://form.local/example", apiKey: "abc123", loginFormUrl: "https://form.local/example/custom/login", jwt: undefined }`

#### Scenario: Only project URL is set (JWT mode)

- **WHEN** `FORMIO_PROJECT_URL` is set to `https://form.local/example` and `FORMIO_API_KEY` is not set
- **THEN** `getConfig()` returns `{ projectUrl: "https://form.local/example", apiKey: undefined, loginFormUrl: undefined, jwt: undefined }`

#### Scenario: Trailing slash is stripped from project URL

- **WHEN** `FORMIO_PROJECT_URL` is set to `https://form.local/example/`
- **THEN** `getConfig()` returns a config with `projectUrl` equal to `https://form.local/example` (no trailing slash)

#### Scenario: Login form URL defaults when not set

- **WHEN** `FORMIO_LOGIN_FORM` is not set and `FORMIO_PROJECT_URL` is `https://form.local/example`
- **THEN** the effective login form URL used by the auth module is `https://form.local/example/user/login`

### Requirement: Server fails fast on missing configuration

The server SHALL throw a descriptive error during startup if the required `FORMIO_PROJECT_URL` environment variable is missing. `FORMIO_API_KEY` is no longer required.

#### Scenario: FORMIO_PROJECT_URL is missing

- **WHEN** `FORMIO_PROJECT_URL` is not set
- **THEN** `getConfig()` throws an error with a message containing `FORMIO_PROJECT_URL`

#### Scenario: Only FORMIO_PROJECT_URL is set

- **WHEN** `FORMIO_PROJECT_URL` is set and `FORMIO_API_KEY` is not set
- **THEN** `getConfig()` returns successfully (API key is optional)

### Requirement: Configuration is validated at server creation

The `createServer()` function SHALL call `getConfig()` before registering tools, so that missing configuration causes an immediate startup failure.

#### Scenario: Server startup with valid config

- **WHEN** `createServer()` is called with valid environment variables
- **THEN** the server is created and tools are registered

#### Scenario: Server startup with missing project URL

- **WHEN** `createServer()` is called without `FORMIO_PROJECT_URL`
- **THEN** the server throws before any tools are registered
