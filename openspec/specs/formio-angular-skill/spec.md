## Purpose

Defines the `formio-angular` skill: the Angular framework implementor for the skill library — its directory layout, its trigger surface, the order it runs its phases in, and the sub-skill it delegates per-resource work to.
## Requirements
### Requirement: Parent skill directory layout

The skills library SHALL provide a parent skill `formio-angular` at `skills/formio-angular/` containing:

- `SKILL.md` — the parent skill file with frontmatter `name: formio-angular`
- `SETUP.md` — sibling reference document (no frontmatter) covering the URL interview
- `BOOTSTRAP.md` — sibling reference document (no frontmatter) covering workspace bootstrap
- `CONFIG.md` — sibling reference document (no frontmatter) covering `FormioAppConfig` / `config.ts` generation
- `AUTH.md` — sibling reference document (no frontmatter) covering `AuthModule` / `FormioAuthConfig` wiring
- `formio-angular-resources/SKILL.md` — the sub-skill file with frontmatter `name: formio-angular-resources`
- `formio-angular-resources/{references,assets,evals}/` — the sub-skill's reference material, assets, and eval harness

The sub-skill's directory name SHALL equal its declared `name`, as the Agent Skills specification requires. The directory `skills/formio-angular/resources/` MUST NOT exist after this change: clients other than Claude Code discover skills by recursive directory scan and reject or misregister a skill whose directory name and `name` disagree.

`SETUP.md`, `BOOTSTRAP.md`, `CONFIG.md`, and `AUTH.md` MUST NOT contain skill frontmatter. They are loaded by the parent `SKILL.md` as reference documents, not independently triggerable skills.

The directory `skills/formio-resource-angular/` MUST NOT exist. The symlink `.claude/skills/formio-resource-angular` MUST NOT exist; it is replaced by `.claude/skills/formio-angular` → `../../plugin/skills/formio-angular`.

#### Scenario: Parent skill files exist

- **WHEN** the repository is inspected after the change is applied
- **THEN** `skills/formio-angular/SKILL.md`, `SETUP.md`, `BOOTSTRAP.md`, `CONFIG.md`, and `AUTH.md` all exist
- **AND** `skills/formio-angular/formio-angular-resources/SKILL.md` exists
- **AND** `skills/formio-angular/resources/` does not exist
- **AND** `skills/formio-resource-angular/` does not exist
- **AND** `.claude/skills/formio-angular` resolves to `plugin/skills/formio-angular/`

#### Scenario: Sub-skill directory name matches its declared name

- **WHEN** `skills/formio-angular/formio-angular-resources/SKILL.md` frontmatter is parsed
- **THEN** its `name` is `formio-angular-resources`
- **AND** the containing directory is named `formio-angular-resources`

#### Scenario: Sub-skill eval harness is relocated intact

- **WHEN** the repository is inspected after the change is applied
- **THEN** `skills/formio-angular/formio-angular-resources/evals/{evals.json,grade.py,README.md,fixtures/}` exist
- **AND** their contents match what was previously at `skills/formio-angular/resources/evals/` with only path strings updated to reflect the new location

#### Scenario: No stale links into the old sub-skill path remain

- **WHEN** the live surface is searched for the literal string `formio-angular/resources/` after the change is applied — every file under `plugin/skills/`, plus `CLAUDE.md`, `README.md`, and `plugin/README.md`
- **THEN** no matches are found
- **AND** records of the change itself (`openspec/`) are out of scope, since they describe the pre-change state deliberately

### Requirement: Parent skill description and trigger surface

The parent `formio-angular` `SKILL.md` frontmatter `description` SHALL claim ONLY framework-explicit Angular triggers — phrases that explicitly name Angular or request Angular-specific behavior. The description MUST include at least the following positive triggers:

- "build it in Angular"
- "Angular front-end for this Form.io project"
- "use Angular"
- "the Angular skill"
- Invocation from `formio-application` via handoff context (the orchestrator passes the framework choice explicitly).

