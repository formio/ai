## Context

`plugin/skills/` already hosts source-derived skills for REST endpoints (`formio-api`), app orchestration (`formio-application`), schema planning (`formio-resource-planner`), and framework implementors (`formio-angular`). What is missing is a skill for the runtime JavaScript surface: the `Formio` SDK (CRUD, auth, projects, files, plugins) and the `Utils` namespace (formula evaluation, condition logic, component traversal, masks, sanitization, date helpers, i18n, JSONLogic).

The canonical sources live outside this repo at the Form.io source repository (kept outside this repo at authoring time):

- SDK core: `packages/core/src/sdk/Formio.ts`, `Plugins.ts`, `index.ts`
- SDK renderer extensions: `packages/formio.js/src/Formio.js` (re-exports + adds icon/template/CDN/license/plugin glue)
- Utils core: `packages/core/src/utils/` (`Evaluator.ts`, `conditions.ts`, `logic.ts`, `formUtil/`, `jsonlogic/`, `mask.ts`, `sanitize.ts`, `date.ts`, `dom.ts`, `i18n.ts`, `jwtDecode.ts`, `unwind.ts`, `utils.ts`)
- Utils renderer extensions: `packages/formio.js/src/utils/` (`Evaluator.js`, `formUtils.js`, `builder.js`, `calendarUtils.js`, `ChoicesWrapper.js`, `conditionOperators/`, `i18n.js`, `utils.js`, `index.js`)

Existing online documentation for these surfaces is known to drift from source; the skill MUST be derived from the source tree, not from `help.form.io` or third-party blog posts.

The skill must fit the established library conventions:

- Single activatable `SKILL.md` with three-clause description (capability / "Use when…" / "Not for: …").
- One reference document per capability group under `references/`, no YAML frontmatter on references.
- Per-reference `## MCP Tool Preference` block where applicable (CRUD methods that overlap `form_*` / `project_*` / `role_*` tools should defer to MCP first).
- Strict terminology: `baseUrl` → `FORMIO_BASE_URL`; `projectUrl` → `FORMIO_PROJECT_URL`.
- Validator coverage in `packages/mcp-server/src/skills-validator.ts` with Vitest enforcement under `pnpm test`.

## Goals / Non-Goals

**Goals:**

- Teach Claude the actual runtime API surface of `@formio/js` and `@formio/js/utils` as it exists in the Form.io source HEAD, with executable examples.
- Make canonical import statements (`import { Formio } from '@formio/js'` and `import { Utils } from '@formio/js/utils'`) non-negotiable — examples MUST use them; deep imports (`@formio/core`, `@formio/js/lib/...`) MUST NOT appear.
- Make Hosted-vs-SaaS URL configuration the first thing the skill asserts. Every code example MUST be preceded (in its reference doc) by an explicit `setBaseUrl` + `setProjectUrl` pair appropriate to the environment.
- Provide enough worked examples that an agent can implement common flows (login, list submissions, create form, upload file, evaluate condition, traverse components, run JSONLogic) without reading source.
- Enforce skill structure mechanically via the existing validator infrastructure.

**Non-Goals:**

- Vendoring or building against the Form.io source tree at runtime — source is consulted at authoring time only.
- Documenting the Form.io REST endpoints themselves — that is `formio-api`'s job. References cross-link there for endpoint shape.
- Documenting Angular/React framework wrappers — those are owned by `formio-angular` and future framework skills.
- Eval harness in the first iteration — add later under `plugin/skills/formio-sdk/evals/` once the skill stabilizes.

## Decisions

### Decision 1: Single skill, multiple references — NOT a per-method skill

Adopt the `formio-api` shape: one activatable `SKILL.md` plus reference documents under `references/`. Alternative considered: separate `formio-sdk` and `formio-utils` skills. Rejected because the SDK and Utils are imported from the same package and agents routinely need both in the same edit; splitting forces double-activation and risks divergent guidance on imports / URL config.

