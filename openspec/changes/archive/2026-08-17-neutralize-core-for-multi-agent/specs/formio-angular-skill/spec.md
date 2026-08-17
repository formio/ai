## MODIFIED Requirements

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
