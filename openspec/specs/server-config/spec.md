## Purpose

Defines how the MCP server reads its Form.io configuration from the process environment — which variables it consults, how it normalizes them, and what happens when the ones it needs are absent.
## Requirements
### Requirement: Server reads Form.io configuration from environment variables

The server SHALL read `FORMIO_BASE_URL` (optional), `FORMIO_PROJECT_URL` (optional), `FORMIO_API_KEY` (optional), `FORMIO_LOGIN_FORM` (optional), `FORMIO_AUTH_HOST` (optional), `FORMIO_AUTH_PORT` (optional), `FORMIO_AUTH_TIMEOUT` (optional, in seconds), `FORMIO_INSECURE_TLS` (optional), and `FORMIO_FORCE_BROWSER` (optional) from `process.env` and return them as a typed configuration object. The config SHALL include a mutable `jwt` field (initially `undefined`) that is set at runtime after login. Trailing slashes SHALL be stripped from both URLs.

It SHALL NOT read `FORMIO_DEFAULT_PROJECT_URL`, and the configuration object SHALL carry no `defaultProjectUrl` field. There is one project variable. Offering a project separately from setting one existed only because a set project could not be overridden; now that the environment is the weakest source, `FORMIO_PROJECT_URL` suggests without pinning, and a suggestion an agent might act on instead of asking is a liability rather than a convenience.

`baseUrl` SHALL be left undefined when the environment supplies nothing usable rather than defaulted here; resolution decides it last, from the shape of the resolved project URL.

#### Scenario: The offering variable is not read

- **WHEN** `FORMIO_DEFAULT_PROJECT_URL` is set in the environment
- **THEN** `getConfig()` returns a configuration with no `defaultProjectUrl`
- **AND** resolution behaves identically to when the variable is unset

#### Scenario: The defaults do not vary by host

- **WHEN** `FORMIO_PLUGIN_CONTEXT` is set to any value
- **THEN** the returned configuration is identical to when it is unset

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

### Requirement: A stand-alone server asks for the Project URL alone

The server SHALL be usable with no skills installed, so every piece of guidance an agent needs to configure a project SHALL come from the server itself. It SHALL declare MCP server `instructions` describing the **Project URL as the single configuration**: how to find what a directory resolves to, how to record a project, and that the Base URL is derived from the project URL wherever it can be and asked for only when it cannot. The instructions SHALL NOT instruct an agent to collect both URLs in one round, and SHALL NOT present the Base URL as a second value to persist: a value that is usually derived cannot be asked for before the answer it is derived from exists. They SHALL NOT name a client, skill, or plugin, and SHALL NOT name `FORMIO_DEFAULT_PROJECT_URL`.

The server's configuration **errors** SHALL be self-sufficient, because the skills library no longer restates this guidance and an agent may reach an error without having read the instructions. Each SHALL name the exact remedy command. They SHALL be split by where the guidance is actionable:

1. **No project URL resolves.** The error SHALL state that the project URL is not set and SHALL name `project set --project-url <project_url> --cwd <cwd>` in its runnable form alongside the `project_set` tool. It SHALL describe what a Project URL is and give an example per deployment kind. It SHALL NOT recite the full three-shape base-URL guidance: the base URL is derived from whatever project URL the user gives, so guidance about it cannot be acted on before that answer exists.
2. **A project URL resolves but the base URL cannot be determined.** The error SHALL state that the base URL cannot be determined **for that project URL**, SHALL echo the project URL, SHALL name `project set --base-url <base_url> --cwd <cwd>`, and SHALL explain that a path-less project URL on a customer domain names its deployment nowhere — the deployment is a sibling sub-domain. This is the only message where that explanation changes what the reader does, so it is the only message that carries it.

These SHALL be reported one at a time and in that order.

#### Scenario: Instructions present one configuration

