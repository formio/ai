## 1. Relocate resource skill under new parent
<!-- depends_on: none -->

### Red

- [x] 1.1 Write failing test: repository assertion confirms `skills/formio-angular/resources/SKILL.md` exists and `skills/formio-resource-angular/` does not (covers scenarios "Parent skill files exist" and "Sub-skill eval harness is relocated intact" in `specs/formio-angular-skill/spec.md`). Place under `packages/mcp-server/src/__tests__/skills-layout.test.ts` or equivalent repo-structure test file.
- [x] 1.2 Write failing test: assertion confirms `.claude/skills/formio-angular` resolves (via `fs.readlink` or `fs.realpathSync`) to `skills/formio-angular/` and `.claude/skills/formio-resource-angular` does not exist.
- [x] 1.3 Write failing test: assertion confirms `skills/formio-angular/resources/evals/{evals.json,grade.py,README.md,fixtures/}` all exist.

### Green

- [x] 1.4 Move `skills/formio-resource-angular/SKILL.md` to `skills/formio-angular/resources/SKILL.md`. Move `skills/formio-resource-angular/{references,assets,evals}/` to `skills/formio-angular/resources/{references,assets,evals}/`. Remove the now-empty `skills/formio-resource-angular/` directory.
- [x] 1.5 Remove the `.claude/skills/formio-resource-angular` symlink. Create `.claude/skills/formio-angular` as a symlink to `../../skills/formio-angular` to match the pattern used by `.claude/skills/formio-resource-angular` before the change.

### Refactor

- [x] 1.6 Review implementation and refactor as needed

## 2. Update sub-skill frontmatter and trigger surface
<!-- depends_on: 1 -->

### Red

- [x] 2.1 Write failing test: `skills/formio-angular/resources/SKILL.md` frontmatter `name` equals `formio-angular-resources` (scenario "Sub-skill claims resource-only phrases" indirectly — parsing the frontmatter is the prerequisite).
- [x] 2.2 Write failing test: `skills/formio-angular/resources/SKILL.md` frontmatter `description` does NOT contain any of the literal strings `build the Angular app`, `scaffold the UI`, `generate the CRUD`, `wire the Angular side` (covers scenario "Sub-skill rejects top-level phrases").
- [x] 2.3 Write failing test: `skills/formio-angular/resources/SKILL.md` frontmatter `description` contains a `Not for:` clause that names the parent skill `formio-angular`.

### Green

- [x] 2.4 Invoke the `skill-creator` skill in "modify existing skill" mode on `skills/formio-angular/resources/SKILL.md` to: change frontmatter `name` from `formio-resource-angular` to `formio-angular-resources`; rewrite the `description` so it (a) focuses on "add/regenerate/repair a resource module in an already-configured app" trigger language, (b) drops the top-level "build the Angular app" phrasing, and (c) includes a negative-trigger clause pointing at parent `formio-angular`. Leave the body of the file otherwise unchanged. Do NOT hand-roll the frontmatter — `skill-creator` owns the repo's skill-authoring standard.

### Refactor

- [x] 2.5 Review implementation and refactor as needed

## 3. Author parent SKILL.md with orchestration and triggers
<!-- depends_on: 2 -->

### Red

- [x] 3.1 Write failing test: `skills/formio-angular/SKILL.md` exists and has frontmatter `name: formio-angular` with a non-empty `description`.
- [x] 3.2 Write failing test: the parent `description` contains the literal substring `formio-angular-resources` and a "Not for:" clause naming the sub-skill (covers scenario "Negative trigger points at sub-skill").
- [x] 3.3 Write failing test: the parent `description` claims the top-level phrases `build the Angular app`, `scaffold the UI`, `generate the CRUD`, `wire the Angular side` (covers scenario "Parent claims the top-level Angular-app phrases").
- [x] 3.4 Write failing test: the parent `SKILL.md` body contains section headers or equivalent orchestrated-phase markers for `SETUP`, `CONFIG`, `AUTH`, and a handoff step to `formio-angular-resources`, and the phases appear in that order in the file (covers scenario "Parent enforces phase order").

### Green

- [x] 3.5 Invoke the `skill-creator` skill in "create new skill" mode to author `skills/formio-angular/SKILL.md`. Feed it the trigger-surface requirements from design.md → Decisions → "Trigger-surface split" and the orchestration-order requirements from `specs/formio-angular-skill/spec.md` → "Parent skill orchestration order". The resulting `SKILL.md` body must: (a) summarize the parent's role as the entry point for Angular+Form.io app scaffolding, (b) list the four phases SETUP → CONFIG → AUTH → Resources with approval gates between each, (c) reference the sibling documents `SETUP.md`, `CONFIG.md`, `AUTH.md` by relative link and the sub-skill `resources/SKILL.md`, and (d) contain the "Not for:" clause naming `formio-angular-resources`. Do NOT hand-roll the skill — `skill-creator` owns the repo's skill-authoring standard.
- [x] 3.6 Run `skill-creator`'s description-optimization / variance pass on the new parent `description` to confirm the trigger clauses survive across phrasings of "build an Angular app for this Form.io plan" before the sibling docs are authored.