The description MUST drop all plain-language "build me an app" triggers (those now belong to `formio-application`). The description MUST NOT contain generic phrases like "build me an app", "build me a tool", "spin up an app", "I need a tool to track", or bare domain archetypes like "task manager", "help desk", "CRM", "booking system".

The description MUST include a `Not for:` clause pointing at `formio-application` for generic build-an-app requests and for framework-agnostic "I want to build X" requests.

The description MUST include a `Not for:` clause pointing at `formio-form` for framework-agnostic embed/render-a-form requests that do not name Angular or `@formio/angular`.

The description MUST continue to include the existing `Not for:` clause pointing at `formio-angular-resources` for add-a-feature-to-an-existing-app requests.

#### Scenario: formio-angular only fires on Angular-explicit phrasing

- **WHEN** the user says "build it in Angular" or "I want an Angular front-end for my Form.io project"
- **THEN** the `formio-angular` skill activates
- **AND** `formio-application` does not activate

#### Scenario: formio-angular does not fire on generic build-an-app phrasing

- **WHEN** the user says "build me a CRM" (no mention of Angular)
- **THEN** the `formio-angular` skill does NOT activate
- **AND** `formio-application` activates instead

#### Scenario: formio-angular does not fire on generic embed phrasing

- **WHEN** the user says "embed this form in my web page" (no mention of Angular)
- **THEN** the `formio-angular` skill does NOT activate
- **AND** `formio-form` activates instead
- **AND** the `formio-angular` description contains a `Not for:` clause with the literal substring `formio-form`

#### Scenario: formio-angular description Not-for clause names the orchestrator

- **WHEN** the `formio-angular` `SKILL.md` frontmatter is inspected
- **THEN** its `description` contains the literal substring `formio-application`
- **AND** it contains a `Not for:` clause pointing at `formio-application`

### Requirement: Sub-skill description and trigger surface

The sub-skill `formio-angular-resources` (`skills/formio-angular/formio-angular-resources/SKILL.md`) frontmatter `description` SHALL claim ONLY framework-explicit Angular-extension triggers, and SHALL be at most 1,024 characters when whitespace-normalized — the Agent Skills specification's maximum. The description MUST include at least:

- "add an Angular module for X"
- "regenerate the Angular X resource module"
- "in my Angular app, wire Y to Z"
- "fix the Angular <component> component"
- Invocation from `formio-angular` via handoff context.

