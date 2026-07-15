## ADDED Requirements

### Requirement: New skill `formio-form-builder` exists as the library's build-a-form orchestrator

The skills library SHALL contain a new orchestrator skill at `plugin/skills/formio-form-builder/SKILL.md` with frontmatter `name: formio-form-builder`. The skill directory SHALL follow the `formio-application` orchestrator layout — root-level uppercase step docs, NOT a `references/` directory — containing exactly the following step docs, none of which begin with a YAML frontmatter block:

- `FORM_TYPES.md` — the form-type reference (webform vs wizard vs PDF form)
- `INTENT.md` — the batched intent interview script
- `SAVE.md` — the `form_create` invocation and error handling
- `EMBED.md` — the conditional embed handoff contract
- `PDF_FORM.md` — the agent-enriched PDF pipeline (analyze, upload, enrich, gate, save)

A symlink `.claude/skills/formio-form-builder` SHALL exist and resolve to `plugin/skills/formio-form-builder/`.

#### Scenario: formio-form-builder directory layout

- **WHEN** the repository is inspected
- **THEN** `plugin/skills/formio-form-builder/SKILL.md` exists with frontmatter `name: formio-form-builder` and a non-empty `description`
- **AND** `FORM_TYPES.md`, `INTENT.md`, `SAVE.md`, `EMBED.md`, and `PDF_FORM.md` exist in the skill directory and are non-empty
- **AND** no step doc's first line is `---`
- **AND** the skill directory contains no `references/` directory
- **AND** `.claude/skills/formio-form-builder` resolves to `plugin/skills/formio-form-builder/`

### Requirement: formio-form-builder description uses the three-clause template and states the form-vs-resource boundary

The `formio-form-builder` `SKILL.md` frontmatter `description` SHALL contain three clauses:

1. A capability statement: an orchestrator that builds a single Form.io form end to end — determines the form type (webform, wizard, or PDF form), delegates schema authoring, saves the form into the user's Form.io project via the MCP server, and optionally hands off to embedding.
2. A trigger clause beginning with the substring `Use when the user asks to` claiming single-form creation intents. Example triggers the description MUST claim include: "build a form", "create a form", "I would like a new form", "multi-page form", "build a wizard", "create a survey", "contact form", "intake form", "registration form", "questionnaire", "pdf form".
3. A negative-trigger clause beginning with the substring `Not for:` that names ALL of: `formio-form` (embedding an EXISTING form), `formio-application` (building a whole app, portal, or tracker), `formio-resource-planner` (designing resources, data models, or permissions), `formio-schema` (raw form JSON schema lookups without the build-and-save flow), and `formio-api` (Form.io REST endpoint lookups).

The description SHALL additionally state the form-vs-resource boundary rule explicitly: "build a form to collect X" (a standalone form) belongs to this skill, while "track X / manage X / build an app around X" (a data model, CRUD, resources) belongs to `formio-application` / `formio-resource-planner`.

#### Scenario: formio-form-builder claims single-form creation phrasing

- **WHEN** the user says "build me a form to collect customer feedback" or "create a multi-page registration wizard"
- **THEN** the `formio-form-builder` skill activates
- **AND** neither `formio-application` nor `formio-resource-planner` activates

#### Scenario: App and data-model phrasing does NOT route through formio-form-builder

- **WHEN** the user says "build me an app to track maintenance requests" or "model customers and orders"
- **THEN** `formio-application` (or `formio-resource-planner`) activates
- **AND** `formio-form-builder` does not activate

#### Scenario: Negative clause names every sibling

- **WHEN** the `formio-form-builder` `SKILL.md` frontmatter is inspected
- **THEN** its `description` contains a `Not for:` clause containing the backtick-delimited names `` `formio-form` ``, `` `formio-application` ``, `` `formio-resource-planner` ``, `` `formio-schema` ``, and `` `formio-api` ``

#### Scenario: Boundary rule stated verbatim

- **WHEN** the `formio-form-builder` `SKILL.md` frontmatter is inspected
- **THEN** its `description` states that standalone form-collection requests belong to this skill and data-model / app-around-data requests belong to `formio-application` / `formio-resource-planner`

