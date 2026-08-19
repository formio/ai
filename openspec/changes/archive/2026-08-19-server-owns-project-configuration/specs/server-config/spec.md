## MODIFIED Requirements

### Requirement: A stand-alone server asks for both URLs before it needs them

The server SHALL be usable with no skills installed, so every piece of guidance an agent needs to configure a project SHALL come from the server itself. It SHALL declare MCP server `instructions` stating that Form.io tools need an active project, that the agent SHALL ask the user for the Project URL and — unless the deployment is the default `https://api.form.io` — the Base URL, and that the pair SHALL then be persisted with `project_set`. The instructions SHALL NOT name any client, skill, or plugin.

`baseUrl` is not cosmetic: it builds the portal-login URL and keys the JWT cache. Omitting it silently defaults to `https://api.form.io`, which points a self-hosted or on-premise user's login at the wrong deployment. Both the resolution error raised when no project is configured and the `project_set` tool description SHALL therefore name the base URL alongside the project URL, and SHALL state that consequence rather than merely listing the parameter as optional.

The server's configuration **errors** SHALL be self-sufficient on the same terms as its instructions, because the skills library no longer restates this guidance and an agent may reach an error without having read the instructions at all. Each SHALL name the exact remedy command, and SHALL carry enough guidance for a user to answer it:

1. **No project URL resolves.** The error SHALL state that the project URL is not set, SHALL name `project set --project-url <project_url> --cwd <cwd>` in its runnable command form alongside the `project_set` tool, and SHALL state the three valid URL shapes so the user can recognize which one they have.
2. **A project URL resolves but the base URL cannot be determined.** The error SHALL state that the base URL cannot be determined **for that project URL**, SHALL echo the project URL, SHALL name `project set --base-url <base_url> --cwd <cwd>`, and SHALL state why the value cannot be derived — the deployment is a sibling host of the same parent domain and nothing in the project URL names it. It SHALL NOT report the project as unset.

These two SHALL be reported one at a time and in that order: an unset project URL SHALL NOT also demand a base URL, because the base URL that will be needed depends on the project URL the user has not yet given. Fixing the first SHALL be what surfaces the second.

#### Scenario: Instructions reach a client with no skills installed

- **WHEN** any MCP client completes the initialize handshake with the server
- **THEN** the server's declared instructions describe asking the user for the Project URL and the Base URL and persisting them with `project_set`
- **AND** they name no client, skill, or plugin

#### Scenario: The resolution error names the base URL

- **WHEN** a project-scoped tool is called with no resolvable project
- **THEN** the error names `project_set`, the project URL, and the base URL
- **AND** it states that an omitted base URL defaults to `https://api.form.io`, which is wrong for a self-hosted deployment

#### Scenario: The unset-project error is runnable without any skill

- **WHEN** a project-scoped tool or `project get` fails because no project URL resolves
- **THEN** the message contains a runnable `project set --project-url` command including the `--cwd` that was searched
- **AND** it states the three valid URL shapes
- **AND** it does not ask for the base URL in the same message

#### Scenario: The base-URL error names its own remedy and the project it applies to

- **WHEN** a project URL resolves, the base URL is unresolved, and something reads it
- **THEN** the message contains a runnable `project set --base-url` command
- **AND** it echoes the resolved project URL
- **AND** it states that the value cannot be derived because the deployment is a sibling host of the same parent domain
- **AND** it does not state that the project URL is unset

#### Scenario: Fixing the project URL surfaces the base URL next

- **WHEN** an unmapped directory is given a path-less non-`form.io` project URL via the command the first error named
- **THEN** the next call reports the base-URL error rather than repeating the project-URL error

#### Scenario: project_set states the consequence of omitting the base URL

- **WHEN** the `project_set` tool description is read
- **THEN** it states that the base URL builds the login URL and keys the cached token
- **AND** it states that omitting it falls back to `https://api.form.io`

### Requirement: The bin configures a project without an MCP session

The `formio-mcp` bin SHALL accept a `project` command with two subcommands, `set` and `get`, so a project can be configured and inspected before any MCP client has connected. Invoked with no arguments the bin SHALL start the stdio server exactly as before — the command surface is additive and MUST NOT change the transport path.

`project set` SHALL accept `--project-url`, `--base-url`, and `--cwd` (optional, defaulting to `process.cwd()`, resolved to an absolute path). `--project-url` SHALL be required when the working directory has no mapping, and optional when it already has one: with a mapping present, either URL flag alone is a valid partial update, and the flag that is omitted SHALL retain its currently mapped value. A call supplying neither flag SHALL fail, naming both. This is what makes the base-URL remedy the server's own errors name — `project set --base-url <url>` on an already-mapped directory — a command the user can actually run.

`--base-url` SHALL keep its existing fallback when omitted on a directory with no mapping: the base URL already mapped for that directory, and only then `FORMIO_BASE_URL` from the environment — the same precedence the `project_set` tool applies. It SHALL write the working-directory → project mapping through the same `writeProjectEntry` path the `project_set` tool uses, so the file format, the merge behaviour, and the `0600` mode stay owned by one module. URL validation SHALL be the same normalization the `project_set` tool applies: `http`/`https` only, trailing slashes stripped, an actionable error naming the offending argument otherwise.

The `project_set` MCP tool SHALL follow the same optionality, so the tool and the command are one behavior described twice rather than two behaviors.

`project get` SHALL accept `--cwd` (same default) and print the resolved project URL, the resolved base URL, and **which source won** — this shell's environment or the working-directory mapping. Because the command runs in the caller's shell rather than the MCP server's process, it cannot see the server's own `env` block; when the mapping is the winning source it SHALL say so explicitly rather than present its output as what the server resolves. When neither supplies a project URL it SHALL print the same actionable message the tools raise, naming `project set`.

