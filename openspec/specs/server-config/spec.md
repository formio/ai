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

The server SHALL be usable with no skills installed, so every piece of guidance an agent needs to configure a project SHALL come from the server itself. It SHALL declare MCP server `instructions` describing the **Project URL as the single configuration**: how to find what a directory resolves to, how to record a project, and that the Base URL is derived from the project URL wherever it can be and asked for only when it cannot. The instructions SHALL NOT instruct an agent to ask the USER for both URLs in one round: a value that is usually derived cannot be asked for before the answer it is derived from exists. They MAY describe a single call carrying both, because a caller answering a report about a project already holds that project URL and only the user's Base URL is new. They SHALL NOT name a client, skill, or plugin, and SHALL NOT name `FORMIO_DEFAULT_PROJECT_URL`.

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

`project set` SHALL accept `--project-url`, `--base-url`, and `--cwd` (optional, defaulting to `process.cwd()`, resolved to an absolute path). It writes ONE record: the working-directory → project mapping in `~/.formio/projects.json`. The committed `formio.json` is hand-authored — the server reads it and never writes it: the file belongs to the user's repository, the reader tolerates a `formio.json` this server did not define, and a writer that lands on such a file either corrupts it or refuses with nothing runnable to offer. An unknown flag SHALL be refused rather than ignored: a caller passing a flag this command no longer takes — `--scope repo`, from a release that had a committed-file writer — must not have its write land in a record it did not choose while being told it succeeded.

Every write SHALL leave the record it writes holding a project and its deployment together — see the pairing requirement in `project-map-routing`. `--project-url` SHALL be optional where the mapping already holds a project, in which case `--base-url` alone amends that record's pair. Where the project is held by a record this command cannot write, the call SHALL fail rather than record a deployment apart from its project: for a committed `formio.json` it SHALL name that file's resolved path and the `baseUrl` key to add beside `projectUrl`; for the environment it SHALL name the mapping write carrying both URLs. A call supplying neither flag SHALL fail, naming both.

The report that asks for a deployment SHALL name that remedy itself, per record: the mapping's own `--base-url` update where the mapping holds the project, the edit — exact file path and key — where a committed file holds it, and a mapping write carrying both URLs where only the environment does. A remedy that names one write for every record names one that fails for two of the three, and a failing remedy is worse than none. The `project_set` tool SHALL name the same remedies in tool vocabulary, with the committed record's remedy stated as the same file edit — there is no call that performs it, so the structured `remedy` is absent there and the message carries the instruction.

`project get` SHALL accept `--cwd` (same default) and print the resolved project URL, the resolved base URL, and **which source won** for each. The sources it SHALL be able to name are the committed `formio.json` (**named by its resolved path**, since which file won is the whole question when several exist), the working-directory mapping, this shell's environment, a derived base URL, and unresolved. There is no `default` source to name — see the derivation rules in `project-map-routing` — because a value reported as a default reads as a guess. Because the command runs in the caller's shell rather than the MCP server's process, it cannot see the server's own `env` block, and it SHALL say so whenever a file or mapping supplied the answer.

`project get` SHALL additionally report any source it SHADOWED — a personal mapping overridden by a committed file, or an environment value overridden by either. A stale lower layer is otherwise invisible, and "my `project_set` did nothing" is the failure that produces. Reporting the shadowing is what makes the new precedence order legible.

Shadowing SHALL be reported for the deployment a losing record holds as well as for its project, since a record loses as a whole and a reader asking "why is my recorded base URL not in effect?" needs the answer. A deployment recorded in a directory whose entry names NO project SHALL be named in the half-configured report: nothing says which project it serves, so it cannot be read, and the write the report names replaces it.

Any note the command collected on the way to a failure SHALL travel with that failure rather than being dropped. An ignored unusable `FORMIO_BASE_URL` is the CAUSE of the unresolved-base-URL outcome, so omitting it there withholds the explanation of the error being reported.

When neither supplies a project URL it SHALL print the same actionable message the tools raise, naming `project set` and `formio.json`. When a committed file is present but unusable it SHALL print that distinct error instead and exit `2`.

When the base URL is unresolved, `project get` SHALL report it as unresolved, naming the remedy that records the pair in the record holding the project — a command for the mapping and the environment, the file edit for a committed `formio.json` — SHALL NOT print `https://api.form.io` as though it were configured, SHALL still print the resolved project URL, and SHALL exit `3`. That half-configured answer gets its own code: a `1` asks for the project, which this directory already has, and a `2` is "the command could not answer", which every caller responds to by relaying and stopping — so reporting it as either dead-ends the one deployment shape this surface exists to serve. Because an API-key deployment never reads the base URL, the output SHALL say the missing value blocks JWT authentication rather than that the project is unusable.

