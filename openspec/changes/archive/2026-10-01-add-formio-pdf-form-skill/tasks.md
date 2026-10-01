## 1. formioFetch FormData support

<!-- depends_on: none -->

### Red

- [x] 1.1 Write failing client tests (mocked `fetch`, existing `formio-client.test.ts` pattern): a `FormData` body reaches `fetch` as the same instance; no `Content-Type` header is set for it; the auth header is attached; JSON bodies still send `Content-Type: application/json` and the serialized body
- [x] 1.2 Write failing test: a 401 on a `FormData` request in JWT mode re-authenticates and retries once with the same `FormData` instance

### Green

- [x] 1.3 Handle a `FormData` body in `buildFetchInit` in `packages/mcp-server/src/formio-client.ts`; type `FormioFetchOptions.body` without `any`

### Refactor

- [x] 1.4 Review implementation and refactor as needed

## 2. pdf_upload tool

<!-- depends_on: 1 -->

### Red

- [x] 2.1 Write failing unit tests for a pure `derivePdfSettings({ projectUrl, response })`: hosted (`https://examples.form.io` → `https://examples.form.io/pdf-proxy{path}`), sub-directory (`https://forms.mysite.com/myproject` → origin `https://forms.mysite.com`), and `filesServer` present (`{filesServer}{path}`); `id` equals `file`
- [x] 2.2 Write failing tool tests: registration with the standard `cwd` and a required `filePath`, description containing `formio-pdf-form` and `settings.pdf`
- [x] 2.3 Write failing test: happy path — a temp file beginning `%PDF-` produces exactly one `POST {projectUrl}/upload` with a multipart `file` part named after the file; the result contains the response verbatim (every `overlay` intact, `nonFillableConversionUsed` when present) plus the derived `pdf`
- [x] 2.4 Write failing tests: missing file and non-`%PDF-` file each return an MCP error and issue no request; a `400` from the server surfaces as an MCP error containing the status and URL
- [x] 2.5 Write failing test: no source under `packages/mcp-server/src/` contains `pdf-proxy/upload`
- [x] 2.6 Write failing unit tests for a pure `readAcroformFields({ bytes, components })` over hand-built fixture PDFs: a text field `f1_01[0]` with `/TU (First name)` and `/Ff 2` yields `{ name, tooltip: "First name", required: true, readOnly: false, componentKeys: ["f1010"] }`; a two-button radio group `contactPref` yields `componentKeys: ["contactPref", "contactPref_1"]`; a field whose derived key is absent yields `[]`; an encrypted PDF yields `acroform: null` plus `acroformError` while the upload still succeeds; no entry carries `rect` or `page`
- [x] 2.7 Write failing tool test: the happy-path result carries `acroform.fields` beside the verbatim response and the derived `pdf`

### Green

- [x] 2.8 Add `pdf-lib` to `packages/mcp-server/package.json`; implement `readAcroformFields` (fields from `doc.catalog.getAcroForm()`, encrypted documents skipped), `derivePdfSettings`, and `packages/mcp-server/src/tools/pdf_upload.ts` (modelled on `form_create.ts`); register in `tools/index.ts`

### Refactor

- [x] 2.9 Review implementation and refactor as needed

## 3. formio-pdf-form skill — layout, description, preamble

<!-- depends_on: none -->

### Red

- [x] 3.1 Write failing tests in `packages/skill-tests/src/formio-pdf-form/skill-structure.test.ts`: `SKILL.md` with `name: formio-pdf-form`; the six references exist, non-empty, frontmatter-free; `.claude/skills/formio-pdf-form` resolves; no `evals/` under the skill
- [x] 3.2 Write failing tests: description ≤ 1,024 characters, contains `Use when the user asks to`, claims the PDF-first example triggers, and its `Not for:` names `formio-form-builder`, `formio-form`, `formio-schema`, `formio-api`
- [x] 3.3 Step the hard-coded skill counts (`gatedSkillMd()` 15 → 16 in `no-install-commands-in-skills.test.ts` and `preflight-blocking-scope.test.ts`; `allSkillMd()` 16 → 17 and `probingSkillMd()` 14 → 15 in `project-config-preflight.test.ts`); add the new `SKILL.md` to `security-section-convention.test.ts`
- [x] 3.4 Add `collision-guards.test.ts` cases: `formio-form-builder`'s trigger clause claims no PDF-document phrasing and its `Not for:` names `` `formio-pdf-form` ``; `formio-form`'s `Not for:` names `` `formio-pdf-form` ``; `formio-pdf-form` claims no bare "build a form" / "embed a form" phrasing

### Green

- [x] 3.5 Create `plugin/skills/formio-pdf-form/SKILL.md` — frontmatter, preflight, never-work-around, `project_get` resolution, lane table, overlay provenance rule, license-failure rule, URL terminology, Security, MCP Tool Preference — and the reference stubs; add the symlink and the `CLAUDE.md` / README / manifest listings

### Refactor

- [x] 3.6 Review implementation and refactor as needed; unwrap edited markdown per `CLAUDE.md` (none of these files carries a markdown fence)

## 4. Build lane and enrichment rules

<!-- depends_on: 2, 3 -->

### Red

