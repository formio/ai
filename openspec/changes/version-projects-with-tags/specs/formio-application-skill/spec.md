## MODIFIED Requirements

### Requirement: INTENT.md captures build-vs-modify in one question round

`skills/formio-application/INTENT.md` SHALL instruct the skill to present Step 1 as a single question round with exactly two explicit options — "Build a new app" and "Modify / extend an existing app" — using the client's structured question mechanism, which it MAY name as a parenthetical example only. Where the client's mechanism offers a free-text answer alongside fixed options, `INTENT.md` SHALL describe that affordance in portable terms rather than by naming it.

`INTENT.md` MUST define the downstream consequence of each answer, against the four-step flow whose project configuration the preflight resolves at Step 3:

- Build-new → run the planner in full-project mode (Step 2), import the full template (Step 3), route to the framework's entry skill (Step 4).
- Modify-existing → check the project against its current version and plan the change (Step 2), apply the change plan with the form, role, and action tools (Step 3), route to the framework's extend sub-skill (Step 4 with the detection path), then version the project. It SHALL NOT describe the change as an import, or as additive.

Neither branch SHALL describe a Deployment step or a URL interview: the configuration is resolved by the preflight at Step 3, on both branches, and is not a step of `INTENT.md`'s own.

#### Scenario: INTENT.md defines the two-option question and routing

- **WHEN** `INTENT.md` is read
- **THEN** it instructs asking Step 1 as one question round
- **AND** it contains both "Build" and "Modify" or "Extend" as explicit options
- **AND** both branches run the planner and the framework routing; build-new imports, and modify-existing applies a change plan with the granular tools

#### Scenario: INTENT.md describes no Deployment step

- **WHEN** `INTENT.md` is read
- **THEN** neither branch's downstream-consequence list contains a Deployment step or a URL interview
- **AND** neither list refers to a fifth step

#### Scenario: INTENT.md names no client tool as the mechanism

- **WHEN** `INTENT.md` is read
- **THEN** any client tool name appears only as a parenthetical example attached to a portable instruction

### Requirement: formio-application runs a four-step orchestration

The `formio-application` `SKILL.md` body SHALL describe four ordered steps, with the project configuration resolved by the preflight at Step 3 and with approval gates between destructive operations:

1. **Intent** — ask whether this is a new app or an existing app being extended. Documented in `INTENT.md`.
2. **Plan** — invoke `formio-resource-planner`. On build-new it emits the paired `template.md` (Resource Map) and `template.json` to the working directory. On modify-existing it first checks the project against its current version (`CHANGE.md`), then emits a change plan: a dated change section in `template.md` and `changes.json`.
3. **Import or apply** — on build-new, invoke `project_import` with the planner's `template.json`, behind an approval gate (`IMPORT.md`). On modify-existing, apply the change plan with `role_create`, `form_create`, `form_update`, and `action_create`, behind an approval gate (`CHANGE.md`); `project_import` is never called for an existing project. Step 3.5 is the conditional `formio-auth` handoff.
4. **Framework routing** — consult the registry in `FRAMEWORK.md`. Step 4a runs the `frontend-design` pre-check. If exactly one framework is installed, route silently. If multiple, ask the user.

After Step 4, when the feature is finished, the body SHALL describe versioning the project (`CHANGE.md`) — not as a fifth step but as how each branch finishes. The body MUST reference the four sibling docs (`INTENT.md`, `IMPORT.md`, `CHANGE.md`, `FRAMEWORK.md`) by relative link.

There SHALL be no MCP-configuration step and no restart boundary on either branch. The mapping the server reads at tool-call time is written by the `project_set` tool during the preflight, and every tool resolves its project on each call, so no configuration file and no session reload stands between resolution and import.

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

#### Scenario: Modify-existing branch plans a change and applies it with the granular tools

- **WHEN** the user says "also track attendees in each event" in an existing Angular workspace
- **THEN** Step 1 determines intent = modify-existing
- **AND** Step 2 checks the project against its current version and produces a change plan covering only the new and changed entities
- **AND** Step 3 applies it with the form, role, and action tools and does not call `project_import`
- **AND** Step 4 routes to the framework's extend sub-skill (`formio-angular-resources` today)

#### Scenario: User bails at the Import approval gate

- **WHEN** Step 3's approval gate shows the URLs + template summary + replace warning and the user declines
- **THEN** `project_import` is not called
- **AND** the skill continues with Step 4 (framework routing) so the user can still scaffold against an existing project

### Requirement: IMPORT.md documents the import flow and error branches

`skills/formio-application/IMPORT.md` SHALL document:

