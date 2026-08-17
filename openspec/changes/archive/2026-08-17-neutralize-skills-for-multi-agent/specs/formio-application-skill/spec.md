## ADDED Requirements

### Requirement: formio-application runs a five-step orchestration

The `formio-application` `SKILL.md` body SHALL describe five ordered steps with approval gates between destructive operations:

1. **Intent** — ask whether this is a new app or an existing app being extended. Documented in `INTENT.md`.
2. **Plan** — invoke `formio-resource-planner`, which emits the paired `template.md` (Resource Map) and `template.json` to the working directory.
3. **Deployment** — resolve the target project. When the working directory already maps to a project, confirm it in one line and proceed. Otherwise capture the Base URL and Project URL in one batched question round with plain-language descriptions, then call `project_set` to map the working directory to the Project URL. Documented in `DEPLOYMENT.md`. Skipped on the modify-existing branch, which reads both URLs from the workspace instead.
4. **Import** — invoke the `project_import` MCP tool with the planner-emitted `template.json` and the captured Project URL. Preceded by an approval gate. Documented in `IMPORT.md`. Skipped on the modify-existing branch. Step 4.5 is the conditional `formio-auth` handoff.
5. **Framework routing** — consult the registry in `FRAMEWORK.md`. Step 5a runs the `frontend-design` pre-check. If exactly one framework is installed, route silently. If multiple, ask the user.

The body MUST reference the four sibling docs (`INTENT.md`, `DEPLOYMENT.md`, `IMPORT.md`, `FRAMEWORK.md`) by relative link.

There SHALL be no MCP-configuration step and no restart boundary on either branch. Steps 3 and 4 run in the same invocation: `project_set` writes the working-directory → Project URL mapping that the server reads at tool-call time, so no configuration file and no session reload stands between the two. When the probe in the skill's preflight finds no Form.io tools available, the skill SHALL route to `formio-mcp-setup` instead of writing configuration itself, and SHALL NOT claim the user's original request is finished.

#### Scenario: Build-new branch runs end to end in one invocation

- **WHEN** the user says "build me a CRM" (no existing workspace) and Form.io tools are available
- **THEN** Steps 1 through 5 run in a single invocation
- **AND** the planner runs as Step 2
- **AND** Step 3 calls `project_set` with the working directory and the captured Project URL
- **AND** Step 4 reaches its import approval gate without any intervening restart or reload

#### Scenario: An existing mapping is confirmed rather than re-interviewed

- **WHEN** Step 3 runs in a working directory that `formio-mcp-setup` (or an earlier session) already mapped to a project
- **THEN** the skill confirms the resolved project and base URL in one line
- **AND** it does not ask for either URL
- **AND** Step 4 proceeds against the resolved project

#### Scenario: Modify-existing branch skips Steps 3 and 4

- **WHEN** the user says "also track attendees in each event" in an existing Angular workspace
- **THEN** Step 1 determines intent = modify-existing
- **AND** Steps 3 and 4 are skipped
- **AND** Step 5 routes to the framework's extend sub-skill (`formio-angular-resources` today)

#### Scenario: No MCP-configuration step exists

- **WHEN** `SKILL.md` is read
- **THEN** it describes exactly five steps, none of which writes MCP configuration
- **AND** it contains no instruction to halt, restart, or reload for MCP configuration to take effect
- **AND** it does not link to `MCP_CONFIG.md`

#### Scenario: Missing tools route to setup

- **WHEN** the skill's preflight probe finds no Form.io tools available under any name
- **THEN** the skill routes to `formio-mcp-setup`
- **AND** the skill does not write any MCP configuration file
- **AND** the skill does not attempt Steps 3 or 4 without tools

#### Scenario: User bails at the Import approval gate

- **WHEN** Step 4's approval gate shows the URLs + template summary + merge-overwrite warning and the user declines
- **THEN** `project_import` is not called
- **AND** the skill continues with Step 5 (framework routing) so the user can still scaffold against an existing project

### Requirement: INTENT.md captures build-vs-modify in one question round

