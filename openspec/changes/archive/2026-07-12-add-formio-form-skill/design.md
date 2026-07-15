# Design: `formio-form` skill

## Context

The skills library covers building whole apps (`formio-application` → `formio-angular`), planning data models (`formio-resource-planner`), REST endpoints (`formio-api`), and the raw SDK/Utils API surface (`formio-sdk`). There is no task-oriented skill for the most common developer job: embedding a single form into an existing page or application with the Vanilla JS renderer.

The renderer surface to document is well-bounded: `Formio.createForm(element, srcOrJson, options)`, submission pre-fill, the form instance's event/method API, renderer options, and the component-JSON logic vocabulary (`logic`, `conditional.json`, `calculateValue`, `validate.json`) driven by JSON Logic.

Source material (authoring inputs, not runtime dependencies):

- help.form.io Form Renderer guide (page requirements, render URL, render JSON, submissions, controlling with JavaScript, options)
- formio.js example pages: `fieldLogic`, `conditions`, `external`, `calculated`, `externalload`, `conditionalwizard`, `customwizard`
- jsonlogic.com operations reference

`packages/skill-tests` already runs `formio-sdk` doc examples against the real `@formio/js` in a DOM test environment, so renderer examples are testable.

## Goals / Non-Goals

**Goals:**

- One activatable skill, `plugin/skills/formio-form/`, that owns framework-agnostic "embed/render a form" work end to end.
- Unambiguous routing: Angular-explicit phrasing goes to `formio-angular`; app-building goes to `formio-application`; everything embed-shaped lands here.
- Every JSON Logic shape the renderer consumes (`validate.json`, `conditional.json`, `calculateValue` with JSON variants, `logic` actions) documented with canonical examples.
- Doc examples runnable and verified by Vitest against the real `@formio/js` (same guarantee `formio-sdk` gives — no drift-prone prose).

**Non-Goals:**

- Form building UI (`Formio.builder`) — out of scope; mention only as a pointer.
- Framework wrappers (`@formio/angular`, `@formio/react`) — those are framework skills.
- Server-side/API concerns (actions, roles, submissions via REST) — `formio-api` / MCP tools own those.
- An eval harness (`evals/`) for this skill — can be added later following the repo convention; not part of this change.
- Custom components / plugin authoring — `formio-sdk` territory.

## Decisions

### D1: Stand-alone peer skill, not a `formio-sdk` reference doc

`formio-sdk` is an API reference ("what does `Formio.request` take?"); `formio-form` is a task guide ("put this form on my page and make field B appear when field A is X"). Embedding has its own trigger vocabulary and needs component-JSON logic docs that are form-definition concerns, not SDK concerns. Alternative — folding into `formio-sdk/references/rendering.md` — rejected: activation precision would suffer and the doc would balloon past one capability group.

### D2: Reference-doc layout (SKILL.md router + `references/*.md`, no frontmatter on references)

Same pattern as `formio-api` and `formio-sdk`. Files:

| Reference | Covers |
|---|---|
| `setup.md` | HTML page requirements: CDN `<script>`/`<link>` includes, ESM install/import, target `<div>`, Hosted vs SaaS URL configuration |
| `rendering.md` | `Formio.createForm` with a form URL, with inline form JSON, and with a submission (pre-fill via `submission` and via submission URL) |
| `javascript-api.md` | Controlling the form instance: events (`change`, `submit`, `submitDone`, `error`, ...), `form.submission`, `getComponent`, `setPage`, `emit`, redraw/destroy |
| `options.md` | Renderer options object: `readOnly`, `noAlerts`, `hooks`, `i18n`, `sanitizeConfig`, `buttonSettings`, etc. |
| `json-logic.md` | JSON Logic primer scoped to what the renderer evaluates: operations table (from jsonlogic.com), `var` resolution against `data`/`row`, shared by the three consumer docs |
| `field-logic.md` | Component `logic` arrays: triggers (simple, javascript, json, event) and actions (property, value, mergeComponentSchema) |
| `conditionals.md` | Simple conditionals (`conditional.show/when/eq`) and JSON Logic conditionals (`conditional.json`) |
| `calculated-values.md` | `calculateValue` (JSON Logic and javascript variants), `allowCalculateOverride` |
| `validation.md` | `validate.json` returning `true` or an error string, plus how it composes with standard `validate` keys |
| `external-data.md` | Loading external data into a form, setting submission data from external sources, cascading/conditional selects (make → model → year) |
| `wizards.md` | Wizard display mode, conditional wizard pages, custom wizard navigation from the JavaScript API |