### Requirement: INTENT runs a single batched interview capturing form type and embed intent

`INTENT.md` SHALL script a single batched `AskUserQuestion` interview (one call, mirroring `formio-application`'s INTENT step) that captures:

1. **Form type** — `webform` (single-page form), `wizard` (multi-page form), or `pdf` form. The script SHALL instruct the agent to infer the type from phrasing when unambiguous (e.g., "multi-page form" ⇒ wizard, "pdf form" ⇒ pdf) and present the inference as the recommended option to confirm, and to ask openly when ambiguous. The distinguishing signals SHALL be sourced from `FORM_TYPES.md`, referenced by file path.
2. **Embed intent** — whether the user wants the form embedded in an application afterward, or only created in their Form.io project. The EMBED step SHALL fire ONLY on an explicit yes; any other answer ends the flow at SAVE.

#### Scenario: One batched question, two intents

- **WHEN** `INTENT.md` is inspected
- **THEN** it scripts a single `AskUserQuestion` call capturing both the form type and the embed intent
- **AND** it instructs inferring the form type from unambiguous phrasing and confirming, asking only when ambiguous

#### Scenario: Standalone request stays fast

- **WHEN** the user asks "make me a survey" and answers that no embedding is wanted
- **THEN** the flow runs INTENT → SCHEMA → SAVE and ends after confirming the saved form URL
- **AND** the EMBED step does not run

#### Scenario: Embed fires only on explicit yes

- **WHEN** the user's embed answer is anything other than an explicit yes
- **THEN** the EMBED handoff does not fire

### Requirement: FORM_TYPES.md documents the three form types from the official docs

`FORM_TYPES.md` SHALL document, for each of the three Form.io form types — webform (single-page form), wizard (multi-page form), and PDF form — what it is, what it can do, when to choose it, and the phrasing signals the INTENT step uses to distinguish them. The wizard section SHALL cover nested wizard workflows (child wizards for complex multi-page flows). The PDF form section SHALL state the PDF-document prerequisite (a PDF form renders over an uploaded/hosted PDF document) rather than promising server-side PDF conversion. Content SHALL be authored from the official help.form.io documentation (form types, PDF forms, nested wizard workflow).

#### Scenario: All three form types covered

- **WHEN** `FORM_TYPES.md` is inspected
- **THEN** webform, wizard, and PDF form are each documented with capabilities, when-to-choose guidance, and INTENT distinguishing signals

#### Scenario: Nested wizards covered

- **WHEN** `FORM_TYPES.md` is inspected
- **THEN** the wizard section documents nested/child wizard workflows

### Requirement: SCHEMA delegates entirely to formio-schema with no duplication

The SCHEMA step SHALL delegate component selection and authoring of the complete form JSON definition for the requested form type to the `formio-schema` skill, referenced by name. No `formio-form-builder` document SHALL duplicate component or schema documentation (component JSON shapes, component property tables, or schema authoring guidance) — those live only in `formio-schema`. Likewise, embed guidance SHALL NOT be duplicated — `EMBED.md` references the `formio-form` skill by name for all embedding mechanics.

#### Scenario: Schema authoring routes through formio-schema

- **WHEN** the flow reaches the SCHEMA step
- **THEN** the agent invokes the `formio-schema` skill to select components and author the form JSON for the confirmed form type

#### Scenario: No duplicated shapes

- **WHEN** any `formio-form-builder` document is inspected
- **THEN** it contains no component JSON shape documentation and no embed mechanics, referencing `formio-schema` and `formio-form` by name instead

### Requirement: SAVE persists via form_create and handles auth through the portal-login flow

`SAVE.md` SHALL script the SAVE step: an approval gate summarizing the form (title, path, type) and target project before the call; invoking the MCP server's `form_create` tool with the authored definition; on success, confirming the saved form path and full form URL (`{FORMIO_PROJECT_URL}/{formPath}`) back to the user. On an authentication error, the script SHALL direct the flow through the `authenticate` portal-login flow — the browser-based login that captures a JWT attached as `x-jwt-token` — and retry; PKCE and API keys SHALL NOT be used or mentioned as alternatives. No MCP server changes are required — `form_create` already exists and already instructs use of `formio-schema`.

#### Scenario: Saved form confirmed by URL

- **WHEN** `form_create` succeeds
- **THEN** the user is shown the saved form's path and its full form URL under `FORMIO_PROJECT_URL`

#### Scenario: Auth error routes through authenticate

- **WHEN** `form_create` returns an authentication error
- **THEN** `SAVE.md` directs the agent through the `authenticate` portal-login flow (`x-jwt-token`) and retries the save
- **AND** neither PKCE nor API keys appear as an auth mechanism in any `formio-form-builder` document

### Requirement: EMBED conditionally hands off to formio-form

`EMBED.md` SHALL define the conditional handoff contract, executed ONLY when the user answered an explicit yes to embed intent at INTENT: hand off to the `formio-form` skill to embed the saved form by its form URL in the user's application. When no framework was named, `formio-form` handles the embedding; Angular-explicit requests route through `formio-angular` per the library's existing routing rules. The handoff SHALL pass at minimum the saved form URL.

#### Scenario: Embed handoff on yes

- **WHEN** the user answered yes to embed intent and SAVE succeeded
- **THEN** the flow hands off to `formio-form` with the saved form URL

#### Scenario: Angular-explicit embed routes to formio-angular

- **WHEN** the user answered yes to embed intent and explicitly named Angular or `@formio/angular`
- **THEN** the handoff routes through `formio-angular` instead of `formio-form`

### Requirement: SKILL.md includes an MCP Tool Preference section

`plugin/skills/formio-form-builder/SKILL.md` SHALL include a `## MCP Tool Preference` section instructing Claude to prefer the MCP server's first-party tools — `form_create`, `form_get`, `pdf_upload`, and `authenticate` — over ad-hoc HTTP requests, and stating that authentication uses the browser-based portal-login flow that captures a JWT attached as `x-jwt-token` on every request (never PKCE or API keys).

#### Scenario: MCP Tool Preference present

- **WHEN** `plugin/skills/formio-form-builder/SKILL.md` is inspected
- **THEN** it contains a `## MCP Tool Preference` heading
- **AND** the section names `form_create`, `form_get`, `pdf_upload`, and `authenticate`
- **AND** it contains the canonical portal-login JWT auth guidance (`x-jwt-token`, no PKCE, no API keys)

### Requirement: Terminology for URLs is strict

Across all `formio-form-builder` documents, `baseUrl`/`base_url` SHALL refer only to `FORMIO_BASE_URL` and `projectUrl`/`project_url` SHALL refer only to `FORMIO_PROJECT_URL`.

#### Scenario: URL terminology consistent

- **WHEN** any `formio-form-builder` document mentions `baseUrl` or `projectUrl`
- **THEN** the usage is consistent with `FORMIO_BASE_URL` / `FORMIO_PROJECT_URL` respectively

### Requirement: Structural tests verify the authoring contract with substring-safe matching

The repository SHALL contain Vitest tests under `packages/skill-tests/src/formio-form-builder/` following the `formio-form` skill-structure.test.ts pattern, asserting: the frontmatter (`name: formio-form-builder`, non-empty description); the three-clause description including all five `Not for:` names and the form-vs-resource boundary rule; the four step docs present, non-empty, and frontmatter-free; the `## MCP Tool Preference` section naming `form_create`, `form_get`, `authenticate`, and `x-jwt-token`; the dev symlink resolution; and the sibling reverse pointers (`formio-application`, `formio-resource-planner`, and `formio-form` descriptions each name `formio-form-builder` in a `Not for:` clause). Because `formio-form-builder` contains the substring `formio-form`, every assertion distinguishing the two names SHALL match backtick-delimited names (`` `formio-form` `` vs `` `formio-form-builder` ``) or an equivalent word-boundary pattern — plain substring matching SHALL NOT be used where the two names could be confused. Flow behavior itself is prose/orchestration; no renderer behavior tests are required.

#### Scenario: Structural test suite exists and passes

- **WHEN** `pnpm test` runs
- **THEN** `packages/skill-tests/src/formio-form-builder/` contains structural tests covering the assertions above
- **AND** all tests pass

#### Scenario: Name matching is substring-safe

- **WHEN** a structural assertion distinguishes `formio-form` from `formio-form-builder`
- **THEN** it matches backtick-delimited names or a word-boundary pattern, not a plain substring

### Requirement: PDF_FORM.md documents the agent-enriched PDF pipeline

`PDF_FORM.md` SHALL script the PDF lane of the orchestrator, entered from INTENT's pdf branch, as the following pipeline:

1. **Collect** — ask for the local path to the PDF document.
2. **Preflight** — verify the PDF contains AcroForm fields before anything else. When it does not (flat or scanned PDFs), the doc SHALL declare field enrichment unsupported and offer exactly two off-ramps: a plain `display: "pdf"` form without enrichment, or stopping.
3. **Analyze** — two passes: a deterministic script dump of the AcroForm definitions (field name, type, required flag, options, tooltip, page, rect) and a visual pass reading the rendered pages for label text, required markers, and conditional language.
4. **Upload** — call the `pdf_upload` MCP tool; stash `path`, `file`, and `formfields.components` from the response.
5. **Enrich** — match converted components to the analysis (AcroForm name, page/rect as tiebreaker) and rewrite `label`, assign clean unique keys, set `validate` rules, map options, and add `conditional`s inferred from the document language. The doc SHALL state that `overlay` values are copied through unmodified — never edited.
6. **Gate** — a mandatory approval table (AcroForm name → proposed label / key / validation / condition) before any save; unmatched or low-confidence fields SHALL be left unenriched and flagged rather than guessed. A declined gate saves nothing.
7. **Save** — `form_create` with `display: "pdf"`, `settings.pdf` built from the upload response, and the enriched components, followed by the standard SAVE confirmation and the EMBED conditional.

`PDF_FORM.md` SHALL reference `formio-api/references/pdf-api.md` by path for all PDF endpoint details and SHALL NOT restate endpoint request/response shapes; component JSON guidance SHALL continue to defer to `formio-schema` by name.

#### Scenario: Pipeline documented end to end

- **WHEN** `PDF_FORM.md` is inspected
- **THEN** it documents the preflight AcroForm check with the flat-PDF off-ramps
- **AND** both analysis passes (structural script dump and visual read)
- **AND** the `pdf_upload` call and the enrichment step
- **AND** it states that `overlay` values are never modified
- **AND** it scripts the approval gate before `form_create`

#### Scenario: No endpoint duplication

- **WHEN** `PDF_FORM.md` is inspected
- **THEN** it contains the literal substring `pdf-api.md`
- **AND** it does not restate the upload endpoint's request/response shapes

#### Scenario: Enrichment before creation

- **WHEN** the user approves the gate
- **THEN** the form is created once, already enriched, via `form_create`
- **AND** no unenriched intermediate form is saved to the project

### Requirement: INTENT's pdf branch routes into PDF_FORM.md

When INTENT captures `formType: pdf`, the flow SHALL route to `PDF_FORM.md` (which subsumes the SCHEMA and SAVE steps for the PDF lane). `INTENT.md` SHALL reference `PDF_FORM.md` by path for this branch, and `FORM_TYPES.md`'s PDF section SHALL state that the skill performs the upload and enrichment itself via `PDF_FORM.md` rather than only stating the PDF-document prerequisite.

#### Scenario: pdf routes to the PDF lane

- **WHEN** the INTENT interview confirms the pdf form type
- **THEN** the flow continues in `PDF_FORM.md`
- **AND** `INTENT.md` contains the literal substring `PDF_FORM.md`

#### Scenario: FORM_TYPES points at the lane

- **WHEN** `plugin/skills/formio-form-builder/FORM_TYPES.md` is inspected
- **THEN** its PDF section contains the literal substring `PDF_FORM.md`
