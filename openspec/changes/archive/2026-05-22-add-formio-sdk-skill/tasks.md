## 1. Validator scaffold (`validateFormioSdkSkill`)
<!-- depends_on: none -->

### Red

- [x] 1.1 Write failing Vitest test: `validateFormioSdkSkill` exists, is exported from `packages/mcp-server/src/skills-validator.ts`, and returns `[]` when `plugin/skills/formio-sdk/` is absent from a temp library fixture
- [x] 1.2 Write failing Vitest test: when `plugin/skills/formio-sdk/` exists but `SKILL.md` is absent, `validateFormioSdkSkill` emits exactly one issue with `category: "formio_sdk"` and `rule: "skill_missing"`
- [x] 1.3 Write failing Vitest test: `validateLibrary` invokes `validateFormioSdkSkill` and propagates its issues into the aggregated result (assert the new issue surfaces through the public entry point)

### Green

- [x] 1.4 Add a `validateFormioSdkSkill(libraryDir)` export with the minimal logic needed to pass 1.1–1.2 (existence check + `skill_missing` emission)
- [x] 1.5 Wire `validateFormioSdkSkill` into `validateLibrary` so 1.3 passes

### Refactor

- [x] 1.6 Review implementation and refactor as needed

## 2. Frontmatter + three-clause description rules
<!-- depends_on: 1 -->

### Red

- [x] 2.1 Write failing test: empty `SKILL.md` (no YAML frontmatter) emits `formio_sdk.frontmatter_missing`
- [x] 2.2 Write failing test: frontmatter with `name: formio-sdk` but a `description` that lacks `Use when the user asks to` emits `formio_sdk.description_clause` with `clause: "trigger"`
- [x] 2.3 Write failing test: description with the trigger clause but no `Not for:` clause emits `formio_sdk.description_clause` with `clause: "negative"`
- [x] 2.4 Write failing test: `Not for:` clause that omits the literal `formio-api` emits `formio_sdk.description_clause` with `clause: "negative"` whose payload names `formio-api`
- [x] 2.5 Write failing test: description with all three clauses and all four sibling skill names returns no `description_clause` issues

### Green

- [x] 2.6 Implement frontmatter parsing and the three-clause description checks against the failing tests
- [x] 2.7 Implement the sibling-name check covering `formio-api`, `formio-application`, `formio-resource-planner`, and `formio-angular`

### Refactor

- [x] 2.8 Review implementation and refactor as needed

## 3. Canonical-import + forbidden-import enforcement
<!-- depends_on: 1 -->

### Red

- [x] 3.1 Write failing test: a `SKILL.md` that lacks `import { Formio } from '@formio/js'` emits `formio_sdk.canonical_import_missing` with `which: "sdk"`
- [x] 3.2 Write failing test: a `SKILL.md` that lacks `import { Utils } from '@formio/js/utils'` emits `formio_sdk.canonical_import_missing` with `which: "utils"`
- [x] 3.3 Write failing test: a reference doc with a fenced block containing `import { Formio } from '@formio/core'` emits `formio_sdk.forbidden_import` with `import_path: "@formio/core"`
- [x] 3.4 Write failing test: a fenced block containing `import x from '@formio/js/lib/Formio'` emits `formio_sdk.forbidden_import` with `import_path` beginning `@formio/js/lib/`
- [x] 3.5 Write failing test: a fenced JS block containing `const { Formio } = require('@formio/js');` emits `formio_sdk.forbidden_import` with `import_path: "@formio/js"`
- [x] 3.6 Write failing test: prose mention of `@formio/core` OUTSIDE any code fence emits zero `formio_sdk.forbidden_import` issues
- [x] 3.7 Write failing test: a fenced block containing `<script src="https://cdn.form.io/formiojs/formio.full.min.js"></script>` emits `formio_sdk.forbidden_script_tag`
- [x] 3.8 Write failing test: prose mention of `<script>` OUTSIDE any code fence emits zero `formio_sdk.forbidden_script_tag` issues

### Green

- [x] 3.9 Implement fenced-code-block extraction reused/borrowed from the existing reference validator
- [x] 3.10 Implement canonical-import presence check on `SKILL.md`
- [x] 3.11 Implement forbidden-import scanner across `SKILL.md` + every `references/*.md`
- [x] 3.12 Implement forbidden-script-tag scanner across `SKILL.md` + every `references/*.md`

### Refactor

- [x] 3.13 Review implementation and refactor as needed

## 4. Hosted vs SaaS URL configuration rules
<!-- depends_on: 1 -->

### Red

- [x] 4.1 Write failing test: `SKILL.md` lacking `setBaseUrl('https://forms.mysite.com')` emits `formio_sdk.url_config_missing` with `environment: "hosted"`
- [x] 4.2 Write failing test: `SKILL.md` lacking `setProjectUrl('https://myproject.form.io')` emits `formio_sdk.url_config_missing` with `environment: "saas"`
- [x] 4.3 Write failing test: a reference file whose `## URL Configuration` section is missing the SaaS literal emits `formio_sdk.url_config_missing` with `environment: "saas"` and a payload naming the file
- [x] 4.4 Write failing test: `utils-evaluator.md` may omit `## URL Configuration` without emitting `url_config_missing` (Utils-only references are exempt)

