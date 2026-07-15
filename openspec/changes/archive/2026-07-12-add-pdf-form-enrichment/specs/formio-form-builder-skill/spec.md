## MODIFIED Requirements

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

### Requirement: SKILL.md includes an MCP Tool Preference section

`plugin/skills/formio-form-builder/SKILL.md` SHALL include a `## MCP Tool Preference` section instructing Claude to prefer the MCP server's first-party tools — `form_create`, `form_get`, `pdf_upload`, and `authenticate` — over ad-hoc HTTP requests, and stating that authentication uses the browser-based portal-login flow that captures a JWT attached as `x-jwt-token` on every request (never PKCE or API keys).

#### Scenario: MCP Tool Preference present

- **WHEN** `plugin/skills/formio-form-builder/SKILL.md` is inspected
- **THEN** it contains a `## MCP Tool Preference` heading
- **AND** the section names `form_create`, `form_get`, `pdf_upload`, and `authenticate`
- **AND** it contains the canonical portal-login JWT auth guidance (`x-jwt-token`, no PKCE, no API keys)

## ADDED Requirements

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
