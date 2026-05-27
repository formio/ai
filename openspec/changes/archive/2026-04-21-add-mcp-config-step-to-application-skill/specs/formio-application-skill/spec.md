## ADDED Requirements

### Requirement: New `authenticate` MCP tool

The MCP server SHALL register a new tool named `authenticate` at `packages/mcp-server/src/tools/authenticate.ts`, wired into `registerAllTools`. The tool:

- Takes NO parameters — its input schema is an empty object.
- Invokes the existing `ensureAuthenticated(config)` flow. No new auth code paths are introduced; the login mechanism is unchanged.
- Is **idempotent**. When the MCP server already has a valid cached JWT for the configured project URL, the tool returns success without opening a browser.
- Returns a JSON-serialized text content block whose payload is `{ authenticated: boolean, cached: boolean, projectUrl: string, userEmail?: string }`. The JWT MUST NOT appear in the return payload.
- Reads the project URL from the server's `FormioConfig`. The agent does NOT pass a URL.
- `cached: true` when the JWT was already present before the call; `cached: false` when the call triggered a fresh login.
- `userEmail` is best-effort — populated from a `GET {baseUrl}/current` call when the returned submission has an email field. Any error fetching the current user is swallowed; the field is simply omitted.
- Is the tool Step 4 of `formio-application` calls explicitly to trigger authentication. It is also available to any other skill that wants to pre-authenticate before a sensitive sequence.

#### Scenario: Tool is registered and callable

- **WHEN** the MCP server starts with a valid `FormioConfig`
- **THEN** the tool `authenticate` appears in the tool registry with an empty input schema

#### Scenario: Cached JWT short-circuits

- **WHEN** `authenticate` is called and `config.jwt` is already set (a valid cached JWT is in memory for the project URL)
- **THEN** the tool returns `{ authenticated: true, cached: true, projectUrl: <configured> }`
- **AND** no browser window is opened
- **AND** the payload does not contain a `jwt` field or any other token field

#### Scenario: No cached JWT triggers login

- **WHEN** `authenticate` is called and no valid JWT is cached
- **THEN** `ensureAuthenticated` runs, which opens the portal-login browser window
- **AND** on successful login, the tool returns `{ authenticated: true, cached: false, projectUrl: <configured> }` (optionally with `userEmail`)

#### Scenario: Current-user email included when available

- **WHEN** a successful `authenticate` call finishes and `GET {baseUrl}/current` returns a submission with an email field
- **THEN** the payload contains `userEmail: <the email>`

#### Scenario: Current-user fetch failure is swallowed

- **WHEN** `authenticate` succeeds but the subsequent `GET /current` call fails (network error, 404, etc.)
- **THEN** the tool still returns `authenticated: true` with no `userEmail` field
- **AND** the tool call itself does NOT error



### Requirement: New sibling doc MCP_CONFIG.md

The `formio-application` skill directory SHALL contain a new sibling reference document `skills/formio-application/MCP_CONFIG.md` that has NO YAML frontmatter and documents the Step 3 `.mcp.json` write. The document MUST include:

- The exact `.mcp.json` shape written by the skill, including the `formio-mcp` server entry shape, the `env` block with keys `FORMIO_PROJECT_URL` and `FORMIO_BASE_URL`, and example values.
- An explicit note that the orchestrator's internal state uses `FORMIO_BASE_URL` for the platform deployment URL but the env-var key written into `.mcp.json` is `FORMIO_BASE_URL` (two names for the same concept; this doc is the authoritative mapping).
- The collision-handling algorithm for when `./.mcp.json` already exists (preserve `command`/`args` of any existing `formio-mcp` entry; rewrite only `env.FORMIO_PROJECT_URL` and `env.FORMIO_BASE_URL`; preserve other env keys; preserve unrelated `mcpServers` entries).
- The default-command selection rule (monorepo path vs. `npx -y @formio/mcp` placeholder for external users).
- The approval-gate wording: preview the final merged `.mcp.json`, wait for user approval, write, then print restart/reconnect instructions.
- The restart/reconnect instructions: the user must restart Claude Code (or use `/mcp` reconnect if supported in their version) for the new env to take effect. The skill MUST NOT attempt Step 4 in the same invocation after writing.
- The skip rule: if `./.mcp.json` already contains a `formio-mcp` entry whose `env.FORMIO_PROJECT_URL` and `env.FORMIO_BASE_URL` match the Step-2 captures exactly, skip the step and tell the user why.

#### Scenario: MCP_CONFIG.md exists and has no frontmatter

- **WHEN** the repository is inspected after the change is applied
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

### Requirement: Step 3 writes .mcp.json with captured URLs

Step 3 of the `formio-application` orchestration SHALL write a `.mcp.json` file in the user's current working directory whose content reflects the URLs captured in Step 2 (Deployment). The write is gated on an explicit approval preview. After the write, the skill MUST halt the current invocation and print a restart/reconnect instruction; Steps 4, 5, 6 do not run in the same invocation as Step 3.

The written `formio-mcp` server entry MUST contain:

- An `env` block with exactly `FORMIO_PROJECT_URL` and `FORMIO_BASE_URL` set to the Step-2 captures, plus any other env keys that were already present in a pre-existing entry (preserved on merge).
- A `command` and `args` pair either preserved from an existing entry or defaulted per the selection rule documented in `MCP_CONFIG.md`.

#### Scenario: Fresh workspace — no existing .mcp.json

- **WHEN** Step 3 runs in a workspace with no `./.mcp.json`
- **THEN** Step 3 previews a new `.mcp.json` with a single `formio-mcp` entry whose `env.FORMIO_PROJECT_URL` and `env.FORMIO_BASE_URL` match the Step-2 captures
- **AND** on approval, the file is written
- **AND** the skill halts with a restart/reconnect instruction
- **AND** Steps 4, 5, 6 do not run in this invocation

#### Scenario: Existing .mcp.json with formio-mcp entry — merge

- **WHEN** Step 3 runs in a workspace whose `./.mcp.json` already contains a `formio-mcp` entry with custom `command` and `args`
- **THEN** Step 3's preview shows the original `command` and `args` preserved and only `env.FORMIO_PROJECT_URL` and `env.FORMIO_BASE_URL` rewritten
- **AND** other env keys (e.g., `FORMIO_API_KEY`) are preserved
- **AND** unrelated `mcpServers` entries are preserved

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

## MODIFIED Requirements

### Requirement: formio-application runs a five-step orchestration

The `formio-application` `SKILL.md` body SHALL describe SIX ordered steps (replacing the prior five) with approval gates between destructive operations:

1. **Intent** — ask whether this is a new app or an existing app being extended. Documented in `INTENT.md`.
2. **Deployment** — batched `AskUserQuestion` capturing Base URL and Project URL, with plain-language descriptions. Documented in `DEPLOYMENT.md`. Skipped on the modify-existing branch.
3. **MCP Config** — write `.mcp.json` in the workspace root with `FORMIO_PROJECT_URL` and `FORMIO_BASE_URL` env vars populated from Step 2. Documented in `MCP_CONFIG.md`. Halts the current invocation after writing so the user can restart Claude Code. Skipped on the modify-existing branch (no MCP call needed there) and when a matching entry already exists.
4. **Authenticate** — call the `authenticate` MCP tool explicitly. Warn the user a browser window may open. Silent when the tool returns `cached: true`. Skipped on the modify-existing branch.
5. **Import** — invoke the `project_import` MCP tool with the planner-emitted `template.json` and the captured Project URL. Preceded by an approval gate. Skipped on the modify-existing branch.
6. **Framework routing** — consult the registry in `FRAMEWORK.md`. If exactly one framework is installed, route silently. If multiple, ask the user.

The body MUST reference the five sibling docs (`INTENT.md`, `DEPLOYMENT.md`, `MCP_CONFIG.md`, `IMPORT.md`, `FRAMEWORK.md`) by relative link. The body MUST describe the build-new branch driving `formio-resource-planner` before Step 2.

#### Scenario: Build-new branch drives the full six-step pipeline (across a restart)

- **WHEN** the user says "build me a CRM" (no existing workspace)
- **THEN** Steps 1 and 2 run
- **AND** the planner runs between Step 1 and Step 2
- **AND** Step 3 writes `./.mcp.json` with the captured URLs and halts the invocation with a restart/reconnect message
- **AND** after the user restarts and re-invokes the skill, Steps 4, 5, 6 run with the approval gates specified in their respective docs

#### Scenario: Modify-existing branch skips Steps 2–5

- **WHEN** the user says "also track attendees in each event" in an existing Angular workspace
- **THEN** Step 1 determines intent = modify-existing
- **AND** Steps 2, 3, 4, 5 are skipped
- **AND** Step 6 routes to the framework's extend sub-skill (`formio-angular-resources` today)

#### Scenario: Existing .mcp.json with matching URLs lets Step 3 skip in-invocation

- **WHEN** Steps 1 and 2 run in a workspace whose `./.mcp.json` already matches the captured URLs
- **THEN** Step 3 surfaces a short "skipping — already configured" message
- **AND** Steps 4, 5, 6 run in the same invocation (no restart required because the MCP server is already pointing at the right project)

### Requirement: formio-application description claims plain-language triggers and names the framework skills

The `formio-application` `SKILL.md` frontmatter `description` SHALL claim plain-language build-an-app and extend-an-app triggers WITHOUT requiring the user to know any UI framework or Form.io terminology. In addition to the existing trigger clauses, the description MUST state that the skill writes a `.mcp.json` file in the workspace root as part of the flow (so users know a file will be created and why) and that the flow pauses for a Claude Code restart after the `.mcp.json` write.

The description MUST continue to include the existing `Not for:` clauses pointing at `formio-angular`, `formio-angular-resources`, `formio-resource-planner`, and `formio-api`.

#### Scenario: Description mentions the .mcp.json write

- **WHEN** the `formio-application` `SKILL.md` frontmatter is inspected
- **THEN** its `description` contains the literal substring `.mcp.json`

#### Scenario: Description mentions the restart pause

- **WHEN** the `formio-application` `SKILL.md` frontmatter is inspected
- **THEN** its `description` mentions restarting Claude Code (or an equivalent "pause and restart" phrasing) so the user knows the flow is multi-invocation
