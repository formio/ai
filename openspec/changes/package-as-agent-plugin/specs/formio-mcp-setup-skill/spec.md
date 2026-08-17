## ADDED Requirements

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