### Decision 2: Reference layout — capability-grouped, source-anchored

References will be grouped by user-facing capability, not by source file. Proposed initial set (subject to confirmation while reading source):

SDK references:

- `references/setup.md` — `setBaseUrl`, `setProjectUrl`, Hosted vs SaaS, token storage, plugins registration
- `references/auth.md` — `Formio.login`, `Formio.logout`, `Formio.currentUser`, `Formio.ssoInit`, JWT handling, OAuth helpers
- `references/forms.md` — form CRUD via `new Formio(url).loadForm()/saveForm()/deleteForm()`, `loadForms`
- `references/submissions.md` — submission CRUD, `loadSubmissions` with query, `availableActions`
- `references/projects.md` — `loadProject`, `saveProject`, project-level helpers
- `references/roles.md` — `loadRoles`, role assignment
- `references/files.md` — `Formio.uploadFile`, `downloadFile`, provider config
- `references/plugins.md` — `Formio.registerPlugin`, plugin lifecycle hooks (`preRequest`, `request`, `wrapRequestPromise`, etc.)
- `references/rendering.md` — VanillaJS form rendering via `Formio.createForm(element, formSrc, options)`; covers prefill, events (`change`, `submit`, `error`, `nextPage`, `prevPage`), wizard, builder (`Formio.builder`), PDF (`Formio.createForm` with PDF source), read-only mode, custom templates/icons, and offline/local-JSON form sources. Behavior coverage is drawn from `formio.github.io/formio.js/app/examples` but ALL examples in this reference use ESM `import { Formio } from '@formio/js'` — never `<script>` tags or `Formio.use`-via-CDN patterns.

Utils references:

- `references/utils-evaluator.md` — `Utils.Evaluator`, `evaluate`, `noeval`, template strings
- `references/utils-form-traversal.md` — `Utils.eachComponent`, `eachComponentData`, `getComponent`, `findComponent`, `flattenComponents`
- `references/utils-conditions.md` — `Utils.checkCondition`, `checkSimpleConditional`, `checkJsonConditional`, `checkCustomConditional`
- `references/utils-logic.md` — `Utils.checkTrigger`, action evaluation
- `references/utils-jsonlogic.md` — JSONLogic operators, custom operators
- `references/utils-mask-sanitize.md` — input masks, sanitize HTML, dom helpers
- `references/utils-misc.md` — date, i18n, jwtDecode, unwind, fastCloneDeep, override

Each reference's layout:

1. `## Overview` (1–2 sentences, source path callout: "Sourced from `packages/core/src/sdk/Formio.ts`")
2. `## Imports` (canonical import block, verbatim)
3. `## URL Configuration` (Hosted + SaaS examples for `setBaseUrl` / `setProjectUrl`; omitted only on `references/utils-*` where no HTTP is involved)
4. `## API` (signatures + descriptions)
5. `## Examples` (≥ 2 worked examples per reference)
6. `## MCP Tool Preference` (when an MCP tool covers the operation — `form_create` instead of `new Formio(url).saveForm()` etc.)

Alternative considered: 1-to-1 mapping with source files. Rejected — `Formio.ts` is 1,500+ lines and would dump unstructured content on agents.

### Decision 3: Hosted vs SaaS as a first-class concept in `SKILL.md`

The top of `SKILL.md` defines two environment archetypes verbatim:

```ts
// Hosted (self-deployed)
Formio.setBaseUrl('https://forms.mysite.com');
Formio.setProjectUrl('https://forms.mysite.com/myproject');

// SaaS (portal.form.io)
Formio.setBaseUrl('https://api.form.io');
Formio.setProjectUrl('https://myproject.form.io');
```

The validator MUST verify both blocks are present in `SKILL.md` so future edits cannot regress. Each reference doc that has a `## URL Configuration` section MUST show both Hosted and SaaS variants.

### Decision 4: Import enforcement via validator string match

