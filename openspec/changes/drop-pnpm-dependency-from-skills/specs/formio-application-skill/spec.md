## MODIFIED Requirements

### Requirement: New sibling doc MCP_CONFIG.md

The `formio-application` skill directory SHALL contain a sibling reference document `skills/formio-application/MCP_CONFIG.md` that has NO YAML frontmatter and documents the Step 3 `.mcp.json` write. The document MUST include:

- The exact `.mcp.json` shape written by the skill, including the `formio-mcp` server entry shape, the `env` block with keys `FORMIO_PROJECT_URL` and `FORMIO_BASE_URL`, and example values. The example `command` MUST be `npx` and the example `args` MUST include `-y @formio/mcp`.
- An explicit note that the orchestrator's internal state uses `FORMIO_BASE_URL` for the platform deployment URL but the env-var key written into `.mcp.json` is `FORMIO_BASE_URL` (two names for the same concept; this doc is the authoritative mapping).
- The collision-handling algorithm for when `./.mcp.json` already exists (preserve `command`/`args` of any existing `formio-mcp` entry; rewrite only `env.FORMIO_PROJECT_URL` and `env.FORMIO_BASE_URL`; preserve other env keys; preserve unrelated `mcpServers` entries).
- The default-command selection rule: a single npm-based default — `"command": "npx"` with `"args": ["-y", "@formio/mcp"]`. The document MUST explicitly flag that this default is a placeholder until `@formio/mcp` publishes to npm. The document MUST NOT present `pnpm` as a supported default command.
- An escape-hatch section documenting two npm-only alternatives for pointing `.mcp.json` at a locally cloned repo: (a) `"command": "npx"` + `"args": ["-y", "tsx", "<absolute-path>/packages/mcp-server/src/stdio.ts"]`, (b) `"command": "node"` + `"args": ["<absolute-path>/packages/mcp-server/dist/stdio.js"]` after a local build. Both MUST be described as opt-in — the skill does NOT auto-emit them.
- The approval-gate wording: preview the final merged `.mcp.json`, wait for user approval, write, then print restart/reconnect instructions.
- The restart/reconnect instructions: the user must restart Claude Code (or use `/mcp` reconnect if supported in their version) for the new env to take effect. The skill MUST NOT attempt Step 4 in the same invocation after writing.
- The skip rule: if `./.mcp.json` already contains a `formio-mcp` entry whose `env.FORMIO_PROJECT_URL` and `env.FORMIO_BASE_URL` match the Step-2 captures exactly, skip the step and tell the user why.

#### Scenario: MCP_CONFIG.md exists and has no frontmatter

- **WHEN** the repository is inspected
- **THEN** `skills/formio-application/MCP_CONFIG.md` exists
- **AND** its first line is not `---`

#### Scenario: MCP_CONFIG.md names both env-var keys and documents the mapping

- **WHEN** `MCP_CONFIG.md` is read
- **THEN** it contains the literal substrings `FORMIO_PROJECT_URL` and `FORMIO_BASE_URL`
- **AND** it documents that the orchestrator's internal `FORMIO_BASE_URL` maps to the written `FORMIO_BASE_URL`

#### Scenario: MCP_CONFIG.md documents the collision and skip rules

- **WHEN** `MCP_CONFIG.md` is read
- **THEN** it documents preserving existing `command`/`args` on merge
- **AND** it documents preserving unrelated env keys and `mcpServers` entries
- **AND** it documents the skip condition (existing entry already matches captured URLs)

#### Scenario: MCP_CONFIG.md documents the restart gate

- **WHEN** `MCP_CONFIG.md` is read
- **THEN** it instructs the skill to stop after writing and print a restart/reconnect message
- **AND** it mentions both "restart Claude Code" and "`/mcp`" reconnect phrases

#### Scenario: Default command is npm-based

- **WHEN** `MCP_CONFIG.md` is read
- **THEN** it presents `"command": "npx"` with `"args": ["-y", "@formio/mcp"]` as the sole default command the skill emits
- **AND** it flags that the default is a placeholder until the package publishes to npm
- **AND** it does NOT present `"command": "pnpm"` or a pnpm-filter invocation as a default

#### Scenario: Escape-hatch documents npm-only local-clone variants

- **WHEN** `MCP_CONFIG.md` is read
- **THEN** it documents at least one `"command": "npx"` + tsx-based variant pointing at a local clone's source
- **AND** it documents at least one `"command": "node"` + local build output variant
- **AND** both variants are described as opt-in / manual, not auto-emitted by the skill