Rationale for merging the user's "Rendering Form URL / JSON / Submissions" bullets into one `rendering.md`: they are one API (`createForm`) with three input shapes; splitting them would force cross-file hopping for the most basic task. JSON Logic gets its own primer because three consumer docs (`conditionals`, `calculated-values`, `validation`) would otherwise each duplicate the operations vocabulary — the repo rule is shapes are documented once and referenced by path.

### D3: Description routing (three-clause template)

- Capability clause: embed/render forms in any web application with the Vanilla JS renderer `@formio/js`, including pre-fill, events, conditional logic, calculated values, and JSON Logic validation.
- Trigger clause: "Use when the user asks to …" embed a form, render a form, add a form to a page/site/app, pre-fill a form, show/hide fields conditionally, calculate field values, add custom validation, build a conditional/custom wizard — with no framework named.
- Negative clause: "Not for: …" `formio-angular` (user explicitly names Angular or `@formio/angular`), `formio-application` (build a whole app/portal around data), `formio-resource-planner` (design the data model), `formio-api` (REST endpoint lookups), `formio-sdk` (raw SDK/Utils API reference beyond embedding).

Sibling descriptions get the reverse pointers (see proposal's Modified Capabilities). `formio-angular` keeps claiming only Angular-explicit triggers — that invariant already exists; the change only adds the explicit `formio-form` pointer.

### D4: Dual usage modes — CDN and ESM — with canonical snippets

Embedding targets plain HTML pages as much as bundled apps, so unlike `formio-sdk` (ESM-only), `formio-form` documents exactly two canonical inclusion modes:

- CDN: `<script src="https://cdn.form.io/js/formio.full.min.js"></script>` + matching CSS `<link>`, global `Formio`.
- ESM: `import { Formio } from '@formio/js';` (identical to the `formio-sdk` canonical import).

Forbidden everywhere: `@formio/core` imports, `@formio/js/lib/` deep imports, `require()`. Terminology stays strict: `baseUrl` ⇒ `FORMIO_BASE_URL`, `projectUrl` ⇒ `FORMIO_PROJECT_URL`.

### D5: Doc examples verified by `packages/skill-tests/src/formio-form/`

Same contract as `formio-sdk`: reference-doc code examples are extracted into Vitest tests running against the real `@formio/js` in the existing DOM test environment. Coverage targets: `createForm` from JSON, submission pre-fill, `change`/`submit` events, `validate.json` (invalid value yields the JSON Logic error string), `calculateValue`, `conditional.json` show/hide, and wizard page navigation. TDD order per repo rule: failing tests first (red), then author the reference docs whose examples make them pass (green).

Rendering-by-URL examples are documented but network-dependent; tests stub `Formio.setBaseUrl`/fetch rather than hit a live server.

### D6: MCP tool preference

`SKILL.md` includes an `## MCP Tool Preference` section (mirroring `formio-api` reference convention): when the form definition must be fetched or modified during an embed task, prefer `form_get` / `form_update` MCP tools over ad-hoc `curl`/fetch; authentication goes through the portal-login `authenticate` flow, never PKCE or API keys.

### D7: Dev symlink

Add `.claude/skills/formio-form -> ../../plugin/skills/formio-form`, matching the existing dev symlinks (`formio-angular`, `formio-application`, `formio-resource-planner`) so the skill activates in this repo during development.

## Risks / Trade-offs

- [Renderer behavior in a DOM test environment diverges from real browsers (focus, attach timing, wizard transitions)] → Keep tested examples to data/logic behavior (`submission`, validation results, conditional visibility flags, calculated values) rather than pixel/DOM assertions; the `formio-sdk` suite already proves this works.
- [Overlap with `formio-sdk`'s `rendering.md` reference causes double-activation or contradictory guidance] → `formio-form` owns the task-level embed guidance; `formio-sdk/references/rendering.md` stays the API-surface reference. The `Not for:` clauses on both descriptions point at each other; no example is duplicated with different content.
- [help.form.io / example pages drift after authoring] → Tests against the real package are the drift guard for code behavior; doc URLs are cited as sources in the change, not linked as living dependencies inside the skill.
- [JSON Logic primer duplicates jsonlogic.com] → Scope the primer to operations the renderer actually evaluates plus Form.io-specific `var` data resolution; link out for the rest.

## Open Questions

None — routing boundaries, file layout, and test scope are settled above.
