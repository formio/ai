## 1. Skill scaffold and structural checks
<!-- depends_on: none -->

### Red

- [x] 1.1 Write failing structural test `packages/skill-tests/src/formio-form/skill-structure.test.ts`: `plugin/skills/formio-form/SKILL.md` exists with frontmatter `name: formio-form` and non-empty `description`
- [x] 1.2 Extend structural test: all eleven reference docs (`setup.md`, `rendering.md`, `javascript-api.md`, `options.md`, `json-logic.md`, `field-logic.md`, `conditionals.md`, `calculated-values.md`, `validation.md`, `external-data.md`, `wizards.md`) exist under `references/`, are non-empty, and none starts with `---`
- [x] 1.3 Extend structural test: description three-clause template — capability clause names `@formio/js`; trigger clause contains `Use when the user asks to`; `Not for:` clause contains `formio-angular`, `formio-application`, `formio-resource-planner`, `formio-api`, `formio-sdk`
- [x] 1.4 Extend structural test: no `formio-form` doc contains a forbidden import (`from '@formio/core'`, `@formio/js/lib/` deep import, `require('@formio/js')`); `setup.md` contains the CDN `<script>` (cdn.form.io/js/formio.full.min.js), a CSS `<link>`, and exactly `import { Formio } from '@formio/js';`
- [x] 1.5 Extend structural test: `SKILL.md` contains `## MCP Tool Preference` naming `form_get` and `authenticate` plus the portal-login `x-jwt-token` guidance; `.claude/skills/formio-form` symlink resolves to `plugin/skills/formio-form/`

### Green

- [x] 1.6 Create `plugin/skills/formio-form/SKILL.md` with frontmatter (`name: formio-form`, three-clause description per spec), router body pointing into `references/` by topic, `## MCP Tool Preference` section, and Hosted-vs-SaaS URL terminology (`FORMIO_BASE_URL` / `FORMIO_PROJECT_URL`)
- [x] 1.7 Create the eleven reference docs as non-empty stubs with their required-topic headings (content lands in groups 2–4); create the `.claude/skills/formio-form` symlink

### Refactor

- [x] 1.8 Review implementation and refactor as needed

## 2. Core rendering behavior and docs (setup, rendering, javascript-api, options)
<!-- depends_on: 1 -->

### Red

- [x] 2.1 Write failing test `rendering.test.ts`: `Formio.createForm(el, jsonDefinition)` with an inline `components` array resolves to a form instance (fixture module `fixtures/rendering.ts` mirrors the doc example, not yet written)
- [x] 2.2 Write failing test: submission pre-fill — assigning `form.submission = { data }` round-trips the data through `form.submission`
- [x] 2.3 Write failing test: `change` event fires when a component value is set; `submit` handler receives the submission
- [x] 2.4 Write failing test: renderer options — `readOnly: true` renders a non-editable form instance (options object passed as third argument)

### Green

- [x] 2.5 Author `references/setup.md` (HTML page requirements: CDN + CSS includes, ESM import, target `<div>`, Hosted vs SaaS URL configuration) and `references/rendering.md` (render by URL, by JSON, submission pre-fill via `form.submission` and via submission URL) with examples matching the test fixtures
- [x] 2.6 Author `references/javascript-api.md` (`change`/`submit`/`submitDone`/`error` events, read/write `form.submission`, `form.getComponent`, programmatic submit) and `references/options.md` (`readOnly`, `noAlerts`, `hooks`, `i18n`, `sanitizeConfig`, combined example); make tests 2.1–2.4 pass

### Refactor

- [x] 2.7 Review implementation and refactor as needed

## 3. JSON Logic behavior and docs (json-logic, conditionals, calculated-values, validation, field-logic)
<!-- depends_on: 1 -->

### Red