The four exit codes SHALL be: `0` resolved, `1` nothing configured for that directory, `2` the command could not answer (a usage error, a malformed URL, an unreadable `~/.formio/projects.json`, an unusable committed file), and `3` a project resolved whose base URL could not be determined.

`project set` SHALL use the same vocabulary, because callers branch on the code rather than on the message: a refusal that NAMES the value or the write it needs — a missing project URL, a missing base URL for the one shape that derives none, a deployment offered for a project another record holds, the API root offered as a project URL, a pair collapsed onto one server — SHALL exit `1`, the code that means act on this message. Both wrong-URL refusals are the user typing the wrong URL back mid-interview, and the remedy is to re-ask; reporting either as `2` told every caller to relay and stop, abandoning the round the refusal exists to redirect. `2` SHALL remain "could not answer": a usage error, an unknown flag, a value that is not a URL, a record that cannot be read. Reporting a named missing value as `2` tells every caller to relay and stop in the middle of the round that was about to supply it.

`project set` SHALL also exit `3`, and it SHALL mean for a write what it means for a read: the project resolved and its deployment did not. It is reached where the record was WRITTEN and a committed `formio.json` still governs the directory and supplies no deployment — so nothing this command can write will resolve one, and the remedy is the edit the report names. The record SHALL still be written, because it remains the fallback if that file goes away, and the printed block SHALL still name the pair that resolves. A `0` there told every caller the directory was ready and sent it to an authenticated call that fails for a reason the write already had in hand.

Both subcommands SHALL exit non-zero on failure and SHALL write nothing to stdout that a caller could mistake for MCP protocol traffic.

#### Scenario: The base-URL repair records the pair where the project lives

- **WHEN** a project resolves only from `FORMIO_PROJECT_URL` and its base URL cannot be derived
- **THEN** `project get` names a write carrying BOTH URLs into this directory's mapping
- **AND** running exactly that command succeeds and leaves the directory resolving `0`
- **AND** a `--base-url` call alone fails instead, naming that same write

#### Scenario: Every printed remedy is a command that resolves the directory

- **WHEN** `project get` ANSWERS with a status of `1` or `3`
- **THEN** the command it prints, with the values it asks the user for, succeeds
- **AND** the `project get` that follows exits `0` reporting exactly those values

#### Scenario: A could-not-answer failure names the repair before the command

- **WHEN** `project get` exits `2` because a record exists and cannot be read
- **THEN** it says that record must be repaired or deleted FIRST
- **AND** any command it prints is stated as the step that follows, since nothing can write a file that cannot be read

#### Scenario: No arguments still starts the stdio server

- **WHEN** the bin is invoked with no arguments
- **THEN** it connects a stdio transport and serves the full tool list, unchanged from before this change

#### Scenario: project set writes the personal mapping and nothing else

- **WHEN** `formio-mcp project set --project-url https://x.form.io --cwd /abs/path` runs
- **THEN** the mapping is written to `~/.formio/projects.json` for `/abs/path`
- **AND** no `formio.json` is created

#### Scenario: A removed flag is refused rather than ignored

- **WHEN** `formio-mcp project set --project-url https://x.form.io --scope repo --cwd /abs/path` runs
- **THEN** the command exits `2` naming `--scope` as an unknown flag
- **AND** nothing is written anywhere

#### Scenario: A deployment for a committed project is an edit, not a call

- **WHEN** a committed `formio.json` holds the project and `project set --base-url` runs, or `project get` reports `3` for it
- **THEN** the message names that file's resolved path and the `"baseUrl"` key to add beside `"projectUrl"`
- **AND** performing exactly that edit leaves the directory resolving `0`

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
- **THEN** it exits `3` reporting that the base URL could not be determined
- **AND** the same output carries the note that `FORMIO_BASE_URL` was ignored

#### Scenario: project get with nothing configured is actionable

- **WHEN** nothing supplies a project URL
- **THEN** `project get` exits non-zero
- **AND** its message names both `project set` and `formio.json`

#### Scenario: project get on a broken committed file exits 2

- **WHEN** a `formio.json` is found but cannot be parsed
- **THEN** `project get` exits `2` and names that file's path
- **AND** it does not report the directory as unconfigured

### Requirement: The read half of the project surface is a tool as well as a command