### Green

- [x] 4.5 Implement Hosted/SaaS literal detection on `SKILL.md`
- [x] 4.6 Implement per-reference URL-section detection that is gated to SDK references (skip `utils-*`)

### Refactor

- [x] 4.7 Review implementation and refactor as needed

## 5. Required-references and heading-layout rules
<!-- depends_on: 1 -->

### Red

- [x] 5.1 Write failing test: when a fixture has `plugin/skills/formio-sdk/` but no `references/` directory, the validator emits one `formio_sdk.reference_missing` issue per required file (16 issues total)
- [x] 5.2 Write failing test: when one required reference is zero bytes, it still counts as missing and emits `formio_sdk.reference_missing` for that file
- [x] 5.3 Write failing test: a reference doc missing `## Overview` emits `formio_sdk.reference_layout` with `rule: "missing"`
- [x] 5.4 Write failing test: a reference doc where `## Examples` precedes `## API` emits `formio_sdk.reference_layout` with `rule: "order"`
- [x] 5.5 Write failing test: a reference `## Overview` that lacks a `Sourced from \`packages/` substring emits `formio_sdk.reference_layout` with `rule: "missing_source_attribution"`

### Green

- [x] 5.6 Implement the required-references list and existence + non-emptiness check
- [x] 5.7 Implement heading-extraction reused from the existing reference layout validator and the required-order check
- [x] 5.8 Implement source-attribution check on each reference's `## Overview`

### Refactor

- [x] 5.9 Review implementation and refactor as needed

## 6. Navigation-table rule
<!-- depends_on: 1 -->

### Red

- [x] 6.1 Write failing test: `SKILL.md` containing no Markdown table with `Intent` and `Reference` columns emits `formio_sdk.navigation_table_missing`
- [x] 6.2 Write failing test: `SKILL.md` containing the table but missing a link to `references/utils-jsonlogic.md` emits `formio_sdk.navigation_table_missing` whose payload names the unlinked reference

### Green

- [x] 6.3 Implement Markdown table detection scoped to header rows containing `Intent` and `Reference`
- [x] 6.4 Implement reference-link coverage check across the required-references list

### Refactor

- [x] 6.5 Review implementation and refactor as needed

## 7. Author the formio-sdk SKILL.md
<!-- depends_on: 2, 3, 4, 6 -->

### Red

- [x] 7.1 Add a Vitest fixture test that runs `validateFormioSdkSkill` against the actual `plugin/skills/formio-sdk/` and currently fails because `SKILL.md` does not yet exist or does not yet satisfy frontmatter/description/URL/import/navigation rules
- [x] 7.2 Add a test that asserts the navigation table in the real `SKILL.md` links to every entry in the required-references list

### Green

- [x] 7.3 Read `packages/core/src/sdk/Formio.ts`, `Plugins.ts`, `index.ts`, and `packages/formio.js/src/Formio.js` end-to-end to anchor the skill description in source
- [x] 7.4 Write `plugin/skills/formio-sdk/SKILL.md` with: YAML frontmatter (`name`, three-clause `description`), canonical imports block, Hosted block, SaaS block, navigation table mapping intent → reference file, and source-attribution callout
- [x] 7.5 Re-run the Vitest validator suite and confirm SKILL-level checks pass

### Refactor

- [x] 7.6 Review implementation and refactor as needed

## 8. Author SDK reference docs (auth, forms, submissions, projects, roles, files, plugins, setup)
<!-- depends_on: 5, 7 -->

### Red

- [x] 8.1 Add a Vitest test asserting each SDK reference file exists, is non-empty, contains the required heading layout (`Overview`, `Imports`, `URL Configuration`, `API`, `Examples`, and `MCP Tool Preference` where overlap applies), and shows both Hosted and SaaS URL literals
- [x] 8.2 Add a Vitest test asserting each SDK reference's fenced code blocks use only the canonical imports

### Green

