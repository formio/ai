## ADDED Requirements

### Requirement: Parent skill directory layout

The skills library SHALL provide a parent skill `formio-angular` at `skills/formio-angular/` containing:

- `SKILL.md` — the parent skill file with frontmatter `name: formio-angular`
- `SETUP.md` — sibling reference document (no frontmatter) covering the URL interview
- `CONFIG.md` — sibling reference document (no frontmatter) covering `FormioAppConfig` / `config.ts` generation
- `AUTH.md` — sibling reference document (no frontmatter) covering `AuthModule` / `FormioAuthConfig` wiring
- `resources/SKILL.md` — the sub-skill file with frontmatter `name: formio-angular-resources`
- `resources/{references,assets,evals}/` — the sub-skill's reference material, assets, and eval harness

`SETUP.md`, `CONFIG.md`, and `AUTH.md` MUST NOT contain skill frontmatter. They are loaded by the parent `SKILL.md` as reference documents, not independently triggerable skills.

The directory `skills/formio-resource-angular/` MUST NOT exist after this change. The symlink `.claude/skills/formio-resource-angular` MUST NOT exist; it is replaced by `.claude/skills/formio-angular` → `../../skills/formio-angular`.

#### Scenario: Parent skill files exist

- **WHEN** the repository is inspected after the change is applied
- **THEN** `skills/formio-angular/SKILL.md`, `SETUP.md`, `CONFIG.md`, and `AUTH.md` all exist
- **AND** `skills/formio-angular/resources/SKILL.md` exists
- **AND** `skills/formio-resource-angular/` does not exist
- **AND** `.claude/skills/formio-angular` resolves to `skills/formio-angular/`
- **AND** `.claude/skills/formio-resource-angular` does not exist

#### Scenario: Sub-skill eval harness is relocated intact

- **WHEN** the repository is inspected after the change is applied
- **THEN** `skills/formio-angular/resources/evals/{evals.json,grade.py,README.md,fixtures/}` exist
- **AND** the file contents match what was previously at `skills/formio-resource-angular/evals/` with only path strings updated to reflect the new location

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

The sub-skill `formio-angular-resources` (`skills/formio-angular/resources/SKILL.md`) frontmatter `description` SHALL claim ONLY framework-explicit Angular-extension triggers. The description MUST include at least:

- "add an Angular module for X"
- "regenerate the Angular X resource module"
- "in my Angular app, wire Y to Z"
- "fix the Angular <component> component"
- Invocation from `formio-angular` via handoff context.