`@formio/js` and `@formio/js/utils` are the only acceptable import sources. The validator scans fenced code blocks across `SKILL.md` and `references/*.md` and emits issues for:

- `from '@formio/core'` (forbidden — internal package)
- `from '@formio/js/lib/...'` (forbidden — deep import)
- `require('@formio/js')` mixed with the namespaced `import` examples (forbidden — sample code stays ESM-only for consistency)
- `<script ` tags inside fenced HTML/JS blocks (forbidden — rendering examples must use ESM imports, never the CDN-script pattern from the public examples site)

Forbidden-import detection lives next to the existing `validateForbiddenTokens` infrastructure.

### Decision 5: Three-clause description with explicit negative-trigger clause

`SKILL.md` `description` frontmatter MUST contain:

- Capability statement (what the skill teaches and where it sourced facts from).
- "Use when the user asks to …" trigger clause (e.g., "call `Formio.loadForm`", "evaluate a JSONLogic condition", "register a plugin", "configure base/project URLs in a non-Angular consumer").
- "Not for: …" negative-trigger clause naming `formio-api` (REST endpoints), `formio-application` (orchestrator), `formio-resource-planner` (schema planning), `formio-angular` (Angular wrappers).

The validator enforces presence of all three substrings.

### Decision 6: Validator extension lives alongside existing checks

Add a `validateFormioSdkSkill(libraryDir)` function exported from `packages/mcp-server/src/skills-validator.ts`, wired into `validateLibrary`. It runs only when `plugin/skills/formio-sdk/` exists, so the validator stays green during incremental landings of this change.

Issue codes follow the existing `<category>.<rule>` convention:

- `formio_sdk.skill_missing` — `SKILL.md` not found
- `formio_sdk.frontmatter_missing` — no YAML frontmatter
- `formio_sdk.description_clause` (with `clause: 'capability' | 'trigger' | 'negative'`)
- `formio_sdk.canonical_import_missing` (with `which: 'sdk' | 'utils'`)
- `formio_sdk.forbidden_import` (with `import_path`)
- `formio_sdk.forbidden_script_tag` (rendering examples that use `<script>` to load the renderer instead of ESM imports)
- `formio_sdk.url_config_missing` (with `environment: 'hosted' | 'saas'`)
- `formio_sdk.reference_layout` (missing or out-of-order heading; analogous to existing `headings.missing` / `headings.order`)
- `formio_sdk.reference_missing` (a required reference doc absent or empty)
- `formio_sdk.rendering_entry_missing` (`references/rendering.md` lacks a fenced example calling `Formio.createForm(`)

## Risks / Trade-offs

- **Risk:** Source drifts after authoring; examples become stale.
  **Mitigation:** Record the source paths in each reference's `## Overview` ("Sourced from `…`"). When the SDK changes upstream, those paths give a reviewer a 1-click jump target. Add an eval harness later to detect drift; out of scope for this change.

- **Risk:** Validator coupling — adding `formio-sdk` rules to the shared `validateLibrary` could destabilize existing skills.
  **Mitigation:** Gate the new checks on `plugin/skills/formio-sdk/` existing; existing skills keep their current rule set. Land validator + skill together so the rules and the skill stay in sync.

- **Risk:** Reference-count sprawl. ~15 reference files is large; the agent must navigate efficiently.
  **Mitigation:** `SKILL.md` will include a navigation table mapping intent → reference (analogous to `formio-api`'s router). Validator enforces presence of the navigation table.

- **Risk:** Hosted-vs-SaaS confusion when a user is on a custom domain that points to SaaS.
  **Mitigation:** `setup.md` explicitly calls out the rule of thumb: "If your portal lives at `portal.form.io`, you are on SaaS. Otherwise, you are Hosted." Validator does not police domain values — that would be brittle.

- **Trade-off:** No eval harness yet. Quality of source-faithful examples is verified by code review on the proposal, not by an automated grader. Acceptable for first iteration; revisit once `formio-resource-planner`-style evals mature.
