## Purpose

Defines how the MCP server reads its Form.io configuration from the process environment — which variables it consults, how it normalizes them, and what happens when the ones it needs are absent.
## Requirements
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

### Requirement: A stand-alone server asks for both URLs before it needs them

The server SHALL be usable with no skills installed, so every piece of guidance an agent needs to configure a project SHALL come from the server itself. It SHALL declare MCP server `instructions` stating that Form.io tools need an active project, that the agent SHALL ask the user for the Project URL and — unless the deployment is the default `https://api.form.io` — the Base URL, and that the pair SHALL then be persisted with `project_set`. The instructions SHALL NOT name any client, skill, or plugin.

`baseUrl` is not cosmetic: it builds the portal-login URL and keys the JWT cache. Omitting it silently defaults to `https://api.form.io`, which points a self-hosted or on-premise user's login at the wrong deployment. Both the resolution error raised when no project is configured and the `project_set` tool description SHALL therefore name the base URL alongside the project URL, and SHALL state that consequence rather than merely listing the parameter as optional.

#### Scenario: Instructions reach a client with no skills installed

- **WHEN** any MCP client completes the initialize handshake with the server
- **THEN** the server's declared instructions describe asking the user for the Project URL and the Base URL and persisting them with `project_set`
- **AND** they name no client, skill, or plugin

#### Scenario: The resolution error names the base URL

- **WHEN** a project-scoped tool is called with no resolvable project
- **THEN** the error names `project_set`, the project URL, and the base URL
- **AND** it states that an omitted base URL defaults to `https://api.form.io`, which is wrong for a self-hosted deployment

#### Scenario: project_set states the consequence of omitting the base URL

- **WHEN** the `project_set` tool description is read
- **THEN** it states that the base URL builds the login URL and keys the cached token
- **AND** it states that omitting it falls back to `https://api.form.io`

### Requirement: The instructions state the three valid URL shapes

A `FORMIO_PROJECT_URL` / `FORMIO_BASE_URL` pair has exactly three valid shapes, and the server's own guidance SHALL state all three, because a stand-alone agent has no skill to consult:

1. **Form.io hosted cloud (SaaS).** The base URL is ALWAYS `https://api.form.io`. The project URL is the project's name as a sub-domain of `form.io` — a project named `examples` is `https://examples.form.io`.
2. **A customer-hosted deployment with sub-domain project routing.** The base URL is that deployment's own host, frequently itself a sub-domain of the customer's domain (`https://forms.mysite.com`). The project URL is the project's name as a **sibling sub-domain of the same parent domain** (`https://myproject.mysite.com`) — not a path under the base URL, and not under the base URL's host at all.
3. **A customer-hosted deployment with sub-directory project routing.** The base URL is that same kind of host (`https://forms.mysite.com`) and the project URL is a sub-directory of it (`https://forms.mysite.com/myproject`).

Shapes 1 and 2 are the same pattern; SaaS is the deployment whose parent domain is `form.io` and whose base host is `api`. The base URL never carries a path in any shape.

The instructions SHALL additionally rule out the three mistakes these shapes invite: a `*.form.io` host is never a base URL; `https://api.form.io/<project>` is not a hosted project URL; and a project host that differs from the base URL host is normal in shape 2, so a project URL SHALL NOT be built by appending a name to the base URL, and a base URL SHALL NOT be derived from a project URL that carries no path — it must be asked for. No guidance, tool description, or example the server ships SHALL offer a path-style hosted project URL, because a wrong base URL keys the JWT cache per project and builds the portal-login URL against the project sub-domain rather than the deployment.

#### Scenario: Instructions name the SaaS invariant

- **WHEN** any MCP client reads the server's declared instructions
- **THEN** they state that the base URL is always `https://api.form.io` on the hosted cloud, with the project as a sub-domain
- **AND** they state both customer-hosted shapes — a sibling sub-domain of the customer's domain, and a sub-directory of the deployment host
- **AND** they state that a `*.form.io` host is never a base URL

#### Scenario: Instructions forbid deriving either URL from the other

- **WHEN** any MCP client reads the server's declared instructions
- **THEN** they state that a project URL is never built by appending a project name to the base URL
- **AND** they state that a base URL is never derived from a project URL that carries no path, because the sub-domain shape puts the deployment on a different host

