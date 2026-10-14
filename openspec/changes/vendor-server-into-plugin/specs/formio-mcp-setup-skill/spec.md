## MODIFIED Requirements

### Requirement: Setup is gated, then tells the user how to reload

The skill SHALL print the full contents of every file it intends to write and obtain explicit user approval before writing, and SHALL write exactly the set it previewed. After writing it SHALL state the reload step for the client it identified, and every client's reload step where it fell back to writing all four, because every client reads MCP configuration at session start rather than at tool-call time: Claude Code restarts or runs `/mcp`, Cursor toggles the server in Customize or restarts, VS Code reloads the window, Codex restarts and may prompt to trust the directory.

The skill SHALL then stop and ask the user to re-issue their original request, rather than continuing as though the tools were available.

The skill SHALL also cover: whether to commit or ignore the written files, and what to do where `npx` cannot reach the public registry (a global install of `@formio/mcp@<MAJOR.MINOR.PATCH>` at the same pinned version, or the `.mcpb` desktop bundle).

The skill SHALL also cover a Claude Code install of the `formio-ai` plugin whose Form.io tools are missing because the plugin's server did not start. Claude Code installs that server's dependencies directly from `https://registry.npmjs.org/` without reading `.npmrc`, so on a network that reaches npm only through a private mirror the install fails. The skill SHALL route that case to the same manual connection it writes for any client — an `npx` launch, which reads `.npmrc` — and SHALL NOT tell the user to work around the install by editing the plugin's files.

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

#### Scenario: The plugin's server cannot install

- **WHEN** the skill's instructions are inspected for a Claude Code session where the `formio-ai` plugin is installed but its Form.io tools are missing
- **THEN** they name a network that reaches npm only through a private mirror as the likely cause
- **AND** they route to the manual `npx` connection
- **AND** they do not instruct editing files inside the installed plugin
