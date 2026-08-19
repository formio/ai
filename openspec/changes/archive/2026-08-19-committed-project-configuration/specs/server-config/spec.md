## MODIFIED Requirements

### Requirement: The bin configures a project without an MCP session

The `formio-mcp` bin SHALL accept a `project` command with two subcommands, `set` and `get`, so a project can be configured and inspected before any MCP client has connected. Invoked with no arguments the bin SHALL start the stdio server exactly as before — the command surface is additive and MUST NOT change the transport path.

`project set` SHALL accept `--project-url`, `--base-url`, `--cwd` (optional, defaulting to `process.cwd()`, resolved to an absolute path), and `--scope` (optional, one of `user` or `repo`, defaulting to `user`).

- **`--scope user`** writes the working-directory → project mapping in `~/.formio/projects.json`, exactly as before.
- **`--scope repo`** writes or updates the nearest committed `formio.json`, found by the same upward walk resolution uses. When the walk finds none, the file SHALL be created in the `--cwd` directory. The command SHALL print the path it wrote, because "the nearest file" is not obvious from the invocation.

`--project-url` SHALL be required when the targeted scope has no project recorded yet, and optional when it does: either URL flag alone is then a valid partial update, and the omitted flag retains its current value. A call supplying neither flag SHALL fail, naming both. URL validation SHALL be the same normalization in both scopes.

The `project_set` MCP tool SHALL take the same `scope` argument with the same default, so the tool and the command are one behavior described twice.

`project get` SHALL accept `--cwd` (same default) and print the resolved project URL, the resolved base URL, and **which source won** for each. The sources it SHALL be able to name are the committed `formio.json` (**named by its resolved path**, since which file won is the whole question when several exist), the working-directory mapping, this shell's environment, a derived base URL, the `https://api.form.io` default, and unresolved. Because the command runs in the caller's shell rather than the MCP server's process, it cannot see the server's own `env` block, and it SHALL say so whenever a file or mapping supplied the answer.

`project get` SHALL additionally report any source it SHADOWED — a personal mapping overridden by a committed file, or an environment value overridden by either. A stale lower layer is otherwise invisible, and "my `project_set` did nothing" is the failure that produces. Reporting the shadowing is what makes the new precedence order legible.

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