- [x] 8.3 Read `core/src/sdk/Formio.ts` and `formio.js/src/Formio.js` to extract authentic signatures for `login`, `logout`, `currentUser`, `loadForm`, `saveForm`, `loadSubmissions`, `loadProject`, `loadRoles`, `uploadFile`, `registerPlugin`
- [x] 8.4 Write `plugin/skills/formio-sdk/references/setup.md` (URL configuration, plugin registration, token storage, Hosted vs SaaS, source attribution)
- [x] 8.5 Write `plugin/skills/formio-sdk/references/auth.md` (login/logout/currentUser/SSO/OAuth, source attribution)
- [x] 8.6 Write `plugin/skills/formio-sdk/references/forms.md` (form CRUD via SDK + MCP Tool Preference referencing `form_create` / `form_get` / `form_list` / `form_update`)
- [x] 8.7 Write `plugin/skills/formio-sdk/references/submissions.md` (submission CRUD, query, `availableActions`)
- [x] 8.8 Write `plugin/skills/formio-sdk/references/projects.md` (project CRUD + MCP Tool Preference referencing `project_export` / `project_import`)
- [x] 8.9 Write `plugin/skills/formio-sdk/references/roles.md` (role list/update + MCP Tool Preference)
- [x] 8.10 Write `plugin/skills/formio-sdk/references/files.md` (upload/download providers)
- [x] 8.11 Write `plugin/skills/formio-sdk/references/plugins.md` (`registerPlugin`, hook lifecycle, request-wrapping)
- [x] 8.12 Add a Red Vitest test: `references/rendering.md` exists, contains `import { Formio } from '@formio/js'`, contains a fenced `Formio.createForm(` call, contains a `form.on('submit'` example, contains a `submission =` prefill example, and contains zero `<script ` tags
- [x] 8.13 Walk `formio.github.io/formio.js/app/examples` to enumerate behavior categories (load, prefill, submission, events, wizard, builder, PDF, read-only, custom templates, offline/local-JSON) for content coverage — DO NOT copy `<script>` import style; rewrite every example with ESM `import { Formio } from '@formio/js'`
- [x] 8.14 Read `formio.js/src/Formio.js` for the real signature of `Formio.createForm`, `Formio.builder`, and the form-instance event API to ground the rendering reference in source
- [x] 8.15 Write `plugin/skills/formio-sdk/references/rendering.md` covering: VanillaJS DOM-target form rendering, prefill via `submission`, event subscription (`change`, `submit`, `error`, `nextPage`, `prevPage`), wizard rendering, builder rendering, PDF form rendering, read-only mode, and offline / local form-JSON sources — all examples ESM-import-only, no `<script>` tags, Hosted + SaaS URL Configuration block present
- [x] 8.16 Re-run Vitest and confirm all SDK reference checks pass

### Refactor

- [x] 8.17 Review implementation and refactor as needed

## 9. Author Utils reference docs
<!-- depends_on: 5, 7 -->

### Red

- [x] 9.1 Add a Vitest test asserting each Utils reference file exists, contains the heading layout minus `URL Configuration`, and uses the canonical `import { Utils } from '@formio/js/utils'` line
- [x] 9.2 Add a Vitest test asserting `utils-evaluator.md` contains at least one fenced example using `Utils.Evaluator.evaluate`

### Green

- [x] 9.3 Read `core/src/utils/Evaluator.ts`, `conditions.ts`, `logic.ts`, `formUtil/`, `jsonlogic/`, `mask.ts`, `sanitize.ts`, `date.ts`, `dom.ts`, `i18n.ts`, `jwtDecode.ts`, `unwind.ts`, `utils.ts` and the renderer wrappers under `formio.js/src/utils/`
- [x] 9.4 Write `plugin/skills/formio-sdk/references/utils-evaluator.md` (Evaluator, evaluate, noeval, template literals, plus source attribution to both core and renderer)
- [x] 9.5 Write `plugin/skills/formio-sdk/references/utils-form-traversal.md` (`eachComponent`, `eachComponentData`, `getComponent`, `findComponent`, `flattenComponents`)
- [x] 9.6 Write `plugin/skills/formio-sdk/references/utils-conditions.md` (`checkCondition`, simple/JSON/custom conditional helpers)
- [x] 9.7 Write `plugin/skills/formio-sdk/references/utils-logic.md` (`checkTrigger`, action evaluation)
- [x] 9.8 Write `plugin/skills/formio-sdk/references/utils-jsonlogic.md` (built-in operators, custom-operator registration)
- [x] 9.9 Write `plugin/skills/formio-sdk/references/utils-mask-sanitize.md` (mask helpers, sanitize HTML, dom helpers)
- [x] 9.10 Write `plugin/skills/formio-sdk/references/utils-misc.md` (date, i18n, jwtDecode, unwind, fastCloneDeep, override)
- [x] 9.11 Re-run Vitest and confirm all Utils reference checks pass

### Refactor

- [x] 9.12 Review implementation and refactor as needed

## 10. Repository docs and Definition of Done
<!-- depends_on: 7, 8, 9 -->

### Red

- [x] 10.1 Add a Vitest test that re-runs the full skills-library validation against the real `plugin/skills/` and expects zero issues (acts as the integration gate for the whole skill)

### Green

- [x] 10.2 Update `CLAUDE.md` "Skills Library" section to list `formio-sdk` alongside `formio-api`, `formio-application`, `formio-resource-planner`, and `formio-angular`, with one sentence describing scope and source-derivation
- [x] 10.3 Run `pnpm test`, `pnpm lint`, and `pnpm format`; ensure all pass per the Definition of Done

### Refactor

- [x] 10.4 Review implementation and refactor as needed
