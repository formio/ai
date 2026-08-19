## MODIFIED Requirements

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

`project set` SHALL accept `--project-url` (required), `--base-url` (optional, falling back to the base URL already mapped for that directory and only then to `FORMIO_BASE_URL` in the environment — the same precedence the `project_set` tool applies), and `--cwd` (optional, defaulting to `process.cwd()`, resolved to an absolute path). It SHALL write the working-directory → project mapping through the same `writeProjectEntry` path the `project_set` tool uses, so the file format, the merge behaviour, and the `0600` mode stay owned by one module. URL validation SHALL be the same normalization the `project_set` tool applies: `http`/`https` only, trailing slashes stripped, an actionable error naming the offending argument otherwise.

`project get` SHALL accept `--cwd` (same default) and print the resolved project URL, the resolved base URL, and **which source won** — this shell's environment or the working-directory mapping. Because the command runs in the caller's shell rather than the MCP server's process, it cannot see the server's own `env` block; when the mapping is the winning source it SHALL say so explicitly rather than present its output as what the server resolves. When neither supplies a project URL it SHALL print the same actionable message the tools raise, naming `project set`.

The base URL's reported source SHALL distinguish every possibility the resolver can return — the environment, the working-directory mapping, a value **derived** by dropping a sub-directory-routed project URL's final segment, the `https://api.form.io` **default** that applies only to a `form.io`-hosted project, and **unresolved**. A derived value SHALL be reported as derived rather than as mapped or defaulted, so a reader can tell a deployment the user named from one the resolver worked out.

When the base URL is unresolved — a path-less non-`form.io` project URL with no supplied value — `project get` SHALL report it as unresolved, naming `project set` and its `--base-url` argument as the fix, and SHALL NOT print `https://api.form.io` as though it were configured. It SHALL still print the resolved project URL, because that half is configured. It SHALL exit non-zero, and specifically SHALL exit `2` rather than `1`: an exit of `1` means nothing is mapped, whose documented remedy is the full URL interview, and that is the wrong remedy for a project that is mapped and missing only its deployment. Because an API-key deployment never reads the base URL, the output SHALL say that the missing value blocks JWT authentication rather than claiming the project is unusable.

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

#### Scenario: project get refuses to print a guessed base URL

- **WHEN** the mapping for the cwd carries `FORMIO_PROJECT_URL` of `https://myproject.mysite.com` and no `FORMIO_BASE_URL`, and the environment supplies none
- **THEN** `project get` exits `2` — the ran-and-failed code, not the `1` that means nothing is mapped, because re-running the URL interview from scratch is not the fix
- **AND** its message names `project set` and its `--base-url` argument
- **AND** it prints the resolved project URL, because that half is configured
- **AND** it does not print `https://api.form.io` as the resolved base URL
- **AND** it says the missing value blocks JWT authentication rather than that the project is unusable

#### Scenario: A configured mapping resolves on the first tool call

- **WHEN** `project set` runs before any client has connected, and a client then starts the server and calls a Form.io tool with that cwd
- **THEN** the tool resolves its project from the mapping without any prior `project_set` tool call