### Refactor

- [x] 3.7 Review implementation and refactor as needed

## 4. Author SETUP.md interview script
<!-- depends_on: 3 -->

### Red

- [x] 4.1 Write failing test: `skills/formio-angular/SETUP.md` exists, has NO YAML frontmatter (first line is not `---`), and documents an interview that captures both `Project URL` and `Base URL`.
- [x] 4.2 Write failing test: `SETUP.md` explicitly names `FORMIO_PROJECT_URL` for the project URL and `FORMIO_BASE_URL` for the base URL (per CLAUDE.md terminology rule: `projectUrl` → `FORMIO_PROJECT_URL`, `baseUrl` → `FORMIO_BASE_URL`).
- [x] 4.3 Write failing test: `SETUP.md` instructs Claude to batch the URL questions into a single `AskUserQuestion` call, not pepper the user with separate prompts.

### Green

- [x] 4.4 Write `skills/formio-angular/SETUP.md` as a plain markdown reference document (no frontmatter) covering: (a) when to skip the interview (values already in workspace / provided by the user), (b) the batched `AskUserQuestion` specifying both URLs with example values, (c) how to validate the URLs (trailing slash handling, HTTPS, reachability is NOT required), (d) where to stash the captured values so CONFIG.md can pick them up.

### Refactor

- [x] 4.5 Review implementation and refactor as needed

## 5. Author CONFIG.md app-config generation
<!-- depends_on: 3 -->

### Red

- [x] 5.1 Write failing test: `skills/formio-angular/CONFIG.md` exists and has no frontmatter.
- [x] 5.2 Write failing test: `CONFIG.md` references the external URLs `https://help.form.io/developers/introduction/application`, `https://github.com/formio/angular-demo/blob/master/src/app/config.ts`, and `https://github.com/formio/angular-demo/blob/master/src/app/app.module.ts`.
- [x] 5.3 Write failing test: `CONFIG.md` contains a code template for `src/app/config.ts` that (a) exports a symbol named `AppConfig`, (b) uses the `FormioAppConfig` type from `@formio/angular`, (c) has `appUrl` and `apiUrl` placeholders populated from the SETUP values.
- [x] 5.4 Write failing test: `CONFIG.md` contains guidance for editing `src/app/app.module.ts` to add the `{ provide: FormioAppConfig, useValue: AppConfig }` provider and import `FormioModule` from `@formio/angular`.
- [x] 5.5 Write failing test: `CONFIG.md` describes the approval-gate behavior — preview then wait for approval before writing (covers scenario "User bails at CONFIG gate", partial; the preview/approval wording must be present).
- [x] 5.6 Write failing test: `CONFIG.md` describes the "skip if already wired" detection logic (covers scenario "Existing config is detected and CONFIG phase is skipped").

### Green

- [x] 5.7 Write `skills/formio-angular/CONFIG.md` covering: the three external reference URLs, the `config.ts` code template with placeholders for SETUP values, the `AppModule` edit instructions, the preview-then-approve gate wording, and the existing-config detection logic.

### Refactor

- [x] 5.8 Review implementation and refactor as needed

## 6. Author AUTH.md auth-module generation
<!-- depends_on: 3, 5 -->

### Red

- [x] 6.1 Write failing test: `skills/formio-angular/AUTH.md` exists and has no frontmatter.
- [x] 6.2 Write failing test: `AUTH.md` references the external URLs `https://help.form.io/developers/introduction/application#user-authentication`, `https://github.com/formio/angular-demo/blob/master/src/app/auth/auth.module.ts`, and `https://github.com/formio/angular-demo/blob/master/src/app/app.module.ts#L71`.
- [x] 6.3 Write failing test: `AUTH.md` instructs Claude how to derive the auth configuration from a `formio-resource-planner` `template.json` — specifically extracting the user resource, login form name, register form name, and role list (covers scenario "AUTH derived from template.json").
- [x] 6.4 Write failing test: `AUTH.md` contains a code template for `src/app/auth/auth.module.ts` that uses `FormioAuthConfig` from `@formio/angular/auth`.
- [x] 6.5 Write failing test: `AUTH.md` documents the "no `template.json` available" branch — offer to run the planner or skip AUTH with a TODO comment pointing at `formio-api/references/runtime-auth` and `formio-api/references/platform-auth` (covers scenario "No template.json — user chooses to skip AUTH").
- [x] 6.6 Write failing test: `AUTH.md` describes the approval-gate preview wording and the "skip if AuthModule already wired" detection logic.