- **WHEN** any MCP client reads the server's declared instructions
- **THEN** they describe the Project URL as the value to supply
- **AND** they state that the Base URL is derived from it wherever it can be
- **AND** they name no client, skill, or plugin

#### Scenario: Instructions do not open a two-value interview

- **WHEN** the server's declared instructions are searched
- **THEN** they do not ask for both URLs in a single round
- **AND** they do not instruct persisting both
- **AND** they describe `https://api.form.io` as derived for a form.io host rather than as a default

#### Scenario: Instructions do not mention an offering variable

- **WHEN** the server's declared instructions are searched
- **THEN** `FORMIO_DEFAULT_PROJECT_URL` does not appear

#### Scenario: The unset-project error asks for the project alone

- **WHEN** a project-scoped tool or `project get` fails because no project URL resolves
- **THEN** the message contains a runnable `project set --project-url` command including the `--cwd` that was searched
- **AND** it describes what a Project URL is with an example per deployment kind
- **AND** it does not ask for the base URL
- **AND** it does not name a suggested project

#### Scenario: The base-URL error carries the sub-domain explanation

- **WHEN** a project URL resolves, the base URL is unresolved, and something reads it
- **THEN** the message contains a runnable `project set --base-url` command
- **AND** it echoes the resolved project URL
- **AND** it explains that a path-less project URL on a customer domain names its deployment nowhere
- **AND** it does not state that the project URL is unset

#### Scenario: project_set asks for a base URL only when one is needed

- **WHEN** the `project_set` tool description is read
- **THEN** it says to pass `baseUrl` when the server reports that it cannot be determined
- **AND** it does not instruct passing it by deployment kind
- **AND** it states that the base URL is otherwise derived from the project URL
### Requirement: The instructions state the three valid URL shapes

A `FORMIO_PROJECT_URL` / `FORMIO_BASE_URL` pair has exactly three valid shapes, and the server's own guidance SHALL state all three, because a stand-alone agent has no skill to consult:

1. **Form.io hosted cloud (SaaS).** The base URL is ALWAYS `https://api.form.io`. The project URL is the project's name as a sub-domain of `form.io` — a project named `examples` is `https://examples.form.io`.
2. **A customer-hosted deployment with sub-domain project routing.** The base URL is that deployment's own host, frequently itself a sub-domain of the customer's domain (`https://forms.mysite.com`). The project URL is the project's name as a **sibling sub-domain of the same parent domain** (`https://myproject.mysite.com`) — not a path under the base URL, and not under the base URL's host at all.
3. **A customer-hosted deployment with sub-directory project routing.** The base URL is that same kind of host and the project URL is the project's name as a sub-directory of it (`https://forms.mysite.com/myproject`). The deployment MAY itself be mounted at a sub-path rather than at the domain root, in which case the base URL carries that path and the project URL extends it by one segment — a deployment at `https://forms.mysite.com/one` serves a project named `two` at `https://forms.mysite.com/one/two`.

Shapes 1 and 2 are the same pattern; SaaS is the deployment whose parent domain is `form.io` and whose base host is `api`. In shapes 1 and 2 the base URL carries no path; in shape 3 it MAY, and guidance SHALL NOT assert that a base URL never carries a path — the project URL is the base URL plus exactly one segment, so reducing a sub-path deployment to its bare origin points the portal login and `/current` at a host root that serves neither.

The instructions SHALL additionally rule out the three mistakes these shapes invite: a `*.form.io` host is never a base URL; `https://api.form.io/<project>` is not a hosted project URL; and a project host that differs from the base URL host is normal in shape 2, so a project URL SHALL NOT be built by appending a name to the base URL, and a base URL SHALL NOT be derived from a project URL that carries no path — it must be asked for. No guidance, tool description, or example the server ships SHALL offer a path-style hosted project URL, because a wrong base URL keys the JWT cache per project and builds the portal-login URL against the project sub-domain rather than the deployment.

#### Scenario: Instructions name the SaaS invariant

