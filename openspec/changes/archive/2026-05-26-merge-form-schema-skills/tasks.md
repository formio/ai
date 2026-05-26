## 1. Restructure `formio-schema` references into domain subdirectories
<!-- depends_on: none -->

### Red

- [x] 1.1 Add failing Vitest test under `packages/mcp-server/src/__tests__/formio-schema-layout.test.ts` asserting `plugin/skills/formio-schema/references/` contains exactly the subdirectories `form/`, `submission/`, `project/` (no `action/` or `role/`) and no `.md` files at its top level
- [x] 1.2 Add failing test in the same file asserting `plugin/skills/formio-schema/references/form/` contains `form-definition.md`, `base-component.md`, `input-components.md`, `layout-components.md`, `data-components.md` and each is non-empty
- [x] 1.3 Add failing test asserting each of `references/submission/README.md` and `references/project/README.md` exists, is non-empty, contains the phrase "not yet authored", and names the corresponding `formio-api` reference (`runtime-submissions`, `platform-projects` respectively)

### Green

- [x] 1.4 Create `plugin/skills/formio-schema/references/form/` and move the existing five reference files into it (`git mv` so history is preserved)
- [x] 1.5 Create `plugin/skills/formio-schema/references/{submission,project}/README.md` placeholders that each describe the domain, state it is "not yet authored", and link to the corresponding `formio-api` reference. No `action/` or `role/` placeholders are created — those domains are out of scope for this skill

### Refactor

- [x] 1.6 Review implementation and refactor as needed

## 2. Update `formio-schema` SKILL.md to route across domains
<!-- depends_on: 1 -->

### Red

- [x] 2.1 Add failing test asserting `plugin/skills/formio-schema/SKILL.md` frontmatter `name` equals `formio-schema` and `description` mentions the words "submission" and "project" alongside "form"
- [x] 2.2 Add failing test asserting `formio-schema/SKILL.md` description contains a "Not for:" clause naming `formio-api`, `formio-actions`, `formio-resource-planner`, and `formio-application`, and contains zero occurrences of the string `formio-form`
- [x] 2.3 Add failing test asserting `formio-schema/SKILL.md` body references all five `references/form/*.md` paths and the two `references/<domain>/README.md` paths (submission, project)

### Green

- [x] 2.4 Rewrite `plugin/skills/formio-schema/SKILL.md`: broaden the frontmatter `description` per `design.md`, replace the single "Working on… / Load" table with a domain-grouped layout, and ensure every reference path in the body is under `references/<domain>/`

### Refactor

- [x] 2.5 Review implementation and refactor as needed

## 3. Merge `formio-form` content into `formio-schema/references/form/` and delete the skill
<!-- depends_on: 1, 2 -->

### Red

- [x] 3.1 Add failing test asserting `plugin/skills/formio-form/` does not exist
- [x] 3.2 Add failing test asserting no file under `plugin/skills/` (excluding archive paths under `openspec/`) contains the substring `formio-form`

### Green

- [x] 3.3 Diff `plugin/skills/formio-form/SKILL.md` against the merged `plugin/skills/formio-schema/references/form/*.md` files. For every property table row, component sub-section, or callout that exists in `formio-form` but is missing from the corresponding `formio-schema` reference, port the missing content into the appropriate `references/form/*.md` file
- [x] 3.4 Delete `plugin/skills/formio-form/` entirely (`git rm -r`)
- [x] 3.5 Update `plugin/skills/formio-api/SKILL.md` negative-trigger clause and `plugin/skills/formio-api/references/project-forms.md` to reference `formio-schema` instead of `formio-form`
- [x] 3.6 Update `plugin/skills/formio-resource-planner/SKILL.md` to reference `formio-schema` (both occurrences) instead of `formio-form`
- [x] 3.7 Update `plugin/README.md` skill table: remove the `formio-form` row and keep only the `formio-schema` row, updating its description to reflect the broadened scope

### Refactor

- [x] 3.8 Review implementation and refactor as needed

## 4. Update MCP tool descriptions for `form_create` and `form_update`
<!-- depends_on: 3 -->

### Red

- [x] 4.1 Update `packages/mcp-server/src/__tests__/form_create.test.ts` line 22 to assert `tool!.description` contains `formio-schema` and does NOT contain `formio-form` — this test should now fail against the current tool description
- [x] 4.2 Update `packages/mcp-server/src/__tests__/form_update.test.ts` line 27 to the same assertion — should fail against the current tool description

### Green

- [x] 4.3 Update `packages/mcp-server/src/tools/form_create.ts` tool description: replace `formio-form` with `formio-schema`
- [x] 4.4 Update `packages/mcp-server/src/tools/form_update.ts` tool description: replace `formio-form` with `formio-schema`

### Refactor

- [x] 4.5 Review implementation and refactor as needed

## 5. Update plugin packaging tests and smoke script
<!-- depends_on: 3 -->

### Red

- [x] 5.1 Update `packages/mcp-server/src/__tests__/plugin-build.test.ts` test `1.3` to assert the bundled `skills/` directory contains `formio-schema` and does NOT contain `formio-form`; rename the test title accordingly
- [x] 5.2 Update `plugin-build.test.ts` test `3.3` smoke-test assertion to match `formio-schema` instead of `formio-form`; rename the test title accordingly

### Green

- [x] 5.3 Update `scripts/test-plugin.ts` constant `REQUIRED_SKILL_DIRS` from `['formio-api', 'formio-form']` to `['formio-api', 'formio-schema']`

### Refactor

- [x] 5.4 Review implementation and refactor as needed

## 6. Verify Definition of Done
<!-- depends_on: 1, 2, 3, 4, 5 -->

### Red

- [x] 6.1 (No new tests — verification step only)

### Green

- [x] 6.2 Run `pnpm test` and confirm all suites pass
- [x] 6.3 Run `pnpm lint` (typecheck) and confirm zero errors
- [x] 6.4 Run `pnpm format` and confirm the working tree stays clean

### Refactor

- [x] 6.5 Review implementation and refactor as needed