The description MUST drop all plain-language "also track X" / "add Y to the app" triggers (those belong to `formio-application`'s modify-existing branch). The description MUST NOT contain generic phrases like "also track", "also let", "add a way to see", "each X should have a list of Y", or "let users do Z".

The description MUST include a `Not for:` clause pointing at `formio-application` for generic extend-an-app requests.

Content trimmed to meet the budget — the enumeration of supported feature shapes (simple resources, parent→child hierarchies, bidirectional joins, transitive group access) and the two-phase cadence narration — SHALL move into the `SKILL.md` body, which loads on activation. Trigger phrases, the boundary rule, and the `Not for:` clause SHALL NOT be dropped to make room.

#### Scenario: Sub-skill description fits the specification budget

- **WHEN** the sub-skill `description` is whitespace-normalized and measured
- **THEN** its length is ≤ 1,024 characters

#### Scenario: Sub-skill only fires on Angular-explicit extension phrasing

- **WHEN** the user says "add an Angular module for Participant in my Event app"
- **THEN** the `formio-angular-resources` sub-skill activates

#### Scenario: Sub-skill does not fire on generic extend phrasing

- **WHEN** the user says "also track attendees for each event" (no mention of Angular)
- **THEN** `formio-angular-resources` does NOT activate
- **AND** `formio-application` activates instead

#### Scenario: Trimmed content survives in the body

- **WHEN** the sub-skill `SKILL.md` body is inspected after the description trim
- **THEN** it documents the supported feature shapes (simple resource, parent→child hierarchy, bidirectional join, transitive group access)
- **AND** it documents the two-phase plan-then-generate cadence

### Requirement: Parent skill orchestration order

The parent `formio-angular` `SKILL.md` SHALL instruct Claude to execute the following phases in the following strict order, with a user-approval gate between each:

1. **SETUP** — obtain the Form.io `Project URL` and `Base URL` by running `npx -y @formio/mcp@<pinned> project get --cwd <the workspace directory>`. On success the printed values ARE the configuration: confirm them in one short acknowledgement and proceed without interviewing. On failure, ask for the single value the message names, persist it with the `project set` command the message names, and re-run until it resolves. When `formio-application` handed these values in, the skill SHALL still confirm them against `project get` rather than trusting the handoff, because the mapping is what `@formio/angular` and every later tool call resolve against.
2. **CONFIG** — generate `src/app/config.ts` exporting `AppConfig: FormioAppConfig` with `appUrl` = the project URL and `apiUrl` = the base URL **as reported by `project get`**, and wire it into `AppModule` via `{ provide: FormioAppConfig, useValue: AppConfig }`. Match the pattern at `https://github.com/formio/angular-demo/blob/master/src/app/config.ts` and `https://github.com/formio/angular-demo/blob/master/src/app/app-module.ts`.
3. **AUTH** — generate `src/app/auth/auth.module.ts` configuring `FormioAuthConfig` from the `template.json` auth resources and roles. Import `AuthModule` into `AppModule`.
4. **Resources** — delegate to the `formio-angular-resources` sub-skill with the accumulated context.

SETUP SHALL NOT carry its own URL interview wording. It SHALL NOT enumerate the valid URL shapes, restate plain-language URL descriptions, apply its own URL validation, derive a base URL itself, or reproduce a `project get` exit-code table — the server's message says what is missing and how to fix it, and SETUP relays it.

The skill SHALL NOT run an Inference phase (planner handoff). Planner invocation is `formio-application`'s responsibility. When `formio-angular` is invoked directly by a user (framework-explicit trigger), the skill SHALL expect an already-approved `template.json` and a workspace ready for file generation; if neither exists, it SHALL ask the user to invoke `formio-application` first rather than running the planner itself.

The skill SHALL NOT run an Import phase. Template import into a Form.io project is `formio-application`'s responsibility.

#### Scenario: Parent accepts handoff from formio-application

- **WHEN** `formio-application` invokes `formio-angular` after completing its Deployment and Import steps
- **THEN** `formio-angular` SHALL NOT run a URL interview
- **AND** it SHALL confirm the configuration by running `project get` for the workspace
- **AND** it SHALL proceed to CONFIG using the values that command reported

#### Scenario: SETUP completes a half-configured mapping without interviewing for both URLs

- **WHEN** SETUP runs `project get` and the command reports a resolved project URL with an unresolved base URL
- **THEN** SETUP asks only for the base URL
- **AND** it persists it with the `project set --base-url` command the message named
- **AND** it re-runs `project get` before generating `config.ts`

#### Scenario: CONFIG writes the URLs the server reported

- **WHEN** CONFIG generates `src/app/config.ts`
- **THEN** `appUrl` is the project URL reported by `project get` and `apiUrl` is the base URL it reported
- **AND** neither value is composed, derived, or defaulted by the skill

#### Scenario: SETUP carries no URL wording of its own

- **WHEN** `plugin/skills/formio-angular/SETUP.md` is read
- **THEN** it does not enumerate the valid URL shapes
- **AND** it contains no `project get` exit-code table, no URL validation rules, and no Base-URL derivation
- **AND** it does not reference another skill's document as the owner of that wording

#### Scenario: Parent rejects invocation without upstream plan

- **WHEN** a user invokes `formio-angular` directly with no approved `template.json` in scope
- **THEN** the skill asks the user to invoke `formio-application` first
- **AND** it does not run the planner itself

#### Scenario: Parent enforces phase order for file generation

- **WHEN** `formio-angular` runs its SETUP → CONFIG → AUTH → Resources sequence
- **THEN** each phase ends with an approval gate before files are written
- **AND** a declined gate stops the flow without writing partial state

### Requirement: Planner persists template.json to the working directory

When the `formio-resource-planner` skill emits Phase B, it SHALL also write the `template.json` content to a file on disk in the user's working directory, not only as a fenced JSON block in the chat transcript.

- Default filename: `template.json` in the current working directory.
- If `template.json` already exists in the cwd, the planner SHALL write to `template-<timestamp>.json` and MUST report the chosen filename to the user.
- The planner's `SKILL.md` MUST explicitly document the file-write behavior in its Phase B section.
- The planner's "does not call the MCP server" stance is preserved — local filesystem writes are explicitly permitted.

When `formio-application` invokes the planner as part of its build-new branch, the planner MUST persist the file so that `formio-application`'s Import step can pass a real file path to `project_import`.

#### Scenario: Planner writes template.json on Phase B

- **WHEN** the planner emits Phase B after user approval, in a working directory that contains no existing `template.json`
- **THEN** a file named `template.json` exists in the working directory and contains the same JSON that appeared in the chat transcript

#### Scenario: Planner avoids overwriting an existing file

- **WHEN** the planner emits Phase B in a working directory that already contains `template.json`
- **THEN** the planner writes to `template-<timestamp>.json` instead
- **AND** the planner tells the user the filename it used
- **AND** the original `template.json` is not modified

### Requirement: Parent skill derives AUTH from template.json

When a `formio-resource-planner` `template.json` is available, the parent `formio-angular` skill's AUTH phase SHALL:

- Identify the user resource by inspecting the `template.json` `resources`/`forms` for forms tagged with the `user` purpose or matching the planner's "Users & Auth" output.
- Extract the login form and register form names used by that user resource.
- Extract the role list from `template.json` `roles`.
- Populate `FormioAuthConfig` with those values (e.g., `{ login: { form: '<loginFormName>' }, register: { form: '<registerFormName>' }, ... }`).
- Preview the generated `auth.module.ts` to the user before writing, citing the specific `template.json` values it used.

If no `template.json` is available, the parent MUST ask the user whether to (a) run `formio-resource-planner` first, or (b) skip AUTH and configure a bare `AppModule` without an auth module, leaving a TODO comment pointing at `formio-api/references/runtime-auth` and `formio-api/references/platform-auth` for later wiring.

#### Scenario: AUTH derived from template.json

- **WHEN** the user hands Claude a `template.json` produced by `formio-resource-planner` that defines a user resource `customer`, a login form `customerLogin`, a register form `customerRegister`, and roles `admin`, `customer`
- **THEN** the AUTH phase's generated `auth.module.ts` references `customerLogin` and `customerRegister` and lists `admin` and `customer` in any role-dependent configuration

#### Scenario: No template.json — user chooses to skip AUTH

- **WHEN** no `template.json` is available and the user opts to skip AUTH
- **THEN** the parent skill writes `app-module.ts` without importing an `AuthModule`
- **AND** the parent skill inserts a `// TODO: configure auth — see formio-api/references/runtime-auth` comment where the import would go

### Requirement: Parent skill detects existing configuration

The parent `formio-angular` skill SHALL inspect the target workspace before each phase and skip phases whose outputs already exist and are correctly wired:

- If `src/app/config.ts` already exports a `FormioAppConfig` whose `appUrl` and `apiUrl` match the URLs `project get` reported in SETUP, skip the CONFIG phase.
- If `AppModule` already imports an `AuthModule` that configures `FormioAuthConfig`, skip the AUTH phase (but still offer to regenerate if the user asks).
- If neither condition holds, run the phase as normal.

A `config.ts` that exists but whose URLs DISAGREE with what `project get` reported SHALL NOT be treated as a skip. The workspace's committed configuration and the server's mapping are two different records of the same fact, and a silent skip leaves the app pointed at one deployment while every build-time tool call resolves another. The skill SHALL surface the mismatch — naming both pairs and which came from where — and ask the user which one is correct before writing or skipping.

When a phase is skipped, Claude MUST tell the user which phase was skipped and why (which existing file or import triggered the skip), so the user can override if needed.

#### Scenario: Existing config is detected and CONFIG phase is skipped

- **WHEN** the parent skill activates on a workspace whose `src/app/config.ts` already exports a `FormioAppConfig` with `appUrl: 'https://example.form.io'` and `apiUrl: 'https://api.form.io'`
- **AND** `project get` reports those same URLs
- **THEN** Claude notifies the user that CONFIG is being skipped because `src/app/config.ts` already matches
- **AND** Claude proceeds directly to the AUTH phase

#### Scenario: A config that disagrees with the mapping is surfaced, not skipped

- **WHEN** `src/app/config.ts` exports `appUrl: 'https://old.form.io'` and `project get` reports a project URL of `https://new.form.io`
- **THEN** Claude reports both pairs and which record each came from
- **AND** it asks the user which is correct before writing `config.ts` or skipping CONFIG
- **AND** it does not silently skip the phase
### Requirement: Planner handoff

The parent `formio-angular` skill SHALL treat the `formio-resource-planner` skill as its upstream input producer. When the planner finishes and has an approved Resource Map plus `template.json`, its recommended next step MUST name `formio-angular` as the next skill to run.

The parent `formio-angular` skill's interview MUST begin by asking whether a `template.json` from the planner is available, and if not, whether to run the planner first.

#### Scenario: Planner recommends parent skill on completion

- **WHEN** the `formio-resource-planner` skill completes Phase B and emits its "next steps" guidance
- **THEN** the guidance names `formio-angular` as the skill to run next
- **AND** the guidance does not name `formio-resource-angular`

### Requirement: Documentation and cross-references reflect the new layout

`CLAUDE.md` SHALL, in its "Iterating on skills" section, name `formio-resource-planner` and `formio-angular` as the two skills that ship eval harnesses, with the resource sub-skill located at `plugin/skills/formio-angular/formio-angular-resources/`. Any reference to `formio-resource-angular` by name SHALL be `formio-angular` or `formio-angular-resources` (whichever scope the reference intends) in `CLAUDE.md` and in any skill cross-links inside the skills library (notably `skills/formio-resource-planner/evals/README.md`).

Every path reference to the sub-skill — in `CLAUDE.md`, `README.md`, `plugin/README.md`, the parent skill's `SKILL.md` / `BOOTSTRAP.md` / `AUTH.md`, the sub-skill's own `references/*.md`, and its eval harness — SHALL point at `formio-angular-resources/` rather than `resources/`.

Eval artifact paths SHALL remain `.eval-artifacts/formio-angular-resources/` in `skills/formio-angular/formio-angular-resources/evals/{grade.py,README.md,evals.json}`.

#### Scenario: No stale skill-name references remain

- **WHEN** the repository is searched for the literal string `formio-resource-angular` after the change is applied
- **THEN** no matches are found outside of (a) archived change artifacts and (b) this change's own artifacts

#### Scenario: Documentation points at the renamed directory

- **WHEN** `CLAUDE.md` is inspected after the change is applied
- **THEN** it locates the resource sub-skill at `plugin/skills/formio-angular/formio-angular-resources/`

#### Scenario: Eval harness paths resolve after the rename

- **WHEN** the sub-skill's `evals/grade.py` and `evals/README.md` are inspected
- **THEN** every repository path they reference exists