- **WHEN** any MCP client reads the server's declared instructions
- **THEN** they state that the base URL is always `https://api.form.io` on the hosted cloud, with the project as a sub-domain
- **AND** they state both customer-hosted shapes — a sibling sub-domain of the customer's domain, and a sub-directory of the deployment host
- **AND** they state that a `*.form.io` host is never a base URL

#### Scenario: Instructions allow a deployment mounted at a sub-path

- **WHEN** any MCP client reads the server's declared instructions
- **THEN** they do not assert that a base URL never carries a path
- **AND** they state that a sub-directory project URL is its deployment's URL plus exactly one segment

#### Scenario: Instructions forbid deriving either URL from the other

- **WHEN** any MCP client reads the server's declared instructions
- **THEN** they state that a project URL is never built by appending a project name to the base URL
- **AND** they state that a base URL is never derived from a project URL that carries no path, because the sub-domain shape puts the deployment on a different host

#### Scenario: No shipped example uses a path-style hosted project URL

- **WHEN** the server's instructions are searched for `https://api.form.io/<something>`
- **THEN** no such example appears

### Requirement: The bin configures a project without an MCP session

The `formio-mcp` bin SHALL accept a `project` command with two subcommands, `set` and `get`, so a project can be configured and inspected before any MCP client has connected. Invoked with no arguments the bin SHALL start the stdio server exactly as before — the command surface is additive and MUST NOT change the transport path.

`project set` SHALL accept `--project-url`, `--base-url`, `--cwd` (optional, defaulting to `process.cwd()`, resolved to an absolute path), and `--scope` (optional, one of `user` or `repo`, defaulting to `user`).

- **`--scope user`** writes the working-directory → project mapping in `~/.formio/projects.json`, exactly as before.
- **`--scope repo`** writes or updates the nearest committed `formio.json`, found by the same upward walk resolution uses. When the walk finds none, the file SHALL be created in the `--cwd` directory. The command SHALL print the path it wrote, because "the nearest file" is not obvious from the invocation.

`--project-url` SHALL be required when the targeted scope has no project recorded yet, and optional when it does: either URL flag alone is then a valid partial update, and the omitted flag retains its current value. A call supplying neither flag SHALL fail, naming both. URL validation SHALL be the same normalization in both scopes.

The `project_set` MCP tool SHALL take the same `scope` argument with the same default, so the tool and the command are one behavior described twice.

`project get` SHALL accept `--cwd` (same default) and print the resolved project URL, the resolved base URL, and **which source won** for each. The sources it SHALL be able to name are the committed `formio.json` (**named by its resolved path**, since which file won is the whole question when several exist), the working-directory mapping, this shell's environment, a derived base URL, and unresolved. There is no `default` source to name — see the derivation rules in `project-map-routing` — because a value reported as a default reads as a guess. Because the command runs in the caller's shell rather than the MCP server's process, it cannot see the server's own `env` block, and it SHALL say so whenever a file or mapping supplied the answer.

`project get` SHALL additionally report any source it SHADOWED — a personal mapping overridden by a committed file, or an environment value overridden by either. A stale lower layer is otherwise invisible, and "my `project_set` did nothing" is the failure that produces. Reporting the shadowing is what makes the new precedence order legible.

Shadowing SHALL be reported for BOTH URLs, from separately tracked candidate lists. The two halves resolve independently — a committed project can be paired with a mapped deployment — so one shared list would attribute a shadowed deployment to whichever layer supplied the project, and a mapped base URL silently overriding a committed one would go unreported entirely.

Any note the command collected on the way to a failure SHALL travel with that failure rather than being dropped. An ignored unusable `FORMIO_BASE_URL` is the CAUSE of the unresolved-base-URL outcome, so omitting it there withholds the explanation of the error being reported.

When neither supplies a project URL it SHALL print the same actionable message the tools raise, naming `project set` and `formio.json`. When a committed file is present but unusable it SHALL print that distinct error instead and exit `2`.

