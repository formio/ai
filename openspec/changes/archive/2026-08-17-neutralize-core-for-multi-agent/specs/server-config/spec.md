## MODIFIED Requirements

### Requirement: Server reads Form.io configuration from environment variables

The server SHALL read `FORMIO_BASE_URL` (optional, defaulting to `https://api.form.io`), `FORMIO_PROJECT_URL` (optional), `FORMIO_API_KEY` (optional), `FORMIO_LOGIN_FORM` (optional), `FORMIO_AUTH_HOST` (optional), `FORMIO_AUTH_PORT` (optional), `FORMIO_AUTH_TIMEOUT` (optional, in seconds), `FORMIO_INSECURE_TLS` (optional), and `FORMIO_FORCE_BROWSER` (optional) from `process.env` and return them as a typed configuration object. The config SHALL include a mutable `jwt` field (initially `undefined`) that is set at runtime after login. Trailing slashes SHALL be stripped from both URLs.

The defaults SHALL NOT vary by host or agent. The server SHALL NOT read any host-mode environment variable — in particular, `FORMIO_PLUGIN_CONTEXT` SHALL have no effect on configuration, on which tools are registered, or on any tool's input schema.

#### Scenario: All environment variables are set

- **WHEN** `FORMIO_BASE_URL` is `https://forms.example.com`, `FORMIO_PROJECT_URL` is `https://forms.example.com/example`, `FORMIO_API_KEY` is `abc123`, and `FORMIO_LOGIN_FORM` is `https://forms.example.com/example/custom/login`
- **THEN** `getConfig()` returns a config whose `baseUrl` is `https://forms.example.com`, whose `projectUrl` is `https://forms.example.com/example`, whose `apiKey` is `abc123`, whose `loginFormUrl` is `https://forms.example.com/example/custom/login`, and whose `jwt` is `undefined`

#### Scenario: Only project URL is set (JWT mode)

- **WHEN** `FORMIO_PROJECT_URL` is `https://forms.example.com/example` and neither `FORMIO_API_KEY` nor `FORMIO_LOGIN_FORM` is set
- **THEN** `getConfig()` returns a config whose `projectUrl` is `https://forms.example.com/example`, whose `apiKey` is `undefined`, whose `loginFormUrl` is `undefined`, and whose `jwt` is `undefined`

#### Scenario: Trailing slash is stripped from project URL

- **WHEN** `FORMIO_PROJECT_URL` is `https://forms.example.com/example/`
- **THEN** the returned `projectUrl` is `https://forms.example.com/example` (no trailing slash)

#### Scenario: Login form URL defaults when not set

- **WHEN** `FORMIO_LOGIN_FORM` is not set
- **THEN** `getConfig()` returns a config whose `loginFormUrl` is `undefined`
- **AND** the auth module resolves the login form lazily, at the point the login page is served, by probing `${baseUrl}/formio/user/login`, then `${projectUrl}/admin/login`, then `${projectUrl}/user/login`, and caching the first that responds
- **AND** no single URL is baked in as a default at configuration time, because the correct candidate depends on the deployment

#### Scenario: Base URL defaults to the hosted cloud

- **WHEN** `FORMIO_BASE_URL` is not set
- **THEN** `getConfig()` returns a config whose `baseUrl` is `https://api.form.io`

#### Scenario: Base URL default does not depend on host mode

- **WHEN** `FORMIO_BASE_URL` is not set and `FORMIO_PLUGIN_CONTEXT` is set to `1`
- **THEN** `getConfig()` returns a config whose `baseUrl` is `https://api.form.io`
- **AND** it does not throw

#### Scenario: Project URL may be absent

- **WHEN** `FORMIO_PROJECT_URL` is not set
- **THEN** `getConfig()` returns a config whose `projectUrl` is `undefined`
- **AND** it does not throw

#### Scenario: Project URL is read regardless of host mode

- **WHEN** `FORMIO_PROJECT_URL` is `https://example.form.io` and `FORMIO_PLUGIN_CONTEXT` is set to `1`
- **THEN** `getConfig()` returns a config whose `projectUrl` is `https://example.form.io`

#### Scenario: Trailing slashes are stripped from both URLs

- **WHEN** `FORMIO_BASE_URL` is `https://forms.example.com/` and `FORMIO_PROJECT_URL` is `https://forms.example.com/example/`
- **THEN** the returned `baseUrl` is `https://forms.example.com` and the returned `projectUrl` is `https://forms.example.com/example`

### Requirement: Configuration is validated at server creation

The `createServer()` function SHALL call `getConfig()` before registering tools, so that every tool handler shares one configuration object. Reading configuration SHALL NOT fail for absent optional values, and SHALL NOT depend on how the process was launched.

#### Scenario: Server startup with valid config

- **WHEN** `createServer()` is called with `FORMIO_BASE_URL` and `FORMIO_PROJECT_URL` set
- **THEN** the server is created and all tools are registered against that configuration

#### Scenario: Server startup with missing project URL

- **WHEN** `createServer()` is called without `FORMIO_PROJECT_URL`
- **THEN** the server is created and all tools are registered
- **AND** it does not throw, because the missing project is reported by the first project-scoped tool call rather than at startup

#### Scenario: Server creation with an empty environment

- **WHEN** `createServer()` is called with no `FORMIO_*` variables set
- **THEN** the server is created and all tools are registered

## ADDED Requirements

### Requirement: Server starts with no configuration and serves its full tool list

The server SHALL start successfully, complete the MCP handshake, and answer `tools/list` with every tool when no Form.io environment variable is set. Missing project configuration SHALL be reported at the point a project is actually needed — as a tool error naming `project_set` and `FORMIO_PROJECT_URL` — never as a startup failure. Registry crawlers and client directories launch the server with no configuration to read its tool list, so a startup throw presents the server as having no tools.

#### Scenario: Handshake and tool list with an empty environment

- **WHEN** the server process is started with no `FORMIO_*` variables set
- **THEN** the MCP handshake completes
- **AND** `tools/list` returns the full tool set, including `project_set`

#### Scenario: Missing project surfaces at call time, not startup

- **WHEN** the server is started with no `FORMIO_*` variables set
- **AND** `form_list` is called
- **THEN** the call returns an error naming `project_set` and `FORMIO_PROJECT_URL`
- **AND** the server remains connected

## REMOVED Requirements

### Requirement: Server fails fast on missing configuration

**Reason**: Startup validation is incompatible with the way clients and registry crawlers launch the server — they start it with no configuration in order to read `tools/list`, and a throw made the server look empty. It is also what forced a host-mode flag: the plugin, which supplies no project URL, needed different startup rules from a standalone launch. Project resolution now raises an actionable error at the point of use instead, identically for every agent.

**Migration**: Callers relying on a startup throw for misconfiguration SHALL instead call any project-scoped tool (or `project_set`) and handle the returned tool error, which names both `project_set` and `FORMIO_PROJECT_URL`.
