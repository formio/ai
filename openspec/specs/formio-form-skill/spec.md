## Purpose

Defines the `formio-form` skill: the library's embed-a-form entry point — its three-clause description and embed-only triggers, the two canonical inclusion modes, the reference document each concern lives in, strict URL terminology, and the handoff to `formio-form-builder` for a form that does not exist yet.

## Requirements

### Requirement: New skill `formio-form` exists as the library's embed-a-form entry point

The skills library SHALL contain a new skill at `plugin/skills/formio-form/SKILL.md` with frontmatter `name: formio-form`. The skill directory SHALL contain a `references/` directory with exactly the following reference documents, none of which begin with a YAML frontmatter block:

- `setup.md` — HTML page requirements and library inclusion
- `rendering.md` — rendering by form URL, by form JSON, and with submissions (pre-fill)
- `javascript-api.md` — controlling the form instance with JavaScript (events and methods)
- `options.md` — form renderer options
- `json-logic.md` — JSON Logic primer scoped to renderer evaluation
- `field-logic.md` — component `logic` arrays (triggers and actions)
- `conditionals.md` — simple and JSON Logic conditionals
- `calculated-values.md` — `calculateValue`
- `validation.md` — custom validation via `validate.json`
- `external-data.md` — external data sources and cascading/conditional selects
- `wizards.md` — wizard display, conditional wizards, custom wizard navigation

A symlink `.claude/skills/formio-form` SHALL exist and resolve to `plugin/skills/formio-form/`.

#### Scenario: formio-form directory layout

- **WHEN** the repository is inspected
- **THEN** `plugin/skills/formio-form/SKILL.md` exists with frontmatter `name: formio-form` and a non-empty `description`
- **AND** all eleven reference documents listed above exist under `plugin/skills/formio-form/references/` and are non-empty
- **AND** no reference document's first line is `---`
- **AND** `.claude/skills/formio-form` resolves to `plugin/skills/formio-form/`

### Requirement: formio-form description uses the three-clause template and claims framework-agnostic embed triggers

The `formio-form` `SKILL.md` frontmatter `description` SHALL contain three clauses:

1. A capability statement naming the Vanilla JS renderer `@formio/js` and asserting the skill covers embedding forms in any web application — rendering by URL or JSON, submission pre-fill, JavaScript control, renderer options, conditional logic, calculated values, and JSON Logic validation.
2. A trigger clause beginning with the substring `Use when the user asks to` claiming framework-agnostic embed phrasing. Example triggers the description MUST claim include: "embed a form", "render a form", "add this form to my page/site/app", "pre-fill a form", "show or hide a field based on another field", "calculate a field value", "add custom validation to a field", "conditional wizard".
3. A negative-trigger clause beginning with the substring `Not for:` that names ALL of: `formio-angular` (user explicitly names Angular or `@formio/angular`), `formio-react` (user explicitly names React or `@formio/react`), `formio-application` (building a whole app, portal, or tracker around data), `formio-resource-planner` (designing the data model), `formio-api` (REST endpoint lookups), `formio-sdk` (raw SDK/Utils API reference beyond embedding), and `formio-form-builder` (creating a NEW form — `formio-form` stays embed-only).

The trigger clause SHALL keep its framework-agnostic phrasing. This skill remains the entry point for an embed request that names no framework; what changed is that it checks the host before writing mounting code, per the host-check requirement.

#### Scenario: formio-form claims framework-agnostic embed phrasing

- **WHEN** the user says "embed this form in my web page" or "make the model field depend on the make field" with no framework named
- **THEN** the `formio-form` skill activates
- **AND** neither `formio-angular` nor `formio-application` activates

#### Scenario: Angular-explicit phrasing does NOT route through formio-form

- **WHEN** the user says "embed this form in my Angular app" or names `@formio/angular`
- **THEN** `formio-angular` activates
- **AND** `formio-form` does not activate

#### Scenario: React-explicit phrasing does NOT route through formio-form

- **WHEN** the user says "embed this form in my React app" or names `@formio/react`
- **THEN** `formio-react` activates and dispatches to its embed branch
- **AND** `formio-form` does not activate

#### Scenario: Create-a-new-form phrasing does NOT route through formio-form

- **WHEN** the user says "build a form" or "create a new survey" (no existing form to embed)
- **THEN** `formio-form-builder` activates
- **AND** `formio-form` does not activate

#### Scenario: Negative clause names every sibling