### Green

- [x] 6.7 Write `skills/formio-angular/AUTH.md` covering: the three external reference URLs, the `template.json` extraction rules (user resource, login form, register form, roles), the `auth.module.ts` code template, the `AppModule` edit to import `AuthModule`, the "no template.json" fallback with the TODO comment, the preview-then-approve gate wording, and the existing-auth detection logic.

### Refactor

- [x] 6.8 Review implementation and refactor as needed

## 7. Rename eval-artifact paths
<!-- depends_on: 1 -->

### Red

- [x] 7.1 Write failing test: `grep -rn "formio-resource-angular" skills/formio-angular/resources/evals/` returns zero matches.
- [x] 7.2 Write failing test: `skills/formio-angular/resources/evals/grade.py` references the path `.eval-artifacts/formio-angular-resources/` (or an equivalent constant) for its iteration directory.

### Green

- [x] 7.3 Rename the path prefix in `skills/formio-angular/resources/evals/grade.py`, `skills/formio-angular/resources/evals/README.md`, and `skills/formio-angular/resources/evals/evals.json` from `formio-resource-angular` to `formio-angular-resources` (for `.eval-artifacts/` paths) and from `formio-resource-angular` to `formio-angular` (for skill-name references like "when iterating on `formio-resource-angular`, do X" → "when iterating on `formio-angular`, do X"; keep scope accurate — if the reference is specifically about the resource sub-skill, use `formio-angular-resources`).

### Refactor

- [x] 7.4 Review implementation and refactor as needed

## 8. Update CLAUDE.md and cross-skill references
<!-- depends_on: 1, 2, 3 -->

### Red

- [x] 8.1 Write failing test: `grep -n "formio-resource-angular" CLAUDE.md` returns zero matches.
- [x] 8.2 Write failing test: `CLAUDE.md` "Iterating on skills" section names `formio-angular` (and notes the resource sub-skill at `skills/formio-angular/resources/`).
- [x] 8.3 Write failing test: `grep -rln "formio-resource-angular" skills/formio-resource-planner/` returns zero matches.
- [x] 8.4 Write failing test: repo-wide `grep -rln "formio-resource-angular"` returns matches ONLY under `openspec/changes/restructure-formio-angular-skill/` and (if applicable) `openspec/changes/archive/` (covers scenario "No stale skill-name references remain").

### Green

- [x] 8.5 Update `CLAUDE.md` — in the "Iterating on skills" section, replace the "Skills currently using this pattern: `formio-resource-planner` and `formio-resource-angular`" sentence to name `formio-angular` instead, and add a parenthetical noting the resource sub-skill location.
- [x] 8.6 Update `skills/formio-resource-planner/evals/README.md` to replace any `formio-resource-angular` references with `formio-angular` (or `formio-angular-resources` when the scope is the sub-skill specifically).
- [x] 8.7 Update `skills/formio-resource-planner/SKILL.md` — if its body recommends `formio-resource-angular` as the next step after Phase B, replace with `formio-angular` (covers scenario "Planner recommends parent skill on completion").

### Refactor

- [x] 8.8 Review implementation and refactor as needed

## 9. Verify end-to-end via Definition of Done
<!-- depends_on: 1, 2, 3, 4, 5, 6, 7, 8 -->

### Red

- [x] 9.1 Write failing test (if not already covered by prior groups): an integration-style assertion that loads every `SKILL.md` under `skills/formio-angular/` (both parent and `resources/`) and verifies each parses as valid YAML frontmatter + body. This test is the canary that proves the skill loader will accept both files.

### Green

- [x] 9.2 Run `skill-creator`'s skill-benchmark / variance-analysis pass across both `skills/formio-angular/SKILL.md` (parent) and `skills/formio-angular/resources/SKILL.md` (sub-skill) to confirm the trigger surfaces do not collide — "build the Angular app" consistently routes to parent, "add a Participant resource module" consistently routes to sub-skill.
- [x] 9.3 Run `pnpm test` — all Vitest tests pass, including the new layout/frontmatter/path tests from groups 1–8.
- [x] 9.4 Run `pnpm lint` — no TypeScript errors.
- [x] 9.5 Run `pnpm format` — code is formatted.
- [x] 9.6 Run the `formio-angular-resources` eval harness once under its new path (`skills/formio-angular/resources/evals/README.md` steps) to confirm the harness still produces `grading.json` under `.eval-artifacts/formio-angular-resources/iteration-N/` and pass rates match the baseline from before the move.

### Refactor

- [x] 9.7 Review implementation and refactor as needed