- [x] 3.1 Write failing test `validation.test.ts`: the canonical `validate.json` example ("Your name must be 'Bob'!") — invalid value surfaces the JSON Logic error string, valid value clears it
- [x] 3.2 Write failing test `conditionals.test.ts`: `conditional.json` hides the dependent component and shows it when the driver value matches; simple `show`/`when`/`eq` behaves the same
- [x] 3.3 Write failing test `calculated-values.test.ts`: `calculateValue` (JSON Logic) computes a total from quantity × price as inputs change
- [x] 3.4 Write failing test `field-logic.test.ts`: a `logic` entry with a `json` trigger applies its action (e.g., disables a component) when the trigger evaluates true
- [x] 3.5 Extend structural test: `conditionals.md`, `calculated-values.md`, `validation.md`, `field-logic.md` each reference `json-logic.md` by path and do not re-list the full operations vocabulary

### Green

- [x] 3.6 Author `references/json-logic.md` (operations vocabulary scoped to renderer evaluation, `var` resolution against `data`/`row`, link out to jsonlogic.com for the rest)
- [x] 3.7 Author `references/validation.md` (canonical `validate.json` if/true/error-string contract, `{"var": "input"}` semantics, composition with standard `validate` keys) and `references/conditionals.md` (simple + `conditional.json` examples); make tests 3.1–3.2 pass
- [x] 3.8 Author `references/calculated-values.md` (`calculateValue` JSON Logic example, `allowCalculateOverride`) and `references/field-logic.md` (trigger types `simple`/`javascript`/`json`/`event`, action types, complete example); make tests 3.3–3.5 pass

### Refactor

- [x] 3.9 Review implementation and refactor as needed

## 4. External data and wizards
<!-- depends_on: 1 -->

### Red

- [x] 4.1 Write failing test `wizards.test.ts`: a `display: "wizard"` form exposes page navigation (programmatic next/previous page changes); a conditional page is skipped when its condition is false
- [x] 4.2 Write failing test `external-data.test.ts`: fetching an external payload and assigning it into `form.submission` populates the form (fetch stubbed, no live server)

### Green

- [x] 4.3 Author `references/external-data.md` (select URL data source, load-and-set external data, cascading make → model → year selects with `refreshOn`/`clearOnRefresh`/lazy load) and `references/wizards.md` (`display: "wizard"`, conditional wizard pages, custom navigation via the page API); make tests 4.1–4.2 pass

### Refactor

- [x] 4.4 Review implementation and refactor as needed

## 5. Sibling description routing updates
<!-- depends_on: 1 -->

### Red

- [x] 5.1 Extend structural test: `plugin/skills/formio-sdk/SKILL.md` `Not for:` clause contains `formio-form`
- [x] 5.2 Extend structural test: `plugin/skills/formio-application/SKILL.md` `Not for:` clauses contain `formio-form`
- [x] 5.3 Extend structural test: `plugin/skills/formio-angular/SKILL.md` description contains a `Not for:` clause with `formio-form`

### Green

- [x] 5.4 Update the three sibling `SKILL.md` descriptions with the `formio-form` `Not for:` pointers per the modified specs (embed/render requests route to `formio-form`; only Angular-explicit phrasing routes to `formio-angular`)

### Refactor

- [x] 5.5 Review implementation and refactor as needed

## 7. Plugin packaging reconciliation (formio-form name reuse)
<!-- depends_on: 1 -->

### Red

- [x] 7.1 Update `packages/mcp-server/src/__tests__/plugin-build.test.ts` test 1.3 per the `claude-plugin-packaging` delta: the bundle SHALL include `formio-form` (assertion flips from `not.toContain` to `toContain`); run to observe the pre-fix state

### Green

- [x] 7.2 Run the mcp-server suite; confirm `pnpm build:plugin` bundles `plugin/skills/formio-form/` and all packaging tests pass

### Refactor

- [x] 7.3 Review implementation and refactor as needed

## 6. Definition of done
<!-- depends_on: 2, 3, 4, 5, 7 -->

### Red

- [x] 6.1 Run full suite `pnpm test` and capture any remaining failures across `packages/skill-tests/src/formio-form/`

### Green

- [x] 6.2 Fix failures; verify `pnpm test`, `pnpm lint`, and `pnpm format` all pass clean

### Refactor

- [x] 6.3 Review implementation and refactor as needed