The description MUST drop all plain-language "also track X" / "add Y to the app" triggers (those now belong to `formio-application`'s modify-existing branch). The description MUST NOT contain generic phrases like "also track", "also let", "add a way to see", "each X should have a list of Y", or "let users do Z".

The description MUST include a `Not for:` clause pointing at `formio-application` for generic extend-an-app requests.

#### Scenario: Sub-skill only fires on Angular-explicit extension phrasing

- **WHEN** the user says "add an Angular module for Participant in my Event app"
- **THEN** the `formio-angular-resources` sub-skill activates

#### Scenario: Sub-skill does not fire on generic extend phrasing

- **WHEN** the user says "also track attendees for each event" (no mention of Angular)
- **THEN** `formio-angular-resources` does NOT activate
- **AND** `formio-application` activates instead

### Requirement: Parent skill orchestration order

The parent `formio-angular` `SKILL.md` SHALL instruct Claude to execute the following phases in the following strict order, with a user-approval gate between each:

1. **SETUP** — capture the Form.io `Project URL` and `Base URL` via interview, UNLESS they were already captured by `formio-application`'s Deployment step and handed in as context. When handed in, the skill SHALL confirm the values with the user in one short acknowledgement and proceed without re-interviewing.
2. **CONFIG** — generate `src/app/config.ts` exporting `AppConfig: FormioAppConfig` with `appUrl` = project URL and `apiUrl` = base URL, and wire it into `AppModule` via `{ provide: FormioAppConfig, useValue: AppConfig }`. Match the pattern at `https://github.com/formio/angular-demo/blob/master/src/app/config.ts` and `https://github.com/formio/angular-demo/blob/master/src/app/app-module.ts`.
3. **AUTH** — generate `src/app/auth/auth.module.ts` configuring `FormioAuthConfig` from the `template.json` auth resources and roles. Import `AuthModule` into `AppModule`.
4. **Resources** — delegate to the `formio-angular-resources` sub-skill with the accumulated context.

The skill SHALL NOT run an Inference phase (planner handoff). Planner invocation is `formio-application`'s responsibility. When `formio-angular` is invoked directly by a user (framework-explicit trigger), the skill SHALL expect an already-approved `template.json` and a workspace ready for file generation; if neither exists, it SHALL ask the user to invoke `formio-application` first rather than running the planner itself.

The skill SHALL NOT run an Import phase. Template import into a Form.io project is `formio-application`'s responsibility.

#### Scenario: Parent accepts handoff from formio-application

- **WHEN** `formio-application` invokes `formio-angular` after completing its Deployment and Import steps
- **THEN** `formio-angular` SHALL skip its SETUP interview
- **AND** confirm the handed-in URLs with a short acknowledgement
- **AND** proceed to CONFIG

#### Scenario: Parent rejects invocation without upstream plan

- **WHEN** the user invokes `formio-angular` directly with a framework-explicit request and no `template.json` is in scope
- **THEN** `formio-angular` SHALL point the user at `formio-application` rather than running the planner itself

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

- If `src/app/config.ts` already exports a `FormioAppConfig` with `appUrl` and `apiUrl` matching the SETUP values, skip the CONFIG phase.
- If `AppModule` already imports an `AuthModule` that configures `FormioAuthConfig`, skip the AUTH phase (but still offer to regenerate if the user asks).
- If neither condition holds, run the phase as normal.

When a phase is skipped, Claude MUST tell the user which phase was skipped and why (which existing file or import triggered the skip), so the user can override if needed.

#### Scenario: Existing config is detected and CONFIG phase is skipped

- **WHEN** the parent skill activates on a workspace whose `src/app/config.ts` already exports a `FormioAppConfig` with `appUrl: 'https://example.form.io'` and `apiUrl: 'https://api.form.io'`
- **AND** the SETUP interview returns those same URLs
- **THEN** Claude notifies the user that CONFIG is being skipped because `src/app/config.ts` already matches
- **AND** Claude proceeds directly to the AUTH phase

### Requirement: Planner handoff

The parent `formio-angular` skill SHALL treat the `formio-resource-planner` skill as its upstream input producer. When the planner finishes and has an approved Resource Map plus `template.json`, its recommended next step MUST name `formio-angular` as the next skill to run.

The parent `formio-angular` skill's interview MUST begin by asking whether a `template.json` from the planner is available, and if not, whether to run the planner first.

#### Scenario: Planner recommends parent skill on completion

- **WHEN** the `formio-resource-planner` skill completes Phase B and emits its "next steps" guidance
- **THEN** the guidance names `formio-angular` as the skill to run next
- **AND** the guidance does not name `formio-resource-angular`

### Requirement: Documentation and cross-references reflect the new layout

`CLAUDE.md` SHALL, in its "Iterating on skills" section, name `formio-resource-planner` and `formio-angular` as the two skills that ship eval harnesses, with the resource sub-skill located at `skills/formio-angular/resources/`. Any reference to `formio-resource-angular` by name SHALL be updated to `formio-angular` or `formio-angular-resources` (whichever scope the reference intends) in `CLAUDE.md` and in any skill cross-links inside the skills library (notably `skills/formio-resource-planner/evals/README.md`).

Eval artifact paths MUST be renamed from `.eval-artifacts/formio-resource-angular/` to `.eval-artifacts/formio-angular-resources/` in `skills/formio-angular/resources/evals/{grade.py,README.md,evals.json}`.

#### Scenario: No stale skill-name references remain

- **WHEN** the repository is searched for the literal string `formio-resource-angular` after the change is applied
- **THEN** no matches are found outside of (a) this change's own artifacts under `openspec/changes/restructure-formio-angular-skill/` and (b) the archived version of this change
