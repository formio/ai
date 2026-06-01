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

The parent `formio-angular` `SKILL.md` frontmatter `description` SHALL be the library's default "build me an app" skill and MUST trigger on plain-language domain descriptions that do NOT assume the user knows Form.io, Angular, or any framework terminology. Example triggers the description MUST claim include:

- Verbs: "build", "create", "make", "spin up", "set up", "stand up", "I need"
- Domain phrasings: "tool to track …", "app to manage …", "system to handle …", "portal for …"
- Bare domain archetypes: "task manager", "event signup", "inventory tracker", "help desk", "CRM", "booking system", "member directory"

The description MUST explicitly state that the user is NOT expected to say "Form.io", "Angular", "resource", "module", or "CRUD"; the skill infers those primitives on the user's behalf. Until another UI-framework skill joins this library, the description MUST state that this skill is the default and that lack of an explicit framework in the user's request should NOT block activation — Angular is the default framework.

The description MUST include an explicit negative-trigger clause pointing at the sub-skill `formio-angular-resources` for "add a feature to an already-running app" requests.

The description MUST trigger even when the user does not say "Form.io" or "Angular", provided they describe an app they want built.

#### Scenario: Parent claims plain-language "build me an app" phrasing

- **WHEN** the user says "build me a tool to track maintenance requests for my team" (no mention of Form.io, Angular, CRUD, or resources)
- **THEN** the `formio-angular` skill activates
- **AND** the `formio-angular-resources` sub-skill does not activate

#### Scenario: Parent claims bare domain archetypes

- **WHEN** the user says "I need a simple CRM for my consulting practice" or "make me a booking system"
- **THEN** the `formio-angular` skill activates
- **AND** the skill does not pause to ask which UI framework to use (Angular is the default)

#### Scenario: Negative trigger points at sub-skill

- **WHEN** the `formio-angular` `SKILL.md` frontmatter is inspected
- **THEN** its `description` contains the literal substring `formio-angular-resources`
- **AND** it contains a "Not for:" clause pointing at that sub-skill for extend-an-existing-app requests

### Requirement: Sub-skill description and trigger surface

The sub-skill `formio-angular-resources` (`skills/formio-angular/resources/SKILL.md`) frontmatter `description` SHALL trigger on plain-language requests to EXTEND an app that is already running — in language that does NOT require the user to know Form.io, Angular, or any framework terminology. Example triggers the description MUST claim include:

- "also track X", "also store X alongside Y"
- "add a way to see / submit / upload X"
- "each X should have a list of Y"
- "let users do Z", "let admins tag users", "let customers leave reviews"
- "fix the X page / screen", "regenerate the X part of the app"

The description MUST explicitly state that the user is NOT expected to say "resource", "module", "join", "child route", "ViewComponent", or any other framework term.

The description MUST include a negative-trigger clause pointing at the parent `formio-angular` for initial app creation or for any case where `FormioAppConfig` is not yet wired into `AppModule`.

The sub-skill description MUST NOT claim initial build-an-app phrasings such as "build me an app", "build an app from zero", "build me a tool", or "stand up an app".

#### Scenario: Sub-skill claims plain-language extend-the-app phrases

- **WHEN** the user says "also let customers leave reviews on products" in a workspace that already has `FormioAppConfig` wired
- **THEN** the `formio-angular-resources` sub-skill activates

#### Scenario: Sub-skill rejects initial build-an-app phrasings

- **WHEN** the user says "build me an app to manage maintenance requests" (no existing workspace)
- **THEN** the `formio-angular-resources` sub-skill does not activate
- **AND** the `formio-angular` parent skill activates

### Requirement: Parent skill orchestration order

The parent `formio-angular` `SKILL.md` SHALL instruct Claude to execute four phases in the following strict order, with a user-approval gate between each:

1. **SETUP** — interview the user for the Form.io `Project URL` (project URL) and `Base URL` (base URL) if they are not already derivable from context.
2. **CONFIG** — generate `src/app/config.ts` exporting `AppConfig: FormioAppConfig` with `appUrl` = project URL and `apiUrl` = base URL, and wire it into `AppModule` via `{ provide: FormioAppConfig, useValue: AppConfig }`. Match the pattern at `https://github.com/formio/angular-demo/blob/master/src/app/config.ts` and `https://github.com/formio/angular-demo/blob/master/src/app/app-module.ts`.
3. **AUTH** — generate `src/app/auth/auth.module.ts` configuring `FormioAuthConfig` from the `template.json` auth resources (user resource name, login form, register form) and roles. Import the `AuthModule` into `AppModule`. Match the pattern at `https://github.com/formio/angular-demo/blob/master/src/app/auth/auth.module.ts` and `https://github.com/formio/angular-demo/blob/master/src/app/app-module.ts`.
4. **Resources** — delegate to the `formio-angular-resources` sub-skill, passing the already-collected context (workspace path, `AppConfig` values, auth-module contents, planner `template.json`).

Each phase MUST end with an approval gate: Claude prints a preview of what it is about to write and waits for explicit user approval before writing files or proceeding to the next phase.

If the user cancels or does not approve at any gate, Claude MUST stop without writing files for that phase or any subsequent phase.

#### Scenario: Parent enforces phase order

- **WHEN** the `formio-angular` skill activates on a fresh workspace with a `template.json` in hand
- **THEN** Claude runs the SETUP interview before generating any files
- **AND** Claude writes `config.ts` only after SETUP approval
- **AND** Claude writes the auth module only after CONFIG approval
- **AND** Claude invokes the `formio-angular-resources` sub-skill only after AUTH approval

#### Scenario: User bails at CONFIG gate

- **WHEN** Claude previews `config.ts` at the CONFIG gate and the user declines
- **THEN** Claude does not write `config.ts`
- **AND** Claude does not proceed to AUTH
- **AND** no resource modules are generated

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