#### Scenario: No shipped example uses a path-style hosted project URL

- **WHEN** the server's instructions are searched for `https://api.form.io/<something>`
- **THEN** no such example appears

### Requirement: The bin configures a project without an MCP session

The `formio-mcp` bin SHALL accept a `project` command with two subcommands, `set` and `get`, so a project can be configured and inspected before any MCP client has connected. Invoked with no arguments the bin SHALL start the stdio server exactly as before — the command surface is additive and MUST NOT change the transport path.

`project set` SHALL accept `--project-url` (required), `--base-url` (optional, falling back to the base URL already mapped for that directory and only then to `FORMIO_BASE_URL` in the environment — the same precedence the `project_set` tool applies), and `--cwd` (optional, defaulting to `process.cwd()`, resolved to an absolute path). It SHALL write the working-directory → project mapping through the same `writeProjectEntry` path the `project_set` tool uses, so the file format, the merge behaviour, and the `0600` mode stay owned by one module. URL validation SHALL be the same normalization the `project_set` tool applies: `http`/`https` only, trailing slashes stripped, an actionable error naming the offending argument otherwise.

`project get` SHALL accept `--cwd` (same default) and print the resolved project URL, the resolved base URL, and **which source won** — this shell's environment or the working-directory mapping. Because the command runs in the caller's shell rather than the MCP server's process, it cannot see the server's own `env` block; when the mapping is the winning source it SHALL say so explicitly rather than present its output as what the server resolves. When neither supplies a project URL it SHALL print the same actionable message the tools raise, naming `project set`.

Both subcommands SHALL exit non-zero on failure and SHALL write nothing to stdout that a caller could mistake for MCP protocol traffic.

#### Scenario: No arguments still starts the stdio server

- **WHEN** the bin is invoked with no arguments
- **THEN** it connects a stdio transport and serves the full tool list, unchanged from before this change

#### Scenario: project set writes the mapping the server reads

- **WHEN** `formio-mcp project set --project-url https://x.form.io --base-url https://api.form.io --cwd /abs/path` runs
- **THEN** `readProjectEntry('/abs/path')` returns an entry whose `env.FORMIO_PROJECT_URL` is `https://x.form.io` and whose `env.FORMIO_BASE_URL` is `https://api.form.io`
- **AND** the file is written with mode `0600`
- **AND** mappings for other working directories are preserved

#### Scenario: project set defaults the cwd and the base URL

- **WHEN** `formio-mcp project set --project-url https://x.form.io` runs with `FORMIO_BASE_URL` set in the environment
- **THEN** the mapping is keyed on the absolute `process.cwd()`
- **AND** the persisted base URL is the environment value

#### Scenario: project set rejects a bad URL

- **WHEN** `--project-url` is not a valid `http`/`https` URL
- **THEN** the command exits non-zero
- **AND** the error names `projectUrl` and the received value

#### Scenario: project get reports the mapping as the winning source

- **WHEN** a mapping exists for the cwd and `FORMIO_PROJECT_URL` is absent from the environment
- **THEN** `project get --cwd <that path>` prints the mapped project URL and base URL
- **AND** it names the working-directory mapping as the source
- **AND** it states that the MCP server's own environment is not visible from this shell, so a `FORMIO_PROJECT_URL` set there would still take precedence

#### Scenario: project get reports the environment as the winning source

- **WHEN** `FORMIO_PROJECT_URL` is set in the environment and a different mapping exists for the cwd
- **THEN** `project get` prints the environment's project URL
- **AND** it names the environment as the source, so a user can see why their mapping is not taking effect

#### Scenario: project get with nothing configured is actionable

- **WHEN** no mapping exists for the cwd and no `FORMIO_PROJECT_URL` is in the environment
- **THEN** `project get` exits non-zero
- **AND** its message names `project set` as the fix

#### Scenario: A configured mapping resolves on the first tool call

- **WHEN** `project set` runs before any client has connected, and a client then starts the server and calls a Form.io tool with that cwd
- **THEN** the tool resolves its project from the mapping without any prior `project_set` tool call

