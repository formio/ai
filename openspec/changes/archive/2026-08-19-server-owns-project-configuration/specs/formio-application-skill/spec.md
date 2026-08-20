## MODIFIED Requirements

### Requirement: New skill `formio-application` exists as the library's build-an-app entry point

The skills library SHALL contain a new skill at `skills/formio-application/SKILL.md` with frontmatter `name: formio-application`. The skill directory SHALL contain the following sibling reference documents, none of which have YAML frontmatter:

- `SETUP.md` is NOT used for this skill.
- `INTENT.md` — the build-vs-modify interview script.
- `IMPORT.md` — the `project_import` invocation and error handling.
- `FRAMEWORK.md` — the framework registry + routing logic.

There SHALL be no `DEPLOYMENT.md`: the Project URL and Base URL are read from the MCP server via `project get` in the skill's preflight, and the guidance for choosing them belongs to the server's own `instructions` and error messages. There SHALL be no `MCP_CONFIG.md` either — the step that wrote MCP configuration was removed, and this list continued to require the file it left behind.

A symlink `.claude/skills/formio-application` SHALL exist and resolve to `skills/formio-application/`.

#### Scenario: formio-application directory layout

- **WHEN** the repository is inspected
- **THEN** `skills/formio-application/SKILL.md`, `INTENT.md`, `IMPORT.md`, and `FRAMEWORK.md` all exist
- **AND** neither `DEPLOYMENT.md` nor `MCP_CONFIG.md` exists in that directory
- **AND** none of `INTENT.md`, `IMPORT.md`, or `FRAMEWORK.md` begins with a YAML frontmatter block (first line is not `---`)
- **AND** `.claude/skills/formio-application` resolves to `skills/formio-application/`

#### Scenario: No document in the skill claims to own the URL wording

- **WHEN** every file under `skills/formio-application/` is searched
- **THEN** none enumerates the three valid URL shapes
- **AND** none contains a Base-URL derivation table, URL validation rules, or a `project get` exit-code table

### Requirement: FRAMEWORK.md defines a registry with single- and multi-framework routing

`FRAMEWORK.md` SHALL contain a table of installed UI-framework skills in the following shape:

| Framework | Entry skill      | Extend sub-skill           | Detection signal                                                         |
| --------- | ---------------- | -------------------------- | ------------------------------------------------------------------------ |
| Angular   | `formio-angular` | `formio-angular-resources` | `angular.json` in workspace root OR `@angular/core` in `package.json`     |

`FRAMEWORK.md` body MUST document:

- That routing is driven by this table.
- That when the table has exactly one active row, Step 4 routes silently (no user question).
- That when the table has multiple active rows, Step 4 asks the user to pick, in one question round, using the client's structured question mechanism — which it MAY name as a parenthetical example only.
- That modify-existing workspaces are detected via the "Detection signal" column, and if exactly one signal matches the routing is direct.
- The Step 4a `frontend-design` pre-check: detect the skill by name, accepting more than one registered form rather than a single client's prefix; when it is missing, offer the install in one question round, naming where the skill ships and deferring the mechanism to the running client's own skill-install route; on decline, apply the Bootstrap 5 brief from `formio-angular/BOOTSTRAP.md` Step 7d inline, disclose that on each UI approval gate, and hand `frontendDesignStatus` downstream. The document MUST NOT instruct a client-specific plugin-install command, plugin browser, or reload command.
- How to add a new framework entry — the concrete instruction for whoever is adding `formio-react` later.

#### Scenario: Single-framework registry routes silently

- **WHEN** `FRAMEWORK.md`'s table contains exactly one row (Angular) and intent = build-new
- **THEN** Step 4 routes to `formio-angular` without asking the user

#### Scenario: Multi-framework registry asks the user

- **WHEN** a future change adds a second row to the table (e.g., React) and intent = build-new
- **THEN** Step 4 presents the available frameworks in one question round before routing
- **AND** the instruction names no client tool as the mechanism

#### Scenario: Existing-workspace detection routes directly

- **WHEN** intent = modify-existing and the workspace contains `angular.json`
- **THEN** Step 4 routes to `formio-angular-resources` without asking the user

#### Scenario: Pre-check degrades when frontend-design is declined

- **WHEN** Step 4a finds `frontend-design` unavailable and the user proceeds without it
- **THEN** `FRAMEWORK.md` instructs applying the Bootstrap 5 brief inline
- **AND** it instructs disclosing that on each UI approval gate
- **AND** it names where `frontend-design` ships without prescribing a client-specific install command
- **AND** it contains no `claude plugin install`, `claude-plugins-official`, or `/reload-plugins`

### Requirement: IMPORT.md documents the import flow and error branches

`skills/formio-application/IMPORT.md` SHALL document:

- The offer-to-import gate (after the preflight has resolved the project and the planner has emitted its templates, before `project_import`).
- The pre-auth messaging (warn about browser window).
- The import-confirmation preview (URLs + plain-language template summary + merge-overwrite warning).
- The `project_import` invocation with the template payload and the caller's `cwd`.
- The three error branches — auth failure (401/403), project not found (404), import validation failure (400) — each with a user-facing action.
- The headless-environment fallback (print the portal-login URL for manual open).