When the base URL is unresolved, `project get` SHALL report it as unresolved, naming `project set --base-url` and the `baseUrl` key of a committed file as the fixes, SHALL NOT print `https://api.form.io` as though it were configured, SHALL still print the resolved project URL, and SHALL exit `2` rather than `1`. Because an API-key deployment never reads the base URL, the output SHALL say the missing value blocks JWT authentication rather than that the project is unusable.

Both subcommands SHALL exit non-zero on failure and SHALL write nothing to stdout that a caller could mistake for MCP protocol traffic.

#### Scenario: No arguments still starts the stdio server

- **WHEN** the bin is invoked with no arguments
- **THEN** it connects a stdio transport and serves the full tool list, unchanged from before this change

#### Scenario: project set defaults to the personal scope

- **WHEN** `formio-mcp project set --project-url https://x.form.io --cwd /abs/path` runs with no `--scope`
- **THEN** the mapping is written to `~/.formio/projects.json` for `/abs/path`
- **AND** no `formio.json` is created

#### Scenario: project set --scope repo writes the committed file

- **WHEN** `formio-mcp project set --project-url https://x.form.io --scope repo --cwd /repo/apps/web` runs and no `formio.json` exists at or above that directory within the repository
- **THEN** `/repo/apps/web/formio.json` is created containing that project URL
- **AND** the command prints the path it wrote

#### Scenario: project set --scope repo updates the nearest existing file

- **WHEN** `/repo/formio.json` exists and `formio-mcp project set --base-url https://forms.mysite.com --scope repo --cwd /repo/apps/web` runs
- **THEN** `/repo/formio.json` is updated rather than a new file created in `apps/web`
- **AND** the command prints `/repo/formio.json`

#### Scenario: The project_set tool matches the command's scope

- **WHEN** the `project_set` tool is called with `scope` of `repo`
- **THEN** it writes the committed file on the same terms as the command
- **AND** omitting `scope` writes the personal mapping

#### Scenario: project get names the committed file by path

- **WHEN** a committed `formio.json` supplies the project URL
- **THEN** `project get` names that file's resolved path as the source

#### Scenario: project get reports a shadowed mapping

- **WHEN** a committed file and a personal mapping both cover the `cwd` and name different projects
- **THEN** `project get` prints the resolved project from the committed file
- **AND** it reports that a personal mapping was shadowed, naming the project it holds

#### Scenario: project get reports a shadowed environment value

- **WHEN** a committed file supplies the project URL and `FORMIO_PROJECT_URL` names a different one
- **THEN** `project get` reports the environment value as shadowed rather than omitting it

#### Scenario: project get reports a shadowed base URL

- **WHEN** a committed file supplies both URLs, the working-directory mapping holds a different base URL, and `FORMIO_BASE_URL` holds a third
- **THEN** `project get` prints the committed base URL
- **AND** it reports both the mapped and the environment base URL as shadowed

#### Scenario: An ignored variable is reported alongside the failure it caused

- **WHEN** `FORMIO_PROJECT_URL` resolves a path-less customer project, `FORMIO_BASE_URL` holds an unusable value, and `project get` runs
- **THEN** it exits `2` reporting that the base URL could not be determined
- **AND** the same output carries the note that `FORMIO_BASE_URL` was ignored

#### Scenario: project get with nothing configured is actionable

- **WHEN** nothing supplies a project URL
- **THEN** `project get` exits non-zero
- **AND** its message names both `project set` and `formio.json`

#### Scenario: project get on a broken committed file exits 2

- **WHEN** a `formio.json` is found but cannot be parsed
- **THEN** `project get` exits `2` and names that file's path
- **AND** it does not report the directory as unconfigured

#### Scenario: A configured mapping resolves on the first tool call

- **WHEN** `project set` runs before any client has connected, and a client then starts the server and calls a Form.io tool with that cwd
- **THEN** the tool resolves its project without any prior `project_set` tool call
