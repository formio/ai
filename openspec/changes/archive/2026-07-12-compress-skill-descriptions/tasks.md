# Tasks: compress skill descriptions

## 1. Budget and collision tests
<!-- depends_on: none -->

### Red

- [x] 1.1 Write failing budget tests in `packages/skill-tests/src/skill-descriptions/description-budget.test.ts`: scan every top-level `plugin/skills/*/SKILL.md` (exclude nested sub-skill files), parse frontmatter, assert each description's whitespace-normalized length ≤ 1,024 chars (failure message names skill + measured length) and that every description contains `Not for`; assert no description contains fenced/inline shell commands or numbered phase narration (e.g., no `npx `, no `(1) ` step markers)
- [x] 1.2 Write failing collision guards in `packages/skill-tests/src/skill-descriptions/collision-guards.test.ts` (backtick-delimited name matching where `formio-form`/`formio-form-builder` could be confused): planner description has no "build me"/"build a <archetype>" claim and names `` `formio-application` `` in `Not for:`; form description's trigger clause pairs no build/create verb with form/wizard/survey nouns while retaining `conditional wizard`; schema description carries no blanket trigger-without-Form.io claim; actions and auth descriptions each name the other in `Not for:`

### Green

- [x] 1.3 Rewrite the six oversized descriptions to ≤ 1,024 chars using the compact clause contract (capability sentence, quoted trigger phrases, optional boundary, compact `Not for:`), preserving every test/validator-asserted substring listed in design Context: `formio-angular` (strip the five-phase narration; keep Angular-explicit rule, example phrases, all sibling names), `formio-sdk` (method inventory → categories + representative names; keep the five sibling names for `validateFormioSdkSkill`), `formio-resource-planner` (planning verbs only; add `Not for:` `` `formio-application` ``; drop the "trigger even if they describe an app" rule; keep `` `formio-form-builder` `` and `formio-auth` pointers), `formio-schema` (scope nouns to JSON contexts; keep `components`/`wizard`/`textfield`/`datagrid` and the four `Not for:` names; keep the no-`formio-form`-substring rule), `formio-auth` (deduplicate capability/trigger lists; add `` `formio-actions` `` to `Not for:`), `formio-application` (drop the framework-pick explanation; keep example triggers, all six `Not for:` pointers, `.mcp.json` and restart mentions)
- [x] 1.4 Trim the remaining descriptions under budget and fix the last collisions: `formio-form` (≤ 1,024; reword "build a conditional wizard" to embed-verb phrasing retaining `conditional wizard`; keep all six `Not for:` names), `formio-form-builder` (≤ 1,024; keep every substring its structural suite asserts — trigger phrases, `build a form to collect` boundary, webform/wizard/PDF, five backticked `Not for:` names), `formio-api` (≤ 1,024; keep `use when` + `not for:` naming `formio-application` and `formio-resource-planner` for `validateRouterDescriptionTriggers`), `formio-actions` (append the `Not for:` `` `formio-auth` `` clause, staying under budget)

### Refactor

- [x] 1.5 Review implementation and refactor as needed

## 2. Definition of Done
<!-- depends_on: 1 -->

### Red

- [x] 2.1 Run the full suite (`pnpm test`) and capture failures — the new `skill-descriptions` suite AND every pre-existing structural suite/validator (`formio-form-builder`, `formio-form`, `formio-sdk` validators, `formio-api` router validators, plugin-build tests) must pass with no assertion weakened

### Green

- [x] 2.2 Fix any failures; rebuild the plugin (`pnpm build:plugin`) so the bundle carries the compressed descriptions; then `pnpm test`, `pnpm lint`, and `pnpm format` all pass clean

### Refactor

- [x] 2.3 Review implementation and refactor as needed
