## 1. Planner eval baseline

<!-- depends_on: none -->

### Red

- [x] 1.1 Run the planner harness's existing cases on the base commit (before any planner edit) and record the pass rate in `design.md`

### Green

- [x] 1.2 Confirm the recorded baseline names every case and its pass/fail

### Refactor

- [x] 1.3 Review implementation and refactor as needed

## 2. project_tag_list

<!-- depends_on: none -->

### Red

- [x] 2.1 Write failing tests: lists `current` from the project's `tag` and tags from `GET /tag` newest first, without templates; `0.0.0` with no tags reports no current tag
- [x] 2.2 Write failing tests: `compare: true` exports the project, fetches the current tag's template, and reports added / removed / changed entities by machine name, ignoring `_id`, `created`, `modified`, `owner`, `project`, `_vid`; no current tag reports nothing to compare
- [x] 2.3 Write failing test: the tool is annotated read-only

### Green

- [x] 2.4 Implement the tool, its output schema, and a pure template comparison module

### Refactor

- [x] 2.5 Review implementation and refactor as needed

## 3. project_tag_create

<!-- depends_on: none -->

### Red

- [x] 3.1 Write failing tests: posts `{tag, description}` to `{projectUrl}/tag`; returns name, description, created without the template; non-semver or over-length names and over-length descriptions return `INVALID_ARGUMENT` with no request; a duplicate name returns `VALIDATION_FAILED` naming it

### Green

- [x] 3.2 Implement the tool and annotation

### Refactor

- [x] 3.3 Review implementation and refactor as needed

## 4. project_export tag argument and project_import description

<!-- depends_on: none -->

### Red

- [x] 4.1 Write failing tests: `project_export` with `tag` resolves the id from `GET /tag` and returns `GET /tag/:id`'s `template`; an unknown name returns `NOT_FOUND` naming it; without `tag` it behaves as today
- [x] 4.2 Write failing tests: `project_import`'s description states what the import replaces and that it is for a first build, and does not say it merges without replacing; `project_export`'s description names `tag`

### Green

- [x] 4.3 Implement the argument and both descriptions
- [x] 4.4 Confirm the tool-description budget test passes with the new tools

### Refactor

- [x] 4.5 Review implementation and refactor as needed

## 5. Planner change mode

<!-- depends_on: 1 -->

### Red

- [x] 5.1 Write failing tests: the planner documents change mode in `references/change-plan.md` (baseline input, Phase A marking, dated `template.md` section, `changes.json` shape with `updates`, no top-level `access`, references by baseline machine name, no unchanged entity, no import template)
- [x] 5.2 Add change-mode cases with baseline fixtures to the planner harness (`evals.json`, `fixtures/`) and their assertions to `grade.py`

### Green

- [x] 5.3 Write `references/change-plan.md` and link it from the planner's `SKILL.md`
- [x] 5.4 Run the change-mode cases and the existing cases; record both in `design.md`; the existing cases score at or above the baseline

### Refactor

- [x] 5.5 Review implementation and refactor as needed

## 6. formio-application: source of truth, change flow, versioning

<!-- depends_on: 2, 3, 4, 5 -->

### Red

- [x] 6.1 Write failing tests: `INTENT.md`, `IMPORT.md`, `SKILL.md` contain no "additive" claim and no modify-existing import; `SKILL.md` links `CHANGE.md`; `IMPORT.md`'s preview states what the import replaces and that it is for a first build
- [x] 6.2 Write failing tests: `CHANGE.md` runs `project_tag_list` with `compare: true` before planning and offers a patch or baseline tag; applies roles → resources → forms → actions with the granular tools behind one gate; stops and reports on failure
- [x] 6.3 Write failing tests: each branch finishes by proposing a semver tag and description, asking, then `project_tag_create` and `project_export` `tag` over `template.json`; deploying to another stage is named as work outside the agent; no skill edits or re-imports `template.json`
- [x] 6.4 Write failing test: `FRAMEWORK.md`'s modify-existing handoff names `changesJsonPath` and no delta `templateJsonPath`; the extend sub-skills read new resource shapes from it

### Green

- [x] 6.5 Write `CHANGE.md`; edit `SKILL.md`, `INTENT.md`, `IMPORT.md`, `FRAMEWORK.md`, and the two resources sub-skills' handoff reading

### Refactor

- [x] 6.6 Review implementation and refactor as needed

## 7. Library-wide text

<!-- depends_on: 2, 3 -->

### Red

- [x] 7.1 Update `preflight-writing-tools.test.ts` to include `project_tag_create` (fails until every copy names it); the router-tool-list source-fact test already fails for the new tools
- [x] 7.2 Write failing tests: `platform-staging.md` has no `409`, documents `type: 'tag'` deploy, `tag/current`, family-wide tags, and names the version tools

### Green

- [x] 7.3 Add `project_tag_create` to every copy of the shared preflight's list of writing tools; add the new tools to `formio-api/SKILL.md`'s list; correct `platform-staging.md`
- [x] 7.4 Update the READMEs' tool lists and `CLAUDE.md`

### Refactor

- [x] 7.5 Review implementation and refactor as needed

## 8. Release and Definition of Done

<!-- depends_on: 1, 2, 3, 4, 5, 6, 7 -->

### Red

- [x] 8.1 Run the routing eval if any description changed; no prompt that passed before fails

### Green

- [x] 8.2 Add `.changeset/version-projects-with-tags.md` (`'@formio/mcp': minor`, `'@formio/ai': minor`)
- [x] 8.3 Run `pnpm test`, `pnpm lint`, `pnpm format`, `pnpm check:releases`, and `openspec validate version-projects-with-tags --strict`; all pass

### Refactor

- [x] 8.4 Review implementation and refactor as needed
