## ADDED Requirements

### Requirement: New skill `formio-application` exists as the library's build-an-app entry point

The skills library SHALL contain a new skill at `skills/formio-application/SKILL.md` with frontmatter `name: formio-application`. The skill directory SHALL contain the following sibling reference documents, none of which have YAML frontmatter:

- `SETUP.md` is NOT used for this skill (setup of URLs is `DEPLOYMENT.md`'s concern).
- `INTENT.md` — the build-vs-modify interview script.
- `DEPLOYMENT.md` — the Base URL + Project URL interview.
- `IMPORT.md` — the `project_import` invocation and error handling.
- `FRAMEWORK.md` — the framework registry + routing logic.

A symlink `.claude/skills/formio-application` SHALL exist and resolve to `skills/formio-application/`.

#### Scenario: formio-application directory layout

- **WHEN** the repository is inspected after the change is applied
- **THEN** `skills/formio-application/SKILL.md`, `INTENT.md`, `DEPLOYMENT.md`, `IMPORT.md`, and `FRAMEWORK.md` all exist
- **AND** none of `INTENT.md`, `DEPLOYMENT.md`, `IMPORT.md`, or `FRAMEWORK.md` begins with a YAML frontmatter block (first line is not `---`)
- **AND** `.claude/skills/formio-application` resolves to `skills/formio-application/`

### Requirement: formio-application description claims plain-language triggers and names the framework skills

The `formio-application` `SKILL.md` frontmatter `description` SHALL claim plain-language build-an-app and extend-an-app triggers WITHOUT requiring the user to know any UI framework or Form.io terminology. Example triggers the description MUST claim include:

- Build-new: "build me an app", "create a CRM", "I need a tool to track X", "spin up a system for Y", bare domain archetypes ("task manager", "help desk").
- Extend-existing: "also track X", "add a way to see Y", "each Z should have a list of W", "let users also submit V".

The description MUST state that this skill is the library's default build-an-app entry point; that it picks a UI framework automatically when only one is installed and asks the user when multiple are installed; that the user does NOT need to mention "Angular", "React", "framework", "resource", or "NgModule".

The description MUST include `Not for:` clauses pointing at:

- `formio-angular` for framework-explicit Angular requests ("build it in Angular").
- `formio-angular-resources` for framework-explicit Angular extension requests.
- `formio-resource-planner` for data-model-only planning requests without building an app.
- `formio-api` for endpoint lookups.

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

### Requirement: formio-application runs a five-step orchestration

The `formio-application` `SKILL.md` body SHALL describe five ordered steps with approval gates between destructive operations:

1. **Intent** — ask whether this is a new app or an existing app being extended. Documented in `INTENT.md`.
2. **Deployment** — batched `AskUserQuestion` capturing Base URL and Project URL, with plain-language descriptions. Documented in `DEPLOYMENT.md`. Skipped on the modify-existing branch (URLs are read from the existing workspace's `FormioAppConfig`).
3. **Authenticate** — warn the user a browser window may open, trigger MCP lazy-auth. Silent when a cached JWT is valid. Skipped on the modify-existing branch (no MCP call needed).
4. **Import** — invoke the `project_import` MCP tool with the planner-emitted `template.json` and the captured Project URL. Preceded by an approval gate showing the URLs and a plain-language summary of what the template contains, plus the merge-overwrite warning. Skipped on the modify-existing branch.
5. **Framework routing** — consult the registry in `FRAMEWORK.md`. If exactly one framework is installed, route silently to its entry skill (build-new) or extend sub-skill (modify-existing). If multiple are installed, ask the user via `AskUserQuestion`.

The body MUST reference the sibling docs (`INTENT.md`, `DEPLOYMENT.md`, `IMPORT.md`, `FRAMEWORK.md`) by relative link.

The body MUST describe the build-new branch driving `formio-resource-planner` before Step 2, and MUST NOT suggest that the user has to invoke the planner separately.

#### Scenario: Build-new branch drives the full pipeline

- **WHEN** the user says "build me a CRM" (no existing workspace)
- **THEN** Step 1 determines intent = build-new
- **AND** the planner runs before Step 2
- **AND** Steps 2, 3, 4 run with their approval gates
- **AND** Step 5 routes to `formio-angular` (only framework currently installed)

#### Scenario: Modify-existing branch skips planner and import

- **WHEN** the user says "also track attendees in each event" in an existing workspace that has `FormioAppConfig` wired
- **THEN** Step 1 determines intent = modify-existing
- **AND** the planner does not run
- **AND** Steps 2, 3, 4 are skipped
- **AND** Step 5 routes to `formio-angular-resources` (the Angular framework's extend sub-skill)

#### Scenario: User bails at the Import approval gate

- **WHEN** Step 4's approval gate shows the URLs + template summary + merge-overwrite warning and the user declines
- **THEN** `project_import` is not called
- **AND** the skill continues with Step 5 (framework routing) so the user can still scaffold against an existing project

### Requirement: FRAMEWORK.md defines a registry with single- and multi-framework routing

`FRAMEWORK.md` SHALL contain a table of installed UI-framework skills in the following shape:

| Framework | Entry skill | Extend sub-skill | Detection signal |
|---|---|---|---|
| Angular | `formio-angular` | `formio-angular-resources` | `angular.json` in workspace root OR `@angular/core` in `package.json` |

`FRAMEWORK.md` body MUST document:

- That routing is driven by this table.
- That when the table has exactly one active row, Step 5 routes silently (no user question).
- That when the table has multiple active rows, Step 5 uses `AskUserQuestion` to let the user pick.
- That modify-existing workspaces are detected via the "Detection signal" column, and if exactly one signal matches the routing is direct.
- How to add a new framework entry — the concrete instruction for whoever is adding `formio-react` later.

#### Scenario: Single-framework registry routes silently

- **WHEN** `FRAMEWORK.md`'s table contains exactly one row (Angular) and intent = build-new
- **THEN** Step 5 routes to `formio-angular` without asking the user

#### Scenario: Multi-framework registry asks the user

- **WHEN** a future change adds a second row to the table (e.g., React) and intent = build-new
- **THEN** Step 5 presents the available frameworks via `AskUserQuestion` before routing

#### Scenario: Existing-workspace detection routes directly

- **WHEN** intent = modify-existing and the workspace contains `angular.json`
- **THEN** Step 5 routes to `formio-angular-resources` without asking the user

### Requirement: IMPORT.md documents the import flow and error branches

`skills/formio-application/IMPORT.md` SHALL document:

- The offer-to-import gate (after planner, before URLs on build-new branch).
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

- Build-new → run the planner, then Steps 2–5.
- Modify-existing → skip Steps 2–4, go directly to framework detection (Step 5 with detection path).

#### Scenario: INTENT.md defines the two-option question and routing

- **WHEN** `INTENT.md` is read
- **THEN** it names `AskUserQuestion`
- **AND** it contains both "Build" and "Modify" or "Extend" as explicit options
- **AND** it documents the skip-steps-2-through-4 behavior for the modify branch

### Requirement: formio-application invokes formio-resource-planner internally on the build-new branch

On the build-new branch, the `formio-application` skill SHALL invoke `formio-resource-planner` before Step 2 (Deployment). The user is NOT required to invoke the planner themselves.

`SKILL.md` MUST describe the planner handoff explicitly and MUST NOT leave the planner as an implicit prerequisite.

#### Scenario: Build-new drives planner without user action

- **WHEN** the user says "build me a CRM" and chooses build-new in Step 1
- **THEN** the `formio-application` skill runs `formio-resource-planner` before asking for URLs
- **AND** the user is not asked "have you run the planner yet?"