- **WHEN** the `formio-form` `SKILL.md` frontmatter is inspected
- **THEN** its `description` contains a `Not for:` clause containing the literal substrings `formio-angular`, `formio-react`, `formio-application`, `formio-resource-planner`, `formio-api`, `formio-sdk`, and the backtick-delimited `` `formio-form-builder` ``

### Requirement: Canonical inclusion modes are CDN and ESM only

Across `plugin/skills/formio-form/SKILL.md` and every `plugin/skills/formio-form/references/*.md`, form-renderer inclusion SHALL be documented in exactly two canonical modes:

- CDN: a `<script>` tag loading the renderer bundle `formio.form.min.js` from a version-pinned npm CDN path (`https://cdn.jsdelivr.net/npm/@formio/js@<MAJOR.MINOR.PATCH>/dist/formio.form.min.js`) plus the matching `formio.form.min.css` `<link>`, each carrying an `integrity="sha384-…"` digest and `crossorigin="anonymous"`, exposing the global `Formio`.
- ESM: exactly `import { Formio } from '@formio/js';`

The following SHALL NOT appear in any fenced code block: `from '@formio/core'` (any quote style), `from '@formio/js/lib/` (deep import), `require('@formio/js')`.

No `formio-form` document SHALL name the host `cdn.form.io`, load `@formio/js` from an unversioned CDN path, or script-load the builder bundle `formio.full.min.js`. A fixed vendor path serves whatever that host decides to serve for it and cannot be integrity-pinned, so whoever controls the host controls what executes on the page; and `formio-form` embeds forms rather than building them, so the builder bundle is weight the page never uses.

`setup.md` SHALL contain at least one occurrence of each canonical mode.

#### Scenario: setup.md documents both inclusion modes

- **WHEN** `plugin/skills/formio-form/references/setup.md` is inspected
- **THEN** it contains a fenced code block with a `<script>` tag loading `https://cdn.jsdelivr.net/npm/@formio/js@<MAJOR.MINOR.PATCH>/dist/formio.form.min.js` with an `integrity="sha384-…"` attribute and `crossorigin="anonymous"`, and the matching `formio.form.min.css` `<link>` pinned the same way
- **AND** it contains a fenced code block with exactly `import { Formio } from '@formio/js';`
- **AND** it documents the target container element (a `<div>` passed to `Formio.createForm`)
- **AND** it states how to recompute the digests when the version is bumped

#### Scenario: Unpinnable renderer URL fails review

- **WHEN** any `formio-form` document names `cdn.form.io`, loads `@formio/js` from a jsDelivr path with no `@<MAJOR.MINOR.PATCH>` segment, or script-loads `formio.full.min.js`
- **THEN** the change fails review and the tag is replaced with the version-pinned, integrity-pinned renderer pair

#### Scenario: Forbidden import present fails review

- **WHEN** any `formio-form` document contains `from '@formio/core'`, a `@formio/js/lib/` deep import, or `require('@formio/js')`
- **THEN** the change fails review and the import is replaced with a canonical mode

### Requirement: rendering.md covers URL, JSON, and submission pre-fill through one API

`references/rendering.md` SHALL document `Formio.createForm(element, srcOrJson, options)` with three input shapes, each with a runnable example:

1. A form URL (`https://<project>.form.io/<formPath>`), noting the returned promise resolves to the form instance.
2. An inline form JSON definition (a `components` array).
3. Submission pre-fill: setting `form.submission = { data: {...} }` after creation, AND rendering directly from a submission URL so the renderer loads the existing submission.

#### Scenario: Three rendering shapes documented

- **WHEN** `references/rendering.md` is inspected
- **THEN** it contains a fenced example calling `Formio.createForm` with a URL string
- **AND** a fenced example calling `Formio.createForm` with an inline object containing a `components` array
- **AND** a fenced example assigning `form.submission` with a `data` object
- **AND** a fenced example rendering from a submission URL

### Requirement: javascript-api.md documents form instance control

`references/javascript-api.md` SHALL document controlling a rendered form from JavaScript, including at minimum: the `change`, `submit`, `submitDone`, and `error` events via `form.on(...)`; reading and writing `form.submission`; `form.getComponent(key)`; and triggering submission programmatically.

#### Scenario: Event and instance API coverage

- **WHEN** `references/javascript-api.md` is inspected
- **THEN** it contains fenced examples registering handlers for `change` and `submit` events
- **AND** examples reading and setting `form.submission`
- **AND** an example using `form.getComponent`