### Requirement: Step 3 writes .mcp.json with captured URLs

Step 3 of the `formio-application` orchestration SHALL write a `.mcp.json` file in the user's current working directory whose content reflects the URLs captured in Step 2 (Deployment). The write is gated on an explicit approval preview. After the write, the skill MUST halt the current invocation and print a restart/reconnect instruction; Steps 4, 5, 6 do not run in the same invocation as Step 3.

The written `formio-mcp` server entry MUST contain:

- An `env` block with exactly `FORMIO_PROJECT_URL` and `FORMIO_BASE_URL` set to the Step-2 captures, plus any other env keys that were already present in a pre-existing entry (preserved on merge).
- A `command` and `args` pair either preserved from an existing entry or defaulted to the npm-based default (`command: "npx"`, `args: ["-y", "@formio/mcp"]`) per `MCP_CONFIG.md`. The default MUST NOT be pnpm-based.

#### Scenario: Fresh workspace — no existing .mcp.json

- **WHEN** Step 3 runs in a workspace with no `./.mcp.json`
- **THEN** Step 3 previews a new `.mcp.json` whose `formio-mcp` entry uses `"command": "npx"` and `"args": ["-y", "@formio/mcp"]`
- **AND** on approval, the file is written
- **AND** the skill halts with a restart/reconnect instruction
- **AND** Steps 4, 5, 6 do not run in this invocation

#### Scenario: Existing .mcp.json with formio-mcp entry — merge preserves custom command even if pnpm

- **WHEN** Step 3 runs in a workspace whose `./.mcp.json` already contains a `formio-mcp` entry with `"command": "pnpm"` and custom `args`
- **THEN** Step 3's preview shows the existing `command` and `args` preserved verbatim
- **AND** only `env.FORMIO_PROJECT_URL` and `env.FORMIO_BASE_URL` are rewritten
- **AND** the skill does NOT replace the pnpm command with the npm default

#### Scenario: Existing .mcp.json already matches — skip

- **WHEN** Step 3 runs in a workspace whose `./.mcp.json` already has a `formio-mcp` entry with `env.FORMIO_PROJECT_URL` and `env.FORMIO_BASE_URL` matching the Step-2 captures exactly
- **THEN** Step 3 is skipped entirely
- **AND** the skill advances to Step 4 in the same invocation (no restart required)
- **AND** the user is told why the skip happened

#### Scenario: User declines the approval gate

- **WHEN** Step 3's preview is shown and the user declines
- **THEN** `./.mcp.json` is not modified
- **AND** Step 4 does not run
- **AND** the skill exits with no partial state

### Requirement: FRAMEWORK.md defines a registry with single- and multi-framework routing

`FRAMEWORK.md` SHALL contain a table of installed UI-framework skills in the following shape:

| Framework | Entry skill | Extend sub-skill | Detection signal |
|---|---|---|---|
| Angular | `formio-angular` | `formio-angular-resources` | `angular.json` in workspace root OR `@angular/core` in `package.json` |

`FRAMEWORK.md` body MUST document:

- That routing is driven by this table.
- That when the table has exactly one active row, Step 6 routes silently (no user question).
- That when the table has multiple active rows, Step 6 uses `AskUserQuestion` to let the user pick.
- That modify-existing workspaces are detected via the "Detection signal" column, and if exactly one signal matches the routing is direct.
- How to add a new framework entry — the concrete instruction for whoever is adding `formio-react` later. The instruction MUST use `npm test` (or an equivalent npm-compatible command) as the test-run step. It MUST NOT require `pnpm`.

#### Scenario: Single-framework registry routes silently

- **WHEN** `FRAMEWORK.md`'s table contains exactly one row (Angular) and intent = build-new
- **THEN** Step 6 routes to `formio-angular` without asking the user

#### Scenario: Multi-framework registry asks the user

- **WHEN** a future change adds a second row to the table (e.g., React) and intent = build-new
- **THEN** Step 6 presents the available frameworks via `AskUserQuestion` before routing

#### Scenario: Existing-workspace detection routes directly

- **WHEN** intent = modify-existing and the workspace contains `angular.json`
- **THEN** Step 6 routes to `formio-angular-resources` without asking the user

#### Scenario: Framework-addition instructions are npm-only

- **WHEN** `FRAMEWORK.md`'s "How to add a new framework" section is read
- **THEN** the recipe's test-run step uses `npm test` (or equivalent npm-compatible command)
- **AND** the recipe does not instruct the contributor to run `pnpm` commands
