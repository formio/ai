# Add PDF form enrichment (`pdf_upload` tool + agent-enriched conversion)

## Why

The `formio-form-builder` PDF branch today stops at "upload your PDF through the portal" — the server's AcroForm auto-conversion produces components with raw machine labels (`f1_01[0]`, `topmostSubform[0].Page1[0]…`), no validations, and no conditionals, and the agent plays no part. The agent can do dramatically better: it can read the PDF (visually via the Read tool and structurally via an AcroForm dump), upload it through a first-party tool, and enrich the server's converted components — correct human labels, `validate` rules, and `conditional`s inferred from the document's own language — before the form is saved. No MCP tool covers the PDF upload today (`pdf-api.md` says "use the HTTP endpoint directly"), which also violates the library's prefer-first-party-tools convention the moment a skill automates this flow.

## What Changes

- **New MCP tool `pdf_upload`** — uploads a local PDF file as `multipart/form-data` to `POST {FORMIO_PROJECT_URL}/pdf-proxy/upload` via `formioFetch` (portal-login JWT, `x-jwt-token`), returning the server response verbatim: `path`, `file` (UUID), and `formfields.components` (the auto-converted component skeleton with `overlay` geometry). Tool description points the LLM at the `formio-form-builder` enrichment flow.
- **`formioFetch` multipart support** — `buildFetchInit` accepts a `FormData` body: no JSON serialization, no explicit `Content-Type` (fetch sets the boundary). Existing JSON behavior and the 401 re-auth retry are unchanged and apply to multipart requests too.
- **New step doc `plugin/skills/formio-form-builder/PDF_FORM.md`** — the pdf lane of the orchestrator, entered from INTENT's pdf branch:
  1. **Collect** — ask for the PDF file path.
  2. **Preflight** — verify the PDF has AcroForm fields; flat/scanned PDFs are declared unsupported for enrichment (offer a plain `display: "pdf"` form without field enrichment, or bail).
  3. **Analyze** — two passes: a deterministic script dump of AcroForm definitions (field name, type, required flag, options, tooltip, page, rect) and a visual Read pass over the rendered pages for labels, "required" markers, and conditional language ("If yes, complete Section B").
  4. **Upload** — call `pdf_upload`; keep `path`, `file`, and `formfields.components`.
  5. **Enrich** — match converted components to the analysis (AcroForm name + page/rect), rewrite labels and keys, add `validate` rules and `conditional`s. `overlay` geometry is NEVER modified.
  6. **Gate** — approval table (field → proposed label / validation / condition) before any save; inference is heuristic and the user confirms it.
  7. **Save** — `form_create` with `display: "pdf"`, `settings.pdf` from the upload response, and the enriched components; then the standard SAVE confirmation.
- `formio-form-builder` updates: INTENT's pdf branch routes to `PDF_FORM.md`; the step-doc layout gains `PDF_FORM.md`; the MCP Tool Preference section adds `pdf_upload`; `FORM_TYPES.md`'s PDF section points at the new lane. No endpoint shapes are duplicated — `PDF_FORM.md` references `formio-api/references/pdf-api.md` by path for the PDF API surface, and component JSON guidance stays in `formio-schema`.
- `pdf-api.md`'s upload endpoint MCP Tool Preference is updated to name `pdf_upload` instead of "No MCP tool covers this operation".

## Capabilities

### New Capabilities

- `pdf-upload`: The `pdf_upload` MCP tool — registration and description (referencing the `formio-form-builder` enrichment flow), input schema (`cwd`, `filePath`), multipart POST to `{FORMIO_PROJECT_URL}/pdf-proxy/upload`, verbatim response passthrough (`path`, `file`, `formfields`), error handling (bad file path, non-PDF 400, auth 401 with portal-login retry), and the `pdf-api.md` reference's MCP Tool Preference update.

### Modified Capabilities

- `formio-client`: `formioFetch`/`buildFetchInit` additionally accept a `FormData` body — sent unserialized without an explicit `Content-Type` header; JSON bodies and the 401 re-auth retry behave as before.
- `formio-form-builder-skill`: the step-doc layout gains `PDF_FORM.md`; INTENT's pdf branch routes into it; the MCP Tool Preference section additionally names `pdf_upload`; a new requirement specifies the PDF enrichment pipeline (preflight, two-pass analysis, upload, enrichment with overlay preservation, approval gate, save).

## Impact

- New: `packages/mcp-server/src/tools/pdf_upload.ts` (+ registration in `tools/index.ts`), `plugin/skills/formio-form-builder/PDF_FORM.md`.
- Modified: `packages/mcp-server/src/formio-client.ts` (FormData branch in `buildFetchInit`), `plugin/skills/formio-form-builder/SKILL.md` + `INTENT.md` + `FORM_TYPES.md` (routing + tool preference), `plugin/skills/formio-api/references/pdf-api.md` (upload endpoint's MCP Tool Preference).
- Tests: new `packages/mcp-server/src/__tests__` coverage for the FormData client branch and the `pdf_upload` tool; `packages/skill-tests/src/formio-form-builder/` structural tests extended for `PDF_FORM.md` and the updated layout list.
- Server API used: `POST {FORMIO_PROJECT_URL}/pdf-proxy/upload` (already documented in `pdf-api.md`); requires a project with the PDF server enabled — the tool surfaces the server's error when it is not.
- No changes to `formio-schema`, `formio-form`, or the plugin build script (skills copy wholesale; bundled server picks up the new tool via the normal build).
