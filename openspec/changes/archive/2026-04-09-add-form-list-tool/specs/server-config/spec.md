## ADDED Requirements

### Requirement: Server reads Form.io configuration from environment variables

The server SHALL read `FORMIO_PROJECT_URL` and `FORMIO_API_KEY` from `process.env` and return them as a typed configuration object.

#### Scenario: Both environment variables are set

- **WHEN** `FORMIO_PROJECT_URL` is set to `https://form.local/example` and `FORMIO_API_KEY` is set to `abc123`
- **THEN** `getConfig()` returns `{ projectUrl: "https://form.local/example", apiKey: "abc123" }`

#### Scenario: Trailing slash is stripped from project URL

- **WHEN** `FORMIO_PROJECT_URL` is set to `https://form.local/example/`
- **THEN** `getConfig()` returns a config with `projectUrl` equal to `https://form.local/example` (no trailing slash)

### Requirement: Server fails fast on missing configuration

The server SHALL throw a descriptive error during startup if either required environment variable is missing.

#### Scenario: FORMIO_PROJECT_URL is missing

- **WHEN** `FORMIO_PROJECT_URL` is not set and `FORMIO_API_KEY` is set
- **THEN** `getConfig()` throws an error with a message containing `FORMIO_PROJECT_URL`

#### Scenario: FORMIO_API_KEY is missing

- **WHEN** `FORMIO_API_KEY` is not set and `FORMIO_PROJECT_URL` is set
- **THEN** `getConfig()` throws an error with a message containing `FORMIO_API_KEY`

#### Scenario: Both variables are missing

- **WHEN** neither `FORMIO_PROJECT_URL` nor `FORMIO_API_KEY` is set
- **THEN** `getConfig()` throws an error

### Requirement: Configuration is validated at server creation

The `createServer()` function SHALL call `getConfig()` before registering tools, so that missing configuration causes an immediate startup failure.

#### Scenario: Server startup with valid config

- **WHEN** `createServer()` is called with valid environment variables
- **THEN** the server is created and tools are registered

#### Scenario: Server startup with missing config

- **WHEN** `createServer()` is called without required environment variables
- **THEN** the server throws before any tools are registered