### Requirement: options.md documents the renderer options object

`references/options.md` SHALL document the options object accepted as the third argument to `Formio.createForm`, covering at minimum `readOnly`, `noAlerts`, `hooks`, `i18n`, and `sanitizeConfig`, each with its effect stated and at least one combined usage example.

#### Scenario: Options coverage

- **WHEN** `references/options.md` is inspected
- **THEN** `readOnly`, `noAlerts`, `hooks`, `i18n`, and `sanitizeConfig` are each documented
- **AND** a fenced example passes an options object to `Formio.createForm`

### Requirement: JSON Logic shapes are documented once in json-logic.md and referenced by path

`references/json-logic.md` SHALL contain a JSON Logic primer scoped to renderer evaluation: the operations vocabulary (comparison, logic, numeric, array, string operations per jsonlogic.com), and how `var` resolves against `data` (the submission data) and `row` (the contextual row). The consumer documents (`conditionals.md`, `calculated-values.md`, `validation.md`, `field-logic.md`) SHALL reference `json-logic.md` by file path instead of duplicating the operations vocabulary.

#### Scenario: Primer exists and consumers reference it

- **WHEN** the `formio-form` reference documents are inspected
- **THEN** `json-logic.md` documents the JSON Logic operations vocabulary and `var` resolution against `data` and `row`
- **AND** `conditionals.md`, `calculated-values.md`, `validation.md`, and `field-logic.md` each contain the literal substring `json-logic.md`
- **AND** none of the four consumer documents re-lists the full operations vocabulary

### Requirement: validation.md documents the validate.json contract

`references/validation.md` SHALL document custom validation via the component's `validate.json` property: the JSON Logic expression receives the component value as `input` (via `{"var": "input"}`) and the submission data as `data`; evaluating to `true` means valid; evaluating to a string makes that string the validation error message. The canonical example SHALL be:

```json
{
  "validate": {
    "json": {
      "if": [
        { "===": [{ "var": "input" }, "Bob"] },
        true,
        "Your name must be 'Bob'!"
      ]
    }
  }
}
```

The document SHALL also state how `validate.json` composes with the standard `validate` keys (`required`, `minLength`, `pattern`, etc.).

#### Scenario: validate.json contract documented

- **WHEN** `references/validation.md` is inspected
- **THEN** it contains the canonical `validate.json` example above (an `if` returning `true` or an error string)
- **AND** it states that `{"var": "input"}` resolves to the component's value
- **AND** it states that a string result becomes the error message and `true` means valid

### Requirement: conditionals.md documents simple and JSON Logic conditionals

`references/conditionals.md` SHALL document both conditional mechanisms: the simple form (`conditional: { show, when, eq }`) and the JSON Logic form (`conditional: { json: ... }`), each with a runnable form-definition example showing one component's visibility driven by another component's value.

#### Scenario: Both conditional mechanisms documented

- **WHEN** `references/conditionals.md` is inspected
- **THEN** it contains a fenced example using `show`/`when`/`eq`
- **AND** a fenced example using `conditional.json` with a JSON Logic expression

### Requirement: calculated-values.md documents calculateValue

`references/calculated-values.md` SHALL document the `calculateValue` component property in its JSON Logic form, with a runnable example computing one field from others (e.g., a total from quantity and price), and SHALL document `allowCalculateOverride`.

#### Scenario: calculateValue documented

- **WHEN** `references/calculated-values.md` is inspected
- **THEN** it contains a fenced form-definition example where one component's `calculateValue` derives its value from other fields' data
- **AND** `allowCalculateOverride` is documented

### Requirement: field-logic.md documents component logic arrays

`references/field-logic.md` SHALL document the component `logic` array: trigger types (`simple`, `javascript`, `json`, `event`) and action types (property mutation, value setting, component schema merge), with at least one complete runnable example combining a trigger and an action.

#### Scenario: Logic triggers and actions documented

- **WHEN** `references/field-logic.md` is inspected
- **THEN** the four trigger types and the action types are each documented
- **AND** a fenced example shows a complete `logic` entry on a component

### Requirement: external-data.md documents external sources and cascading selects

`references/external-data.md` SHALL document: loading select options from an external URL data source, populating submission data from an externally fetched payload (load-and-set), and cascading/conditional selects where each select filters by its parent's value (the make → model → year pattern), including the `refreshOn`/`clearOnRefresh` behavior and lazy loading.

#### Scenario: Cascading select pattern documented

