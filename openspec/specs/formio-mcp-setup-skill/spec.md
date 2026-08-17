# formio-mcp-setup-skill Specification

## Purpose
Defines the `formio-mcp-setup` skill and the preflight every other skill carries: how a skill detects that the Form.io tools are missing, how setup connects the server without knowing which client it runs in, how it gates and reports the reload, and how it offers project configuration as a skippable step.
## Requirements
### Requirement: Every skill checks for the MCP server before its first tool call

Every `SKILL.md` in the library SHALL carry a preflight section in its **body** — not its frontmatter description, which is bound by the 1,024-character budget — instructing the agent to verify that the Form.io MCP tools are available before making its first Form.io tool call.

The preflight SHALL: name representative tools to look for (`form_list`, `form_create`, `project_import`, `project_set`); direct the agent to the `formio-mcp-setup` skill when they are absent; carry a fallback message for the case where that skill is not installed; and forbid working around missing tools with raw HTTP calls against a Form.io deployment.

The raw-HTTP prohibition is the load-bearing part. `formio-api` documents the entire REST surface, so an agent with no tools and no prohibition will hand-roll requests against a live deployment — a worse outcome than stopping.

#### Scenario: Every skill carries the preflight

- **WHEN** every `SKILL.md` under `plugin/skills/` is inspected
- **THEN** each body contains a preflight section naming `project_set` and the `formio-mcp-setup` skill

#### Scenario: Preflight forbids the HTTP workaround

- **WHEN** any skill's preflight section is inspected
- **THEN** it instructs the agent not to fall back to direct HTTP requests against a Form.io deployment when the MCP tools are missing

#### Scenario: Descriptions are untouched

- **WHEN** the frontmatter descriptions are measured after the preflight sections are added
- **THEN** every description is unchanged and still within the 1,024-character budget

#### Scenario: The setup skill exempts itself

- **WHEN** `plugin/skills/formio-mcp-setup/SKILL.md` is inspected
- **THEN** it does not direct the agent to load `formio-mcp-setup`, because it is that skill

### Requirement: A setup skill connects the server without knowing which client it is in

The library SHALL provide `plugin/skills/formio-mcp-setup/`, a spec-conformant skill whose description triggers on a missing Form.io MCP server, on requests to install or connect the Form.io MCP server, and on handoff from another skill's preflight.

The skill SHALL write the MCP configuration for every supported client in one pass rather than detecting the host, because three of the four files are inert in any client that does not read them:

| File | Shape |
| --- | --- |
| `.mcp.json` | JSON, top-level `mcpServers` |
| `.cursor/mcp.json` | JSON, top-level `mcpServers` |
| `.vscode/mcp.json` | JSON, top-level **`servers`** |
| `.codex/config.toml` | TOML, `[mcp_servers.formio-mcp]` |

Every entry SHALL launch the server as `npx -y @formio/mcp` and SHALL contain no URL, key, or other configuration value: Phase 0's server starts with no configuration and raises an actionable error naming `project_set` when a tool needs a project. The skill SHALL note that `FORMIO_PROJECT_URL` may be added to pin a project, and SHALL NOT write it by default.

All four paths are project-scoped. The skill SHALL NOT write to the user's home directory.

#### Scenario: Setup skill exists and conforms

- **WHEN** the Agent Skills conformance suite runs
- **THEN** `formio-mcp-setup` passes it — directory name matching `name`, description within budget, frontmatter keys within the specification set

#### Scenario: All four client configurations are documented

- **WHEN** `formio-mcp-setup/SKILL.md` is inspected
- **THEN** it specifies each of `.mcp.json`, `.cursor/mcp.json`, `.vscode/mcp.json`, and `.codex/config.toml`
- **AND** the VS Code entry uses the `servers` key while the Claude Code and Cursor entries use `mcpServers`
- **AND** the Codex entry is TOML declaring `[mcp_servers.formio-mcp]`

#### Scenario: No configuration values are emitted

- **WHEN** the configuration snippets in `formio-mcp-setup/SKILL.md` are inspected
- **THEN** none contains a Form.io project URL, base URL, or API key
- **AND** the skill explains that the agent will ask which project to use and call `project_set`

#### Scenario: Nothing is written outside the workspace

- **WHEN** the skill's write instructions are inspected
- **THEN** every path is workspace-relative, and none targets `~` or an absolute home-directory path

### Requirement: Setup is gated, then tells the user how to reload

The skill SHALL print the full contents of every file it intends to write and obtain explicit user approval before writing. After writing it SHALL state the reload step for each client, because every client reads MCP configuration at session start rather than at tool-call time: Claude Code restarts or runs `/mcp`, Cursor toggles the server in Customize or restarts, VS Code reloads the window, Codex restarts and may prompt to trust the directory.

The skill SHALL then stop and ask the user to re-issue their original request, rather than continuing as though the tools were available.

The skill SHALL also cover: whether to commit or ignore the written files, and what to do where `npx` cannot reach the public registry (a global install of `@formio/mcp`, or the `.mcpb` desktop bundle).