It SHALL refer to the import as Step 3 of the four-step flow, and SHALL NOT reference an MCP-configuration step: that step no longer exists, and this requirement continued to describe the gate as following it.

#### Scenario: IMPORT.md covers the required topics

- **WHEN** `IMPORT.md` is read
- **THEN** it names the `project_import` MCP tool
- **AND** it describes the browser-based portal-login trigger and the headless fallback
- **AND** it contains the import-confirmation preview wording including the merge-overwrite warning
- **AND** it documents the three error-handling branches by name

#### Scenario: IMPORT.md references no MCP-configuration step

- **WHEN** `IMPORT.md` is read
- **THEN** its description of the import gate names the preflight and the planner, not an MCP-configuration step
- **AND** it refers to the import as Step 3

### Requirement: INTENT.md captures build-vs-modify in one question round

`skills/formio-application/INTENT.md` SHALL instruct the skill to present Step 1 as a single question round with exactly two explicit options — "Build a new app" and "Modify / extend an existing app" — using the client's structured question mechanism, which it MAY name as a parenthetical example only. Where the client's mechanism offers a free-text answer alongside fixed options, `INTENT.md` SHALL describe that affordance in portable terms rather than by naming it.

`INTENT.md` MUST define the downstream consequence of each answer, against the four-step flow whose project configuration the preflight already resolved:

- Build-new → run the planner in full-project mode (Step 2), import the full template (Step 3), route to the framework's entry skill (Step 4).
- Modify-existing → run the planner in delta mode (Step 2), additively import the delta (Step 3), route to the framework's extend sub-skill (Step 4 with the detection path).

Neither branch SHALL describe a Deployment step or a URL interview: the configuration is resolved in the preflight before Step 1 is asked, on both branches.

#### Scenario: INTENT.md defines the two-option question and routing

- **WHEN** `INTENT.md` is read
- **THEN** it instructs asking Step 1 as one question round
- **AND** it contains both "Build" and "Modify" or "Extend" as explicit options
- **AND** both branches run the planner, the import, and the framework routing, differing in full-project versus delta scope

#### Scenario: INTENT.md describes no Deployment step

- **WHEN** `INTENT.md` is read
- **THEN** neither branch's downstream-consequence list contains a Deployment step or a URL interview
- **AND** neither list refers to a fifth step

#### Scenario: INTENT.md names no client tool as the mechanism

- **WHEN** `INTENT.md` is read
- **THEN** any client tool name appears only as a parenthetical example attached to a portable instruction

## REMOVED Requirements

### Requirement: DEPLOYMENT.md uses plain-language URL descriptions and batches the interview

**Reason**: The requirement made `DEPLOYMENT.md` the owner of the URL wording — the three valid shapes, the plain-language descriptions and example values, the validation rules, the Base-URL derivation table, and the batched interview. That ownership is what produced the duplication this change removes: `formio-mcp-setup` restated the shapes anyway rather than send a reader to another skill's file mid-flow, `formio-angular/SETUP.md` kept its own copy of the exit-code table, and none of it reached an agent using the MCP server with no skills installed. The server now owns this wording in its `instructions` and in its error messages, which every caller sees. With the wording gone, what remained of the document was four lines that belong in the preflight, and a thin file named for the topic is what let the content accumulate there to begin with — so the file is deleted rather than kept.

**Migration**: No replacement document. Configuration resolution is part of the preflight contract in `formio-mcp-setup-skill`: run `project get` for the working directory, relay the message on failure, persist with the `project set` command the message names, retry. The plain-language descriptions, shape enumeration, validation rules, and derivation table are deleted rather than relocated — `server-config` requires the server's own messages to carry what a user needs in order to answer. Documents that referenced `DEPLOYMENT.md` (`formio-mcp-setup/SKILL.md`, `formio-angular/SETUP.md`) drop the reference rather than re-point it.

### Requirement: formio-application runs a five-step orchestration

**Reason**: Configuration resolution was the step whose position in the sequence mattered — it had to precede planning, or a user completed the whole planner interview before the skill discovered it had no project to import into. Moving that resolution into the preflight settles the ordering structurally, because a preflight runs before every step by definition, and leaves the named Deployment step with nothing of its own to do. Five steps became four with no behavior removed.

**Migration**: Replaced by "formio-application runs a four-step orchestration" below. The Deployment step's content survives as the preflight's configuration probe; the approval gate before `project_import` is unchanged; and Step 4.5's conditional `formio-auth` handoff becomes Step 3.5. The `exactly five steps` assertion in `packages/skill-tests/src/skill-descriptions/application-orchestration.test.ts` becomes four.

## ADDED Requirements

### Requirement: formio-application resolves its project configuration in the preflight

The `formio-application` `SKILL.md` preflight SHALL resolve the target project before any step runs, in this order:

1. Confirm the Form.io tools are available. When they are not, route to `formio-mcp-setup` and stop — there is no server to ask for configuration, so the probe below cannot run.
2. Run `npx -y @formio/mcp@<pinned> project get --cwd <the user's working directory>`. On success, confirm the resolved Project URL and Base URL in one line and continue. On failure, ask for the single value the message names, persist it by running the `project set` command the message names, and re-run — repeating if the next run names the second value.
3. Stash the resolved values as `FORMIO_PROJECT_URL` and `FORMIO_BASE_URL` for the Import step and the framework handoff.

This SHALL run on BOTH branches. On modify-existing the workspace's own `FormioAppConfig` is not the server's mapping, and `project_import` resolves against the mapping — so a cloned workspace with URLs in its source and nothing on record is resolved here rather than failing at import.

The skill SHALL NOT carry its own URL interview: it asks only for what the server's message names, and SHALL NOT restate the valid URL shapes, plain-language URL descriptions, example values, validation rules, or Base-URL derivation. It SHALL NOT edit `~/.formio/projects.json` by any means other than the server's own command or tool.

#### Scenario: An existing mapping is confirmed rather than interviewed

- **WHEN** the preflight's `project get` resolves a project for the working directory
- **THEN** the skill confirms the resolved project and base URL in one line
- **AND** it does not ask for either URL
- **AND** Step 1 (Intent) proceeds immediately

#### Scenario: The preflight asks only for the value the server names

- **WHEN** the preflight's `project get` fails because no project URL resolves
- **THEN** the skill asks for the project URL and persists it with the `project set` command the message named
- **AND** when the re-run then reports an unresolved base URL, the skill asks only for the base URL
- **AND** the skill does not present its own list of valid URL shapes or validation rules

#### Scenario: Missing tools route to setup before the probe runs

- **WHEN** the preflight finds no Form.io tools available under any name
- **THEN** the skill routes to `formio-mcp-setup`
- **AND** it does not attempt `project get` or any import
- **AND** it does not write any MCP configuration file
- **AND** it does not claim the user's original request is finished

#### Scenario: Modify-existing resolves the mapping too

- **WHEN** the user says "also track attendees in each event" in an existing Angular workspace
- **THEN** the preflight runs `project get` and completes the configuration if it fails
- **AND** it does not read the URLs out of the workspace and assume the mapping exists

### Requirement: formio-application runs a four-step orchestration

The `formio-application` `SKILL.md` body SHALL describe four ordered steps, with the project configuration already resolved by the preflight and with approval gates between destructive operations:

1. **Intent** — ask whether this is a new app or an existing app being extended. Documented in `INTENT.md`.
2. **Plan** — invoke `formio-resource-planner`, which emits the paired `template.md` (Resource Map) and `template.json` to the working directory. Full-project plan on build-new; delta plan (new resources only) on modify-existing.
3. **Import** — invoke the `project_import` MCP tool with the planner-emitted `template.json`. Preceded by an approval gate. Documented in `IMPORT.md`. Runs on BOTH branches — the modify-existing import is additive. Step 3.5 is the conditional `formio-auth` handoff.
4. **Framework routing** — consult the registry in `FRAMEWORK.md`. Step 4a runs the `frontend-design` pre-check. If exactly one framework is installed, route silently. If multiple, ask the user.

The body MUST reference the three sibling docs (`INTENT.md`, `IMPORT.md`, `FRAMEWORK.md`) by relative link.

There SHALL be no MCP-configuration step and no restart boundary on either branch. The mapping the server reads at tool-call time is written by `project set` / `project_set` during the preflight, so no configuration file and no session reload stands between resolution and import.

#### Scenario: Build-new branch runs end to end in one invocation

- **WHEN** the user says "build me a CRM" (no existing workspace) and Form.io tools are available
- **THEN** the preflight resolves the configuration and Steps 1 through 4 run in a single invocation
- **AND** the planner runs as Step 2, after the configuration resolved
- **AND** Step 3 reaches its import approval gate without any intervening restart or reload

#### Scenario: The body describes four steps

- **WHEN** `SKILL.md` is read
- **THEN** it describes exactly four steps, none of which writes MCP configuration
- **AND** it contains no separate Deployment step
- **AND** it contains no instruction to halt, restart, or reload for MCP configuration to take effect
- **AND** it does not link to `MCP_CONFIG.md` or `DEPLOYMENT.md`

#### Scenario: Modify-existing branch plans a delta and imports it additively

- **WHEN** the user says "also track attendees in each event" in an existing Angular workspace
- **THEN** Step 1 determines intent = modify-existing
- **AND** Step 2 produces a delta plan covering only the new resources
- **AND** Step 3 additively imports that delta template
- **AND** Step 4 routes to the framework's extend sub-skill (`formio-angular-resources` today)

#### Scenario: User bails at the Import approval gate

- **WHEN** Step 3's approval gate shows the URLs + template summary + merge-overwrite warning and the user declines
- **THEN** `project_import` is not called
- **AND** the skill continues with Step 4 (framework routing) so the user can still scaffold against an existing project