The server SHALL expose a `project_get` tool reporting which project a working directory resolves to, which deployment hosts it, and which layer supplied each. Without it every skill's preflight shelled out to `npx -y @formio/mcp@<pinned> project get`, so an agent already holding an open connection spawned an npm download to ask that same server a question it could answer over the transport — and a preflight run by one version could report a resolution the connected version would not honor.

`project_get` SHALL take the same optional `cwd` argument every other tool takes, defaulting to the server's own process cwd, and SHALL resolve through the same resolver, in the same precedence, as every other tool.

Its three answers SHALL travel as a machine-readable `status`, not as a substring of the message: `ok` carries both URLs, `not-configured` carries neither and sends the caller to `project_set`, and `base-url-unresolved` carries the project and asks for the deployment alone. These correspond to the CLI's exit codes `0`, `1` and `3`. A failure to answer at all SHALL be a tool error rather than a fourth status, so it can never be mistaken for `not-configured`, whose remedy would overwrite the record that is merely unreadable.

The tool SHALL be registered read-only, and SHALL name no shell command in any remedy it prints: its reader holds an open connection, so every fix is a tool call.

Any note collected on the way to an answer SHALL reach the text the tool returns, not only its structured payload. An "Ignoring `FORMIO_BASE_URL`" note is the CAUSE of a `base-url-unresolved` answer, and a client that surfaces only text would otherwise show a generic "could not be determined" about a value that had just been discarded unread. When the caller passed no `cwd`, the answer SHALL say that it is about the server's own working directory, since a confidently reported project for a directory nobody asked about is the failure that produces. It SHALL say so on a resolved answer as much as on an unresolved one, with ONE exception: a project supplied by the environment resolves identically for every directory, so the fallback directory is not part of that answer and a caution about it hangs a warning on something correct everywhere. That exception does not extend to a half-configured answer, whose remedy records a deployment under one directory — there the directory IS part of the answer, whatever supplied the project.

Both the tool and the `project get` command SHALL derive their report from one shared implementation, differing only in reader-specific vocabulary: how each names a remedy (tool calls for an agent, runnable commands for a shell), the shell-environment caveat, which is true of the command and false of the server answering about itself, and how each NAMES the environment a value came from. The two readers stand in different processes, so a report that credits the tool's answer to "this shell's environment" sends an agent looking for a variable only the server's launch configuration holds. The `project get` / `project set` subcommands SHALL remain, because `formio-mcp-setup` runs before any tool exists to call.

Any note collected on the way to an outcome SHALL travel with that outcome in EVERY shape the command can return, the could-not-answer failure included. An ignored unusable `FORMIO_PROJECT_URL` is the cause of the required-project failure, so a failure shape that discards notes reports "no project mapped yet" about a directory whose project was discarded unread.

The server's declared `instructions` SHALL name `project_get` and what to do with each status, since they are the only configuration guidance an agent receives when the server is used stand-alone with no skills installed.

#### Scenario: A connected agent asks the server rather than npm

- **WHEN** an agent holding an open connection needs to know what a directory resolves to
- **THEN** `project_get` answers it over the transport
- **AND** no skill instructs it to run `npx -y @formio/mcp@<pinned> project get` for that

#### Scenario: Nothing configured is a status, not a tool error

- **WHEN** `project_get` is called for a directory nothing configures
- **THEN** it returns `status: "not-configured"` without `isError`
- **AND** its message names `project_set` and no shell command

#### Scenario: An unreadable map is a tool error, not a status

- **WHEN** `~/.formio/projects.json` cannot be parsed and `project_get` is called
- **THEN** the call fails as a tool error
- **AND** it does not report the directory as unconfigured

#### Scenario: The tool credits the server's environment, not the caller's shell

- **WHEN** `project_get` resolves a project from `FORMIO_PROJECT_URL`
- **THEN** the source it names is the MCP server's own environment
- **AND** `project get` in a shell still names that shell's environment for the same resolution

#### Scenario: A fallback directory says so on a resolved answer

- **WHEN** `project_get` is called with no `cwd` and the server's own directory resolves a project from a committed file or its mapping
- **THEN** the answer says no `cwd` argument was passed and names that directory

#### Scenario: A project the environment answers for everywhere says nothing

- **WHEN** `project_get` is called with no `cwd` and the project comes from `FORMIO_PROJECT_URL`
- **THEN** a resolved answer carries no caution about the fallback directory
- **AND** a `base-url-unresolved` answer carries it, because its remedy records a deployment under that directory

#### Scenario: A configured mapping resolves on the first tool call

- **WHEN** `project set` runs before any client has connected, and a client then starts the server and calls a Form.io tool with that cwd
- **THEN** the tool resolves its project without any prior `project_set` tool call