`skills/formio-application/INTENT.md` SHALL instruct the skill to present Step 1 as a single question round with exactly two explicit options — "Build a new app" and "Modify / extend an existing app" — using the client's structured question mechanism, which it MAY name as a parenthetical example only. Where the client's mechanism offers a free-text answer alongside fixed options, `INTENT.md` SHALL describe that affordance in portable terms rather than by naming it.

`INTENT.md` MUST define the downstream consequence of each answer:

- Build-new → run the planner (Step 2), then Steps 3–5.
- Modify-existing → skip Steps 3 and 4, go directly to framework detection (Step 5 with detection path).

#### Scenario: INTENT.md defines the two-option question and routing

- **WHEN** `INTENT.md` is read
- **THEN** it instructs asking Step 1 as one question round
- **AND** it contains both "Build" and "Modify" or "Extend" as explicit options
- **AND** it documents the skip-Steps-3-and-4 behavior for the modify branch

#### Scenario: INTENT.md names no client tool as the mechanism

- **WHEN** `INTENT.md` is read
- **THEN** any client tool name appears only as a parenthetical example attached to a portable instruction

## MODIFIED Requirements

### Requirement: DEPLOYMENT.md uses plain-language URL descriptions and batches the interview

`skills/formio-application/DEPLOYMENT.md` SHALL instruct the skill to ask for the Base URL and Project URL in a single batched question round using the client's structured question mechanism, not two sequential prompts. It MAY name a client's tool as a parenthetical example of that mechanism, never as the mechanism itself. The document MUST contain plain-language descriptions of each URL that do not assume Form.io deployment knowledge, plus at least one example value per URL for both hosted-cloud and self-hosted contexts.

`DEPLOYMENT.md` MUST name `FORMIO_PROJECT_URL` for the project URL and `FORMIO_BASE_URL` for the base URL (matching the terminology rule in `CLAUDE.md`).

`DEPLOYMENT.md` SHALL instruct the skill to check for an existing working-directory → project mapping **before** interviewing, and to confirm the resolved URLs in one line instead of asking when one is found. The project configuration is captured once, wherever the user first lands — `formio-mcp-setup`'s configuration step or this step — and never re-asked. `DEPLOYMENT.md` remains the single source of the plain-language URL descriptions and example values; `formio-mcp-setup` references it by file path rather than duplicating it.

#### Scenario: DEPLOYMENT.md checks for a mapping before interviewing

- **WHEN** `DEPLOYMENT.md` is read
- **THEN** it instructs resolving an existing mapping first
- **AND** it instructs confirming rather than interviewing when one resolves
- **AND** it states that the interview is the fallback, not the default

#### Scenario: DEPLOYMENT.md batches URL interview

- **WHEN** `DEPLOYMENT.md` is read
- **THEN** it instructs asking for both URLs in one round
- **AND** it contains the terms "batched", "single", or equivalent language that distinguishes one round from two sequential prompts
- **AND** it contains plain-language descriptions for both URLs
- **AND** it names `FORMIO_PROJECT_URL` and `FORMIO_BASE_URL`

#### Scenario: DEPLOYMENT.md names no client tool as the mechanism

- **WHEN** `DEPLOYMENT.md` is read
- **THEN** any client tool name appears only as a parenthetical example attached to a portable instruction

### Requirement: FRAMEWORK.md defines a registry with single- and multi-framework routing

`FRAMEWORK.md` SHALL contain a table of installed UI-framework skills in the following shape:

| Framework | Entry skill      | Extend sub-skill           | Detection signal                                                         |
| --------- | ---------------- | -------------------------- | ------------------------------------------------------------------------ |
| Angular   | `formio-angular` | `formio-angular-resources` | `angular.json` in workspace root OR `@angular/core` in `package.json`     |

`FRAMEWORK.md` body MUST document:

- That routing is driven by this table.
- That when the table has exactly one active row, Step 5 routes silently (no user question).
- That when the table has multiple active rows, Step 5 asks the user to pick, in one question round, using the client's structured question mechanism — which it MAY name as a parenthetical example only.
- That modify-existing workspaces are detected via the "Detection signal" column, and if exactly one signal matches the routing is direct.
- The Step 5a `frontend-design` pre-check: detect the skill by name, accepting more than one registered form rather than a single client's prefix; when it is missing, offer the install in one question round, naming where the skill ships and deferring the mechanism to the running client's own skill-install route; on decline, apply the Bootstrap 5 brief from `formio-angular/BOOTSTRAP.md` Step 7d inline, disclose that on each UI approval gate, and hand `frontendDesignStatus` downstream. The document MUST NOT instruct a client-specific plugin-install command, plugin browser, or reload command.
- How to add a new framework entry — the concrete instruction for whoever is adding `formio-react` later.