#### Scenario: Approval precedes any write

- **WHEN** the skill's instructions are inspected
- **THEN** the file contents are previewed and approval obtained before any file is written

#### Scenario: Reload guidance covers every client

- **WHEN** the post-write instructions are inspected
- **THEN** they name the reload step for Claude Code, Cursor, VS Code, and Codex

#### Scenario: The flow ends by handing control back

- **WHEN** setup completes
- **THEN** the skill asks the user to reload and re-issue the original request
- **AND** it does not claim the original task is done

#### Scenario: Offline and locked-down environments have a path

- **WHEN** the skill's instructions are inspected
- **THEN** they describe an alternative for an environment where `npx` cannot fetch from the public registry

### Requirement: Setup offers to configure the project before the reload

After writing the client configuration and before telling the user to reload, `formio-mcp-setup` SHALL offer to capture the Form.io project configuration, so the server resolves a project on its very first tool call instead of raising a "no project configured" error the user then has to resolve.

The step SHALL ask for the Project URL and the Base URL in one question round, reusing the plain-language descriptions and example values that `formio-application/DEPLOYMENT.md` already carries, and referencing that document by file path rather than duplicating its wording. It SHALL apply the answers by running the server's own command — `npx -y @formio/mcp project set --project-url <url> --base-url <url> --cwd <absolute path>` — and SHALL NOT edit `~/.formio/projects.json` directly and SHALL NOT write `FORMIO_PROJECT_URL` into any client configuration file's `env` block, because an environment value takes precedence over the mapping and would pin the server against every later `project_set`.

The step SHALL confirm the result by running `npx -y @formio/mcp project get --cwd <absolute path>` and reporting the resolved URLs, rather than asserting success.

The `project` invocations the skill documents SHALL carry no version range: `@formio/mcp` is a 0.x line, so a hard-coded floor in shipped prose goes stale at the next release. The command shipped in `@formio/mcp` 0.9.0, and an older binary ignores the arguments, starts its stdio server, reads end-of-input and exits **0 with no output** — so `project get` reports success while finding nothing and `project set` reports success while writing nothing. The skill SHALL therefore treat a zero-exit run that prints nothing as "no project is configured", and SHALL NOT report a mapping it did not read in the output or claim a project was persisted when `project set` printed nothing.

#### Scenario: URLs captured, mapping written, first tool call resolves

- **WHEN** the user supplies both URLs
- **THEN** the skill runs `project set` with them and the absolute working directory
- **AND** it confirms with `project get` and reports the resolved project and base URL
- **AND** the reload instruction that follows notes that no further project setup is needed

#### Scenario: Configuration is applied through the server's command

- **WHEN** the skill applies the captured URLs
- **THEN** it invokes the `formio-mcp` bin's `project set` command
- **AND** it does not edit `~/.formio/projects.json` itself
- **AND** it does not add `FORMIO_PROJECT_URL` or `FORMIO_BASE_URL` to any client configuration file

### Requirement: The project-configuration step is skippable and never blocks setup

The configuration step SHALL be optional. `formio-mcp-setup` fires from every Form.io skill's preflight, including requests that need no project at all — an API-reference question, a schema question — and from users who have not created a project yet. The step SHALL therefore state plainly that it can be skipped, and skipping SHALL NOT block the client configuration, the reload instruction, or the handoff back to the calling skill.

When the step is skipped, the skill SHALL say that the first Form.io tool call will ask for the project, and SHALL name `project_set` as what will handle it. It SHALL NOT imply the setup failed.

An existing mapping SHALL short-circuit the step: when `project get` already resolves a project for the working directory, the skill SHALL report the resolved URLs in one line and SHALL NOT interview.

#### Scenario: User has no project yet

- **WHEN** the user cannot supply a Project URL
- **THEN** the step is skipped without an error
- **AND** the client configuration and the reload instruction are still delivered
- **AND** the skill names `project_set` as what will capture the project on the first tool call

#### Scenario: Request needs no project

- **WHEN** setup was reached from a preflight for a request that needs no project, such as an API-reference lookup
- **THEN** the skill presents the configuration step as optional rather than required

#### Scenario: A mapping already exists

- **WHEN** `project get --cwd <path>` already resolves a project for the working directory
- **THEN** the skill reports the resolved project and base URL in one line
- **AND** it does not ask for URLs

#### Scenario: The project command is unavailable

- **WHEN** `project set` fails because `npx` cannot fetch `@formio/mcp`, or because the registry is unreachable
- **THEN** the skill reports what failed in one line
- **AND** it names `project_set` as what will capture the project on the first tool call
- **AND** it still delivers the reload instruction and the handoff, treating the outcome as a skipped step rather than a failed setup

#### Scenario: Skipping does not read as failure

- **WHEN** the step is skipped
- **THEN** the skill's closing message describes setup as complete
- **AND** it does not tell the user something went wrong