`project get` is the read surface the skills library consumes: a skill needing the configured URLs — to generate a framework configuration file, to show the user which project a write will land on, or to decide whether to interview — SHALL obtain them by running this command rather than by carrying its own resolution logic, its own validation rules, or its own URL interview. Its output and its exit codes are therefore a contract, and its failure messages SHALL be the same self-sufficient messages specified above, so a skill can relay one verbatim without adding guidance of its own.

The base URL's reported source SHALL distinguish every possibility the resolver can return — the environment, the working-directory mapping, a value **derived** by dropping a sub-directory-routed project URL's final segment, the `https://api.form.io` **default** that applies only to a `form.io`-hosted project, and **unresolved**. A derived value SHALL be reported as derived rather than as mapped or defaulted, so a reader can tell a deployment the user named from one the resolver worked out.

When the base URL is unresolved, `project get` SHALL report it as unresolved with the base-URL message above, SHALL NOT print `https://api.form.io` as though it were configured, and SHALL still print the resolved project URL, because that half is configured. It SHALL exit `2` rather than `1`: an exit of `1` means nothing is mapped, whose remedy is supplying a project URL, and that is the wrong remedy for a project that is mapped and missing only its deployment. Because an API-key deployment never reads the base URL, the output SHALL say that the missing value blocks JWT authentication rather than claiming the project is unusable.

Both subcommands SHALL exit non-zero on failure and SHALL write nothing to stdout that a caller could mistake for MCP protocol traffic.

#### Scenario: No arguments still starts the stdio server

- **WHEN** the bin is invoked with no arguments
- **THEN** it connects a stdio transport and serves the full tool list, unchanged from before this change

#### Scenario: project set writes the mapping the server reads

- **WHEN** `formio-mcp project set --project-url https://x.form.io --base-url https://api.form.io --cwd /abs/path` runs
- **THEN** `readProjectEntry('/abs/path')` returns an entry whose `env.FORMIO_PROJECT_URL` is `https://x.form.io` and whose `env.FORMIO_BASE_URL` is `https://api.form.io`
- **AND** the file is written with mode `0600`
- **AND** mappings for other working directories are preserved

#### Scenario: project set updates only the base URL of a mapped directory

- **WHEN** a mapping for `/abs/path` already carries `FORMIO_PROJECT_URL` of `https://myproject.mysite.com`
- **AND** `formio-mcp project set --base-url https://forms.mysite.com --cwd /abs/path` runs with no `--project-url`
- **THEN** the command succeeds
- **AND** the entry's `env.FORMIO_BASE_URL` becomes `https://forms.mysite.com`
- **AND** its `env.FORMIO_PROJECT_URL` is still `https://myproject.mysite.com`

#### Scenario: project set still requires a project URL for an unmapped directory

- **WHEN** no mapping exists for `/abs/path`
- **AND** `formio-mcp project set --base-url https://forms.mysite.com --cwd /abs/path` runs
- **THEN** the command exits non-zero
- **AND** the error names `--project-url` as required for a directory with no mapping

#### Scenario: project set with neither URL fails

- **WHEN** `formio-mcp project set --cwd /abs/path` runs with neither URL flag
- **THEN** the command exits non-zero
- **AND** the error names both `--project-url` and `--base-url`

#### Scenario: The project_set tool matches the command's optionality

- **WHEN** the `project_set` tool is called with only a `baseUrl` and a `cwd` that is already mapped
- **THEN** it succeeds and updates only the base URL
- **AND** calling it with neither URL fails with an error naming both

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

#### Scenario: project get reports a derived base URL as derived

- **WHEN** the mapping for the cwd carries `FORMIO_PROJECT_URL` of `https://forms.mysite.com/myproject` and no `FORMIO_BASE_URL`, and the environment supplies none
- **THEN** `project get` prints a base URL of `https://forms.mysite.com`
- **AND** its base-URL source line says the value was derived from the project URL
- **AND** it does not describe that base URL as the default or as mapped

#### Scenario: project get derives a sub-path deployment without flattening it

- **WHEN** the mapping for the cwd carries `FORMIO_PROJECT_URL` of `https://forms.mysite.com/one/two` and no `FORMIO_BASE_URL`, and the environment supplies none
- **THEN** `project get` prints a base URL of `https://forms.mysite.com/one`
- **AND** it does not print `https://forms.mysite.com`

#### Scenario: project get with nothing configured is actionable

- **WHEN** no mapping exists for the cwd and no `FORMIO_PROJECT_URL` is in the environment
- **THEN** `project get` exits non-zero
- **AND** its message names `project set` as the fix
- **AND** the message is the same self-sufficient unset-project message the tools raise, so a skill can relay it verbatim

#### Scenario: project get refuses to print a guessed base URL

- **WHEN** the mapping for the cwd carries `FORMIO_PROJECT_URL` of `https://myproject.mysite.com` and no `FORMIO_BASE_URL`, and the environment supplies none
- **THEN** `project get` exits `2` — the ran-and-failed code, not the `1` that means nothing is mapped, because supplying a project URL is not the fix
- **AND** its message names `project set` and its `--base-url` argument
- **AND** it prints the resolved project URL, because that half is configured
- **AND** it does not print `https://api.form.io` as the resolved base URL
- **AND** it says the missing value blocks JWT authentication rather than that the project is unusable

#### Scenario: A configured mapping resolves on the first tool call

- **WHEN** `project set` runs before any client has connected, and a client then starts the server and calls a Form.io tool with that cwd
- **THEN** the tool resolves its project from the mapping without any prior `project_set` tool call