- **WHEN** `references/external-data.md` is inspected
- **THEN** it contains a runnable example of a select with a URL data source
- **AND** a cascading example where a child select's query depends on the parent select's value
- **AND** an example fetching external data and assigning it into `form.submission`

### Requirement: wizards.md documents conditional and custom wizards

`references/wizards.md` SHALL document the wizard display mode (`display: "wizard"`), conditional wizard pages (a page whose visibility depends on earlier answers), and custom wizard navigation driven from the JavaScript API (programmatic page changes and custom next/previous controls).

#### Scenario: Wizard coverage

- **WHEN** `references/wizards.md` is inspected
- **THEN** it documents `display: "wizard"`
- **AND** contains a conditional wizard page example
- **AND** contains a custom navigation example using the form instance's page API

### Requirement: SKILL.md includes an MCP Tool Preference section

`plugin/skills/formio-form/SKILL.md` SHALL include a `## MCP Tool Preference` section instructing Claude to prefer the MCP server's first-party tools (`form_get`, `form_update`, `authenticate`) when an embed task requires fetching or modifying the form definition, instead of ad-hoc HTTP requests, and stating that authentication uses the browser-based portal-login flow that captures a JWT attached as `x-jwt-token` (never PKCE or API keys).

#### Scenario: MCP Tool Preference present

- **WHEN** `plugin/skills/formio-form/SKILL.md` is inspected
- **THEN** it contains a `## MCP Tool Preference` heading
- **AND** the section names `form_get` and `authenticate`
- **AND** it contains the canonical portal-login JWT auth guidance (`x-jwt-token`, no PKCE, no API keys)

### Requirement: Terminology for URLs is strict

Across all `formio-form` documents, `baseUrl`/`base_url` SHALL refer only to `FORMIO_BASE_URL` and `projectUrl`/`project_url` SHALL refer only to `FORMIO_PROJECT_URL`. `setup.md` SHALL document Hosted vs SaaS URL configuration using these terms.

#### Scenario: URL terminology consistent

- **WHEN** any `formio-form` document mentions `baseUrl` or `projectUrl`
- **THEN** the usage is consistent with `FORMIO_BASE_URL` / `FORMIO_PROJECT_URL` respectively

### Requirement: Doc examples are verified by skill-tests

The repository SHALL contain Vitest tests under `packages/skill-tests/src/formio-form/` that execute the skill's documented example shapes against the real `@formio/js` in the package's DOM test environment. Minimum covered behaviors:

- `Formio.createForm` from an inline JSON definition resolves to a form instance
- Submission pre-fill via `form.submission` round-trips the data
- The `change` event fires when a value is set
- A `validate.json` rule marks an invalid value with the JSON Logic error string and passes a valid value
- `calculateValue` computes the derived field from its inputs
- `conditional.json` hides and shows the dependent component as the driver value changes
- A `display: "wizard"` form exposes page navigation

#### Scenario: skill-tests suite exists and passes

- **WHEN** `pnpm test` runs
- **THEN** `packages/skill-tests/src/formio-form/` contains test files covering the behaviors above
- **AND** all tests pass against the installed `@formio/js`

#### Scenario: validate.json behavior verified

- **WHEN** the validation test sets the component value to something other than the required value
- **THEN** the form reports the JSON Logic error string from the doc example
- **AND** setting the required value clears the error

### Requirement: formio-form routes not-yet-existing forms to formio-form-builder

When an embed request reveals that the form to embed does not exist yet in the user's Form.io project, or the user describes a complex form needing form-type determination (webform vs wizard vs PDF form) before any embedding can happen, the `formio-form` skill SHALL route to the `formio-form-builder` skill to create the form first. After `formio-form-builder` saves the form, embedding proceeds via its EMBED handoff back to `formio-form`.

#### Scenario: Embed request for a nonexistent form

- **WHEN** `formio-form` is active and the form the user wants to embed does not exist in the project
- **THEN** `formio-form` routes to `formio-form-builder` to create and save the form
- **AND** embedding resumes with the saved form URL

#### Scenario: Complex form described inside an embed request

- **WHEN** the user asks to embed a form they describe from scratch (e.g., "embed a multi-step intake wizard on my page" with no existing form)
- **THEN** `formio-form` routes to `formio-form-builder` for form-type determination and creation before any embedding

### Requirement: formio-form trigger clause uses embed verbs only