#### Scenario: Single-framework registry routes silently

- **WHEN** `FRAMEWORK.md`'s table contains exactly one row (Angular) and intent = build-new
- **THEN** Step 5 routes to `formio-angular` without asking the user

#### Scenario: Multi-framework registry asks the user

- **WHEN** a future change adds a second row to the table (e.g., React) and intent = build-new
- **THEN** Step 5 presents the available frameworks in one question round before routing
- **AND** the instruction names no client tool as the mechanism

#### Scenario: Existing-workspace detection routes directly

- **WHEN** intent = modify-existing and the workspace contains `angular.json`
- **THEN** Step 5 routes to `formio-angular-resources` without asking the user

#### Scenario: Pre-check degrades when frontend-design is declined

- **WHEN** Step 5a finds `frontend-design` unavailable and the user proceeds without it
- **THEN** `FRAMEWORK.md` instructs applying the Bootstrap 5 brief inline
- **AND** it instructs disclosing that on each UI approval gate
- **AND** it names where `frontend-design` ships without prescribing a client-specific install command
- **AND** it contains no `claude plugin install`, `claude-plugins-official`, or `/reload-plugins`

## REMOVED Requirements

### Requirement: formio-application runs a six-step orchestration

**Reason**: The MCP Config step it enumerated is gone, which renumbers every step after Deployment and removes the restart boundary the requirement's scenarios asserted. Its enumeration also predated the current `SKILL.md`, which folds authentication into Import.

**Migration**: Replaced by "formio-application runs a five-step orchestration" in this same delta — Intent, Plan, Deployment, Import, Framework routing, with no MCP-configuration step and no restart boundary on either branch.

### Requirement: INTENT.md captures build-vs-modify with a single AskUserQuestion

**Reason**: The requirement's name and scenarios mandated a Claude Code tool by name (`- **THEN** it names `AskUserQuestion``), which is unexecutable guidance in Cursor, Codex, Copilot CLI, and VS Code. Its step-skipping consequences also referenced the old numbering.

**Migration**: Replaced by "INTENT.md captures build-vs-modify in one question round" in this same delta. Two explicit options, one round, and the batching rule are unchanged; the mechanism is now the client's, with a client tool permitted only as a parenthetical example.

### Requirement: New sibling doc MCP_CONFIG.md

**Reason**: The document is deleted. Its whole subject — writing `FORMIO_PROJECT_URL` and `FORMIO_BASE_URL` into a `.mcp.json` `env` block — is now actively harmful: a `FORMIO_PROJECT_URL` in the server environment takes precedence over the working-directory mapping (`packages/mcp-server/src/project-resolver.ts`, `packages/mcp-server/src/tools/project_set.ts`), so writing it pins the server and defeats the `project_set` call the skill makes one step earlier. Its plugin-mode detection also keyed on a Claude-only tool namespace and a Claude-only hook.

**Migration**: Project routing is `project_set({ cwd, projectUrl })` in Step 3, read by the server at tool-call time. Getting a server connected at all belongs to `formio-mcp-setup`, which owns the per-client configuration table and reload steps. Users who deliberately pin a server to one project by setting `FORMIO_PROJECT_URL` in their own launch configuration keep that behaviour — it is documented on `project_set` itself.

### Requirement: Step 3 writes .mcp.json with captured URLs

**Reason**: The step is deleted. See the reason above — the env block it wrote overrides the working-directory mapping, and the halt-and-restart gate it mandated is a Claude Code session-lifecycle detail that other clients do not share.

**Migration**: Step 3 (Deployment) calls `project_set` and Step 4 (Import) runs in the same invocation. No file is written, no approval gate for a configuration write exists, and there is no restart boundary on either branch.
