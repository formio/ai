## 1. Routing eval and baseline

<!-- depends_on: none -->

### Red

- [x] 1.1 Write a failing structure test: `packages/skill-tests/evals/skill-routing/` has `evals.json`, `grade.py`, `README.md`; every prompt names an expected skill that exists under `plugin/skills/` (or `none`); neither `grade.py` nor `README.md` contains any skill's description text

### Green

- [x] 1.2 Write `evals.json` covering every routing boundary in the `skill-routing-evals` spec, including the framework-named build with and without a plan, and the MCP login prompt
- [x] 1.3 Write `grade.py` and `README.md` following the planner harness's layout
- [x] 1.4 Run the eval on `main`'s skill text before any skill edit and record the baseline in `design.md`

### Refactor

- [x] 1.5 Review implementation and refactor as needed

## 2. Framework-named routing and registered names

<!-- depends_on: 1 -->

### Red

- [x] 2.1 Write failing tests: `formio-application`'s description claims a framework-named build with no plan and names no nested sub-skill; its routing table names none; `formio-angular` and `formio-react` hand a no-plan request to `formio-application` with the framework rather than telling the user to invoke it; the nested form sub-skills' descriptions name `formio-angular` / `formio-react`
- [x] 2.2 Invert `framework-registry.test.ts`'s nested-name check

### Green

- [x] 2.3 Edit `formio-application` (description, `SKILL.md` table), `formio-angular/SKILL.md`, `formio-react/SKILL.md`, and the two form sub-skill descriptions; keep each description within budget
- [x] 2.4 Re-snapshot `descriptions-before-preflight.json` with a reason for each changed entry

### Refactor

- [x] 2.5 Review implementation and refactor as needed

## 3. formio-mcp-setup login wording

<!-- depends_on: 1 -->

### Red

- [x] 3.1 Write failing test: the description does not route Form.io login to `formio-auth` and states the login opens on the first tool call

### Green

- [x] 3.2 Edit the description within budget; re-snapshot it with a reason

### Refactor

- [x] 3.3 Review implementation and refactor as needed

## 4. One handoff contract; workspace keeps its project

<!-- depends_on: none -->

### Red

- [x] 4.1 Write failing tests: no handoff payload in `formio-application`, the framework skills, or the resources sub-skills names `projectUrl`, `baseUrl`, `formioProjectUrl`, or `formioBaseUrl`; only `FRAMEWORK.md` lists handoff fields and the others link to it
- [x] 4.2 Write failing test: `formio-angular` re-checks `project_get` after BOOTSTRAP and records the SETUP-resolved Project URL with `project_set` when the workspace no longer resolves

### Green

- [x] 4.3 Write the contract table in `FRAMEWORK.md`; replace restated fields in `SKILL.md`, `INTENT.md`, `IMPORT.md`, `formio-angular/SKILL.md`, `formio-react/SKILL.md`, and both resources sub-skills with links
- [x] 4.4 Add the post-scaffold check to `formio-angular` (SETUP/BOOTSTRAP)

### Refactor

- [x] 4.5 Review implementation and refactor as needed

## 5. formio-auth runs once, after import

<!-- depends_on: none -->

### Red

- [x] 5.1 Write failing tests: the planner (`SKILL.md`, `interview-guide.md`, `template-md.md`) does not invoke `formio-auth` and lists it as a post-import next step; Step 3.5's trigger names RBAC tuning; `phase-b-emission.md` has no "future `formio-react`"

### Green

- [x] 5.2 Edit the planner files, `formio-application` Step 3.5, and `CLAUDE.md`

### Refactor

- [x] 5.3 Review implementation and refactor as needed

## 6. Registration saves to the user resource

<!-- depends_on: none -->

### Red

- [x] 6.1 Write failing tests: `formio-actions`' registration pattern updates the default Save's `settings.resource` to the user resource with a field map, adds Role Assignment only when needed, routes to the planner with no user resource; `login-forms.md` agrees; no "built-in, usually already present"

### Green

- [x] 6.2 Edit `formio-actions/SKILL.md` and `formio-auth/references/login-forms.md`

### Refactor

- [x] 6.3 Review implementation and refactor as needed

## 7. One writer for a saved form

<!-- depends_on: none -->

### Red

- [x] 7.1 Write failing tests: `formio-form`'s MCP Tool Preference routes saved-form edits to `formio-form-builder` and names no `authenticate` tool; `formio-schema/SKILL.md`'s body does not modify forms directly and routes to `formio-form-builder`

### Green

- [x] 7.2 Edit `formio-form/SKILL.md` and `formio-schema/SKILL.md` bodies

### Refactor

- [x] 7.3 Review implementation and refactor as needed

## 8. Installed paths

<!-- depends_on: 4 -->

### Red

- [x] 8.1 Add the failing check to `portable-layout.test.ts`: no markdown under `plugin/skills/` contains `plugin/skills/`

### Green

- [x] 8.2 Replace every occurrence with a path relative to its file; drop the prefix from the four banners

### Refactor

- [x] 8.3 Review implementation and refactor as needed

## 9. Contributor instructions move out of FRAMEWORK.md

<!-- depends_on: 4 -->

### Red

- [x] 9.1 Re-point `framework-registry.test.ts`: `CONTRIBUTING.md` carries the add-a-framework checklist with the Vue example; `FRAMEWORK.md` has no such section, no `npm test`, no `formio-vue`

### Green

- [x] 9.2 Move the section and contributor asides to `CONTRIBUTING.md`

### Refactor

- [x] 9.3 Review implementation and refactor as needed

## 10. Sub-skill gates

<!-- depends_on: none -->

### Red

- [x] 10.1 Write failing tests: `formio-angular-resources` round 1 asks no URL, has no new-workspace mode or `ng new`, routes to `formio-angular` without a wired workspace, and cites no retired orchestrator "Step 5"
- [x] 10.2 Write failing test: `formio-react/EXISTING.md` gates on Next.js and framework-mode React Router before the data-router gate and offers no conversion

### Green

- [x] 10.3 Edit `formio-angular-resources` (`SKILL.md`, `interview-guide.md`, `phase-a-plan-template.md`, `worked-example.md`)
- [x] 10.4 Add the rendering-mode gate to `formio-react/EXISTING.md`

### Refactor

- [x] 10.5 Review implementation and refactor as needed

## 11. Measure, release, and Definition of Done

<!-- depends_on: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10 -->

### Red

- [x] 11.1 Run the routing eval on the finished change; any prompt that passed on `main` and fails now is a failure to fix before continuing

### Green

- [x] 11.2 Record the result beside the baseline in `design.md`
- [x] 11.3 Add `.changeset/fix-skill-routing-and-contracts.md` (`'@formio/ai': patch`)
- [x] 11.4 Run `pnpm test`, `pnpm lint`, `pnpm format`, `pnpm check:releases`, and `openspec validate fix-skill-routing-and-contracts --strict`; all pass

### Refactor

- [x] 11.5 Review implementation and refactor as needed