- The offer-to-import gate (after the preflight has resolved the project and the planner has emitted its templates, before `project_import`).
- The pre-auth messaging (warn about browser window).
- The import-confirmation preview (URLs + plain-language template summary + a warning stating what the import replaces), and that the import is for a first build: an existing project is changed through `CHANGE.md`.
- The `project_import` invocation with the template payload and the caller's `cwd`.
- The three error branches — auth failure (401/403), project not found (404), import validation failure (400) — each with a user-facing action.
- The headless-environment fallback (print the portal-login URL for manual open).

It SHALL refer to the import as Step 3 of the four-step flow, and SHALL NOT reference an MCP-configuration step: that step no longer exists, and this requirement continued to describe the gate as following it.

#### Scenario: IMPORT.md covers the required topics

- **WHEN** `IMPORT.md` is read
- **THEN** it names the `project_import` MCP tool
- **AND** it describes the browser-based portal-login trigger and the headless fallback
- **AND** it contains the import-confirmation preview wording including what the import replaces
- **AND** it does not call the import additive
- **AND** it documents the three error-handling branches by name

#### Scenario: IMPORT.md references no MCP-configuration step

- **WHEN** `IMPORT.md` is read
- **THEN** its description of the import gate names the preflight and the planner, not an MCP-configuration step
- **AND** it refers to the import as Step 3

## ADDED Requirements

### Requirement: The project, versioned by tags, is the source of truth

`formio-application` SHALL treat the Form.io project the folder resolves to as the source of truth, versioned by Form.io tags, and `template.json` as an export of the newest tag. No skill SHALL edit `template.json` to change a project, and no skill SHALL re-import it into a project that already has content. Deploying a tag to another stage SHALL be named once as work done outside the agent (the portal or the user's own CI/CD); no skill distinguishes an authoring stage from a live one.

#### Scenario: template.json is never edited to change the project

- **WHEN** `formio-application` and `CHANGE.md` are read
- **THEN** they direct changes to the project through the granular tools
- **AND** they state that `template.json` is refreshed only by exporting a tag

### Requirement: Each branch finishes by versioning the project

On build-new, after a successful import, and on modify-existing, once the change and the application code that uses it are finished, `formio-application` SHALL propose the next semver version — `1.0.0` for a first build, a minor bump for a feature, a patch bump for a fix, after the current version `project_tag_list` reports — with a one-line description of the change, ask the user, and on approval create it with `project_tag_create` and export it with `project_export` `tag` over `template.json`. A declined proposal leaves the project untagged and `template.json` unchanged, and the skill says so.

#### Scenario: First build is tagged 1.0.0

- **WHEN** the build-new import succeeds and the user approves the proposed tag
- **THEN** the skill creates tag `1.0.0` with the description and exports it over `template.json`

#### Scenario: A feature bumps the minor version

- **WHEN** the current version is `1.2.0` and a feature is finished
- **THEN** the skill proposes `1.3.0` and asks before creating it

### Requirement: CHANGE.md checks for changes made outside the agent before planning

`skills/formio-application/CHANGE.md` SHALL, on modify-existing before Step 2 plans, call `project_tag_list` with `compare: true`. When it reports changes since the current version, the skill SHALL show them and offer to capture them as a patch tag before planning, and SHALL plan against the project's current state either way. With no current version, it SHALL offer a baseline tag (`0.1.0`) before planning. The baseline the planner reads is the current tag's export when the project matches it, and `project_export` of the current state otherwise.

#### Scenario: Portal changes are surfaced before planning

- **WHEN** a form was edited in the portal after the current tag
- **THEN** `CHANGE.md` shows the change and offers a patch tag before Step 2

### Requirement: CHANGE.md applies a change plan with the granular tools

`CHANGE.md` SHALL apply the planner's change plan behind one approval gate that lists every entity to create or update, in dependency order — roles, then resources, then forms, then actions — with `role_create`, `form_create`, `form_update` (reading each form with `form_get` first, and taking the user's agreement on history as those tools require), and `action_create`, resolving machine names in the plan to ids from the project. A failure SHALL stop the run and report what was applied and what was not; nothing applied SHALL be rolled back without the user's say-so.

#### Scenario: A new resource and its form are applied in order

- **WHEN** the change plan adds role `vendor`, resource `vendor`, and a `vendorRegister` form with Save and Role Assignment actions
- **THEN** the role is created first, then the resource, then the form, then the actions, each resolving names to ids from the project

### Requirement: The extend handoff carries the change plan

On modify-existing, the handoff to the extend sub-skill SHALL name `changesJsonPath` (the planner's `changes.json`) in place of a delta `templateJsonPath`, alongside `templateMdPath` and `newResourceNames`, as `FRAMEWORK.md`'s handoff reference states.

#### Scenario: Extend handoff fields

- **WHEN** `FRAMEWORK.md`'s handoff reference is read
- **THEN** the modify-existing column names `changesJsonPath` and no delta `templateJsonPath`