The `formio-form` `SKILL.md` frontmatter `description` trigger clause SHALL pair no build/create verbs with new-form nouns — phrases like "build a conditional wizard" SHALL be phrased with embed verbs instead ("make an embedded wizard conditional", "conditional wizard pages"). The spec-mandated `conditional wizard` substring remains. Creation intents stay with `formio-form-builder` (already named in the `Not for:` clause); this skill's verbs are embed, render, add-to-page, pre-fill, show/hide, calculate, validate.

#### Scenario: No build-verb new-form phrases in the trigger clause

- **WHEN** the `formio-form` `SKILL.md` frontmatter trigger clause is inspected
- **THEN** it contains no "build a"/"create a" phrase applied to a form, wizard, or survey noun
- **AND** it still contains the substring `conditional wizard`

#### Scenario: Conditional-wizard embed phrasing routes to formio-form

- **WHEN** the user says "make the second page of my embedded wizard conditional"
- **THEN** `formio-form` activates
- **AND** `formio-form-builder` does not activate

### Requirement: formio-form checks the host before writing mounting code

`formio-form` documents the Vanilla JS renderer, and its mounting guidance — `Formio.createForm(element, srcOrJson, options)` against a DOM element — is the wrong shape inside a component framework that ships its own renderer wrapper. An explicitly framework-named request never reaches this skill, because description matching routes it to the framework skill. The request that does reach it is the one that names no framework: "embed this form in my app", issued from inside a React workspace.

Before writing mounting code, `formio-form` SHALL therefore determine the host application. When the working directory is a React application — `react` in `package.json` dependencies — it SHALL hand off to `formio-react`'s embed branch rather than emitting `Formio.createForm` guidance, saying in one line why. This SHALL be a single step, not a framework dispatch table with per-framework branch documents; the routing table lives in the framework skills' own descriptions.

This check applies ONLY to the mounting half. A question about a form definition — a conditional, a calculated value, a validation rule, a cascading select, wizard page logic — SHALL be answered here regardless of host, because the answer is identical in every framework.

When the host is Angular, `formio-form` SHALL note that `@formio/angular` ships its own renderer component and that a dedicated Angular embedding skill does not exist yet, then continue with the Vanilla JS guidance, which does work inside an Angular application. It SHALL NOT claim the Vanilla JS path is the recommended Angular approach.

The check SHALL be cheap and SHALL NOT become an interview: when the host is not detectable from the workspace, `formio-form` proceeds with its own guidance rather than asking.

#### Scenario: Unqualified embed request in a React workspace hands off

- **WHEN** the user says "embed this form in my app" and `package.json` lists `react`
- **THEN** `formio-form` hands off to `formio-react`'s embed branch
- **AND** it states in one line why it routed there
- **AND** it does not emit `Formio.createForm` mounting guidance

#### Scenario: Plain page keeps the Vanilla JS path

- **WHEN** the workspace is not a component-framework application
- **THEN** `formio-form` proceeds with its own mounting guidance and hands off to nothing

#### Scenario: Field-behavior questions are answered here whatever the host

- **WHEN** the user asks how to hide one field based on another, from inside a React workspace
- **THEN** `formio-form` answers from its conditionals reference
- **AND** it does not hand off

#### Scenario: Angular host is told the truth

- **WHEN** the workspace is an Angular application and the request names no framework
- **THEN** `formio-form` notes that `@formio/angular` ships its own renderer component and that no Angular embedding skill exists yet
- **AND** it continues with the Vanilla JS guidance without presenting it as the recommended Angular approach

#### Scenario: Undetectable host does not trigger an interview

- **WHEN** the host cannot be determined from the workspace
- **THEN** `formio-form` proceeds with its own guidance without asking the user

### Requirement: formio-form owns definition-level behavior for every framework

`formio-form` SHALL remain the single home for behavior that lives in the form definition rather than in the host: conditionals, `calculateValue`, `validate.json`, component `logic` arrays, external data sources and cascading selects, wizard page logic, and the JSON Logic primer.

Framework embedding skills SHALL link to these references rather than restating them. A framework skill that duplicates this content creates a second copy that drifts from the first, and the content does not vary by framework — the definition is evaluated by the same renderer core whatever mounts it.

#### Scenario: Framework skills carry no duplicate behavior content

- **WHEN** any framework embedding skill's references are inspected
- **THEN** none documents `calculateValue`, `validate.json`, component `logic`, conditional syntax, cascading selects, or the JSON Logic primer
- **AND** each links to the corresponding `formio-form` reference