- [x] 4.1 Write failing tests over `references/build.md`: collect → inspect → upload → classify → enrich → gate → save appear in order; inspect permits an already-available PDF-processing skill and nothing in the skill installs, offers to install, or names an install command for one; names `pdf_upload` and `form_create`; documents the three conversion classes, `nonFillableConversionUsed`, and the two empty-conversion off-ramps; states create-once and declined-gate-saves-nothing
- [x] 4.2 Write failing tests over `references/enrich.md`: label precedence (server label → `acroform` tooltip → visual), required precedence (conversion → `acroform` → visual marker), key, type, validation, options, radio-group (kept as `checkbox` + `inputType: "radio"` + shared `name`), conditionals, unmatched rules present; the fourteen allow-listed types listed and the `hidden` downgrade stated; overlay provenance stated in `enrich.md` and `SKILL.md`; the gate table columns present
- [x] 4.3 Write failing library-wide tests over `plugin/skills/formio-pdf-form/`: no package-install command; no conditional / `validate.json` / `calculateValue` syntax of its own, with resolving links into `formio-form/references/`; no `pdf-proxy/upload`

### Green

- [x] 4.4 Author `references/build.md` and `references/enrich.md` from the design's Context table

### Refactor

- [x] 4.5 Review implementation and refactor as needed

## 5. Existing-form and PDF template lanes

<!-- depends_on: 4 -->

### Red

- [x] 5.1 Write failing tests over `references/existing-form.md`: enrich and replace variants; keys kept by default; replace takes the new conversion's overlays and the new `settings.pdf`; unmatched existing components resolved as remove-or-`hidden`; states that portal re-upload does not remap overlays
- [x] 5.2 Write failing tests over `references/pdf-template.md`: targets non-PDF forms without `settings.pdf` only; states that a saved template changes every download immediately; `pdfComponents` with `components` untouched; the skip-list and data-component-children rule; the eight-property prune with its reason; availability stated without gating; `format=html` preview

### Green

- [x] 5.3 Author `references/existing-form.md` and `references/pdf-template.md`

### Refactor

- [x] 5.4 Review implementation and refactor as needed

## 6. Render and download lanes

<!-- depends_on: 3 -->

### Red

- [x] 6.1 Write failing tests over `references/render.md`: links `formio-form`'s rendering reference; documents the iframe source, `zoom`, `readOnly`, the renderer's submit button, the message-origin rule, the allow-list downgrade
- [x] 6.2 Write failing tests over `references/download.md`: runtime framing; links `formio-sdk`'s submissions reference and `pdf-api.md`; names `margin`, `pageSize`, `orientation`, `language`, `format`; states the token is per-request and never stored

### Green

- [x] 6.3 Author `references/render.md` and `references/download.md`

### Refactor

- [x] 6.4 Review implementation and refactor as needed

## 7. Neighbor skills

<!-- depends_on: 3 -->

### Red

- [x] 7.1 Rewrite `formio-form-builder/step-docs.test.ts`'s PDF-prerequisite assertion: `FORM_TYPES.md`'s PDF section contains `formio-pdf-form` and no `radio`; `INTENT.md` hands the pdf answer to `formio-pdf-form` and describes no pipeline
- [x] 7.2 Write failing `formio-form` tests: `SKILL.md` links `formio-pdf-form`'s render reference for `display: "pdf"` and routes an unconverted PDF to `formio-pdf-form`
- [x] 7.3 Write failing `formio-schema` tests: `overlay` documents `page`; `form-definition.md` documents `settings.pdf` and `pdfComponents` with the eight-property contract
- [x] 7.4 Write failing `packages/skill-tests/src/formio-api/` tests: no markdown under `plugin/skills/` contains `pdf-proxy/upload`, `pdf-proxy/form`, or `pdf-proxy/token`; `pdf-api.md` contains `{projectUrl}/upload`, `{projectUrl}/token`, `nonFillableConversionUsed`, and `margin`, and its Tool Preference names `pdf_upload`
- [x] 7.5 Change `validate-library.test.ts`'s PDF-scope cases: `### POST {projectUrl}/upload` and `### GET {projectUrl}/token` pass; a heading on a PDF server's own host still emits `pdf.proxy_path`

### Green

- [x] 7.6 Edit `formio-form-builder` (`SKILL.md` description, `INTENT.md`, `FORM_TYPES.md`), `formio-form/SKILL.md`, `formio-schema` form references, and `formio-api/references/pdf-api.md`; relax `validatePdfProxyPath` in `packages/skill-tests/src/library-validation/validate-library.ts` to accept any `{projectUrl}/` path

### Refactor

- [x] 7.7 Review implementation and refactor as needed; unwrap only the edited paths

## 8. Definition of Done

<!-- depends_on: 1, 2, 3, 4, 5, 6, 7 -->

### Red

- [x] 8.0 Re-run the live probes from `design.md`'s Context table against a local deployment (upload routes, conversion shape, portal-saved `settings.pdf`, `pdfComponents` swap, token route, download auth) and record any drift in `design.md`
- [x] 8.1 Run `pnpm test` and capture failures; rebuild the plugin and confirm the bundled server lists `pdf_upload`

### Green

- [x] 8.2 Fix failures; `pnpm test`, `pnpm lint`, and `pnpm format` pass clean; `openspec validate add-formio-pdf-form-skill --strict` passes

### Refactor

- [x] 8.3 Review implementation and refactor as needed
