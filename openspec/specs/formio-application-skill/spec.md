## ADDED Requirements

### Requirement: New skill `formio-application` exists as the library's build-an-app entry point

The skills library SHALL contain a new skill at `skills/formio-application/SKILL.md` with frontmatter `name: formio-application`. The skill directory SHALL contain the following sibling reference documents, none of which have YAML frontmatter:

- `SETUP.md` is NOT used for this skill (setup of URLs is `DEPLOYMENT.md`'s concern).
- `INTENT.md` — the build-vs-modify interview script.
- `DEPLOYMENT.md` — the Base URL + Project URL interview.
- `MCP_CONFIG.md` — the `.mcp.json` write for Step 3 (added in the `add-mcp-config-step-to-application-skill` change).
- `IMPORT.md` — the `project_import` invocation and error handling.
- `FRAMEWORK.md` — the framework registry + routing logic.

A symlink `.claude/skills/formio-application` SHALL exist and resolve to `skills/formio-application/`.

#### Scenario: formio-application directory layout

- **WHEN** the repository is inspected
- **THEN** `skills/formio-application/SKILL.md`, `INTENT.md`, `DEPLOYMENT.md`, `MCP_CONFIG.md`, `IMPORT.md`, and `FRAMEWORK.md` all exist
- **AND** none of `INTENT.md`, `DEPLOYMENT.md`, `MCP_CONFIG.md`, `IMPORT.md`, or `FRAMEWORK.md` begins with a YAML frontmatter block (first line is not `---`)
- **AND** `.claude/skills/formio-application` resolves to `skills/formio-application/`

### Requirement: formio-application description claims plain-language triggers and names the framework skills

The `formio-application` `SKILL.md` frontmatter `description` SHALL claim plain-language build-an-app and extend-an-app triggers WITHOUT requiring the user to know any UI framework or Form.io terminology. Example triggers the description MUST claim include:

- Build-new: "build me an app", "create a CRM", "I need a tool to track X", "spin up a system for Y", bare domain archetypes ("task manager", "help desk").
- Extend-existing: "also track X", "add a way to see Y", "each Z should have a list of W", "let users also submit V".

The description MUST state that this skill is the library's default build-an-app entry point; that it picks a UI framework automatically when only one is installed and asks the user when multiple are installed; that the user does NOT need to mention "Angular", "React", "framework", "resource", or "NgModule".

The description MUST include `Not for:` clauses pointing at:

- `formio-angular` for framework-explicit Angular requests.
- `formio-angular-resources` for framework-explicit Angular extension requests.
- `formio-resource-planner` for data-model-only planning requests without building an app.
- `formio-api` for endpoint lookups.

The description MUST also state that the skill writes a `.mcp.json` file in the workspace root as part of the flow (so users know a file will be created and why) and that the flow pauses for a Claude Code restart after the `.mcp.json` write.

#### Scenario: formio-application claims generic build-new triggers

- **WHEN** the user says "build me a tool to track maintenance requests" (no framework or Form.io terminology)
- **THEN** the `formio-application` skill activates
- **AND** neither `formio-angular` nor `formio-angular-resources` activates

#### Scenario: formio-application claims generic extend triggers

- **WHEN** the user says "also let customers leave reviews on products" in a workspace that already has a framework app wired
- **THEN** the `formio-application` skill activates
- **AND** `formio-angular-resources` does not activate directly

#### Scenario: Framework-explicit phrasing does NOT route through formio-application

- **WHEN** the user says "build it in Angular" or "add an Angular module for X"
- **THEN** `formio-angular` (or `formio-angular-resources`) activates directly
- **AND** `formio-application` does not activate

#### Scenario: Description mentions the .mcp.json write

- **WHEN** the `formio-application` `SKILL.md` frontmatter is inspected
- **THEN** its `description` contains the literal substring `.mcp.json`

#### Scenario: Description mentions the restart pause

- **WHEN** the `formio-application` `SKILL.md` frontmatter is inspected
- **THEN** its `description` mentions restarting Claude Code (or an equivalent "pause and restart" phrasing) so the user knows the flow is multi-invocation

### Requirement: formio-application runs a six-step orchestration

The `formio-application` `SKILL.md` body SHALL describe six ordered steps with approval gates between destructive operations:

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

#### Scenario: User bails at the Import approval gate

- **WHEN** Step 5's approval gate shows the URLs + template summary + merge-overwrite warning and the user declines
- **THEN** `project_import` is not called
- **AND** the skill continues with Step 6 (framework routing) so the user can still scaffold against an existing project

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
- How to add a new framework entry — the concrete instruction for whoever is adding `formio-react` later.

#### Scenario: Single-framework registry routes silently

- **WHEN** `FRAMEWORK.md`'s table contains exactly one row (Angular) and intent = build-new
- **THEN** Step 6 routes to `formio-angular` without asking the user

#### Scenario: Multi-framework registry asks the user

- **WHEN** a future change adds a second row to the table (e.g., React) and intent = build-new
- **THEN** Step 6 presents the available frameworks via `AskUserQuestion` before routing

#### Scenario: Existing-workspace detection routes directly

- **WHEN** intent = modify-existing and the workspace contains `angular.json`
- **THEN** Step 6 routes to `formio-angular-resources` without asking the user

### Requirement: IMPORT.md documents the import flow and error branches

`skills/formio-application/IMPORT.md` SHALL document:

- The offer-to-import gate (after planner + MCP config + authenticate, before `project_import` on build-new branch).
- The pre-auth messaging (warn about browser window).
- The import-confirmation preview (URLs + plain-language template summary + merge-overwrite warning).
- The `project_import` invocation with the template payload and the target Project URL.
- The three error branches — auth failure (401/403), project not found (404), import validation failure (400) — each with a user-facing action.
- The headless-environment fallback (print the portal-login URL for manual open).

#### Scenario: IMPORT.md covers the required topics

- **WHEN** `IMPORT.md` is read
- **THEN** it names the `project_import` MCP tool
- **AND** it describes the browser-based portal-login trigger and the headless fallback
- **AND** it contains the import-confirmation preview wording including the merge-overwrite warning
- **AND** it documents the three error-handling branches by name

### Requirement: DEPLOYMENT.md uses plain-language URL descriptions and batches the interview

`skills/formio-application/DEPLOYMENT.md` SHALL instruct the skill to ask for the Base URL and Project URL in a single batched `AskUserQuestion`, not two sequential prompts. The document MUST contain plain-language descriptions of each URL that do not assume Form.io deployment knowledge, plus at least one example value per URL for both hosted-cloud and self-hosted contexts.

`DEPLOYMENT.md` MUST name `FORMIO_PROJECT_URL` for the project URL and `FORMIO_BASE_URL` for the base URL (matching the terminology rule in `CLAUDE.md`).

#### Scenario: DEPLOYMENT.md batches URL interview

- **WHEN** `DEPLOYMENT.md` is read
- **THEN** it contains the literal substring `AskUserQuestion`
- **AND** it contains the terms "batched", "single", or equivalent language that distinguishes one batched call from two sequential ones
- **AND** it contains plain-language descriptions for both URLs
- **AND** it names `FORMIO_PROJECT_URL` and `FORMIO_BASE_URL`

### Requirement: INTENT.md captures build-vs-modify with a single AskUserQuestion

`skills/formio-application/INTENT.md` SHALL instruct the skill to present Step 1 as a single `AskUserQuestion` with exactly two explicit options — "Build a new app" and "Modify / extend an existing app" — plus the default "Other" that `AskUserQuestion` always offers.

`INTENT.md` MUST define the downstream consequence of each answer:

- Build-new → run the planner, then Steps 2–6.
- Modify-existing → skip Steps 2–5, go directly to framework detection (Step 6 with detection path).

#### Scenario: INTENT.md defines the two-option question and routing

- **WHEN** `INTENT.md` is read
- **THEN** it names `AskUserQuestion`
- **AND** it contains both "Build" and "Modify" or "Extend" as explicit options
- **AND** it documents the skip-steps-2-through-5 behavior for the modify branch

### Requirement: formio-application invokes formio-resource-planner internally on the build-new branch

On the build-new branch, the `formio-application` skill SHALL invoke `formio-resource-planner` before Step 2 (Deployment). The user is NOT required to invoke the planner themselves.

`SKILL.md` MUST describe the planner handoff explicitly and MUST NOT leave the planner as an implicit prerequisite.

#### Scenario: Build-new drives planner without user action

- **WHEN** the user says "build me a CRM" and chooses build-new in Step 1
- **THEN** the `formio-application` skill runs `formio-resource-planner` before asking for URLs
- **AND** the user is not asked "have you run the planner yet?"

### Requirement: New sibling doc MCP_CONFIG.md

The `formio-application` skill directory SHALL contain a new sibling reference document `skills/formio-application/MCP_CONFIG.md` that has NO YAML frontmatter and documents the Step 3 `.mcp.json` write. The document MUST include:

- The exact `.mcp.json` shape written by the skill, including the `formio-mcp` server entry shape, the `env` block with keys `FORMIO_PROJECT_URL` and `FORMIO_BASE_URL`, and example values.
- An explicit note that the orchestrator's internal state uses `FORMIO_BASE_URL` for the platform deployment URL but the env-var key written into `.mcp.json` is `FORMIO_BASE_URL` (two names for the same concept; this doc is the authoritative mapping).
- The collision-handling algorithm for when `./.mcp.json` already exists (preserve `command`/`args` of any existing `formio-mcp` entry; rewrite only `env.FORMIO_PROJECT_URL` and `env.FORMIO_BASE_URL`; preserve other env keys; preserve unrelated `mcpServers` entries).
- The default-command selection rule: a single npm-based default — `"command": "npx"` with `"args": ["-y", "@formio/mcp"]`. The document MUST explicitly flag that this default is a placeholder until `@formio/mcp` publishes to npm. The document MUST NOT present `pnpm` as a supported default command. The document MUST document an npm-only escape-hatch for contributors pointing `.mcp.json` at a local clone (either `npx -y tsx <path>/packages/mcp-server/src/stdio.ts` or `node <path>/packages/mcp-server/dist/stdio.js` after a local build).
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

### Requirement: New `authenticate` MCP tool

The MCP server SHALL register a new tool named `authenticate` at `packages/mcp-server/src/tools/authenticate.ts`, wired into `registerAllTools`. The tool:

- Takes NO parameters — its input schema is an empty object.
- Invokes the existing `ensureAuthenticated(config)` flow. No new auth code paths are introduced; the login mechanism is unchanged.
- Is **idempotent**. When the MCP server already has a valid cached JWT for the configured project URL, the tool returns success without opening a browser.
- Returns a JSON-serialized text content block whose payload is `{ authenticated: boolean, cached: boolean, projectUrl: string, userEmail?: string }`. The JWT MUST NOT appear in the return payload.
- Reads the project URL from the server's `FormioConfig`. The agent does NOT pass a URL.
- `cached: true` when the JWT was already present before the call; `cached: false` when the call triggered a fresh login.
- `userEmail` is best-effort — populated from a `GET {projectUrl}/current` call when the returned submission has an email field. Any error fetching the current user is swallowed; the field is simply omitted.
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

- **WHEN** a successful `authenticate` call finishes and `GET {projectUrl}/current` returns a submission with an email field
- **THEN** the payload contains `userEmail: <the email>`

#### Scenario: Current-user fetch failure is swallowed

- **WHEN** `authenticate` succeeds but the subsequent `GET /current` call fails (network error, 404, etc.)
- **THEN** the tool still returns `authenticated: true` with no `userEmail` field
- **AND** the tool call itself does NOT error
