# Design: PDF form enrichment

## Context

The PDF upload API is already documented in-repo at `plugin/skills/formio-api/references/pdf-api.md`: `POST {FORMIO_PROJECT_URL}/pdf-proxy/upload` (multipart, `file` part) returns `{ path, file, formfields: { components: [...] } }`, where `formfields.components` is the server's AcroForm auto-conversion — components carrying raw AcroForm labels and `overlay` geometry (`page`, `top`, `left`, `width`, `height`). PDF-form creation is `form_create` with `display: "pdf"` and `settings.pdf: { id: <file>, src: <path-based URL> }`.

Everything rides `FORMIO_PROJECT_URL` through the pdf-proxy — no separate PDF-server env var is needed. Auth is the existing portal-login JWT (`x-jwt-token` via `formioFetch`).

Current gaps:

- `formioFetch` serializes every body as JSON (`Content-Type: application/json`, `JSON.stringify`) — no multipart path.
- No MCP tool for the upload; `pdf-api.md` explicitly says "No MCP tool covers this operation".
- `formio-form-builder`'s pdf lane ends at "the PDF document must exist in the project" — the agent neither uploads nor improves the conversion.

Agent capabilities this design leans on: the Read tool renders PDF pages visually (≤20 pages/request); Bash can run a Python AcroForm dump (`pypdf`); AcroForm definitions carry high-quality metadata the conversion discards or mangles — field tooltips (`/TU`, often the author's human label), required flags (`/Ff` bit 2), choice options (`/Opt`).

## Goals / Non-Goals

**Goals:**

- First-party `pdf_upload` MCP tool so the skill never shells out to `curl` (MCP Tool Preference convention).
- An agent-driven enrichment lane in `formio-form-builder`: analyze → upload → enrich labels/validations/conditionals → gate → save.
- Deterministic extraction in scripts, semantics in the agent, `overlay` geometry untouched, approval gate before every write — the reliability split.
- No duplication: PDF endpoint shapes stay in `pdf-api.md` (referenced by path); component JSON guidance stays in `formio-schema`.

**Non-Goals:**

- Flat/scanned PDFs (no AcroForm): visual-only coordinate estimation is unreliable — v1 declares them unsupported for enrichment and offers a plain unenriched `display: "pdf"` form or a bail. OCR/vision overlay synthesis is a future change.
- No new MCP tools beyond `pdf_upload` (list/download/delete PDF endpoints stay HTTP-only in `pdf-api.md`).
- No changes to the server-side conversion itself — enrichment happens client-side between conversion output and form save.
- No `settings.pdf` schema documentation in the builder skill — `pdf-api.md` owns the shape.

## Decisions

### D1: One tool, `pdf_upload`, taking a local file path

Input schema: `cwd` (standard project resolution via `resolveProjectConfig`, like every other tool) and `filePath` (absolute path to the local PDF). The tool reads the file with `node:fs`, builds a `FormData` with a `Blob` (`type: 'application/pdf'`, filename from the path), and POSTs to `pdf-proxy/upload` through `formioFetch`. Response is passed through verbatim (`toMcpTextResult`) — the agent needs `path`, `file`, and `formfields` untouched.

Alternative — accepting base64 content as a tool argument — rejected: PDFs are megabytes; a file path keeps the payload out of the model context and matches how the agent actually has the file (on disk).

Description follows the `form_create` precedent (tool description names the skill that guides its use): instructs the LLM that the returned `formfields.components` are a raw skeleton and the `formio-form-builder` PDF flow enriches them (labels, validations, conditionals) before `form_create`.

### D2: `formioFetch` learns `FormData`, nothing else changes

`buildFetchInit` gains one branch: `options.body instanceof FormData` → set `init.body = options.body` directly and set NO `Content-Type` header (fetch/undici writes the multipart boundary itself). JSON bodies keep the existing path. The 401 re-auth retry works unchanged: the `FormData` holds an in-memory `Blob`, so re-sending the same instance on retry is safe (undici re-serializes per request).

Alternative — a separate `formioUpload` function — rejected: it would duplicate URL building, auth, and the 401 retry for one header difference. Open/Closed favors the small body-type branch.

### D3: PDF_FORM.md pipeline — deterministic extraction, semantic enrichment, hard gate

Step doc entered from INTENT's pdf branch (replacing the current "surface the PDF prerequisite" dead end):

1. **Collect** — one question: path to the PDF file.
2. **Preflight** — script check for `/AcroForm` with fields (Python `pypdf` when available; `pip install --user pypdf` once, with a raw `strings | grep` fallback for detection only). No fields → the flat-PDF off-ramp (Non-Goals).
3. **Analyze**
   - *Structural pass (script, deterministic):* dump every AcroForm field — fully-qualified name, type, required flag, options, tooltip, page, rect. Tooltips are the highest-quality label source.
   - *Visual pass (Read tool):* render pages (≤20/request, loop as needed) and note label text near fields, required markers, and conditional prose ("If yes, complete Section B", "Section 2 — married filers only").
4. **Upload** — `pdf_upload`; stash `path`, `file`, `formfields.components`.
5. **Enrich** — match each converted component to the structural dump by AcroForm name (the conversion writes it into `label`/`key`) with page+rect as tiebreaker; then rewrite `label` (tooltip/visual text), assign clean camelCase `key`s (unique), set `validate.required` from flags/markers, map choice options, and add `conditional`s from the conditional prose. **`overlay` values are copied through byte-identical — never edited.** Component-JSON shapes come from `formio-schema` (referenced by name, per the skill's existing no-duplication rule).
6. **Gate** — approval table: AcroForm name → proposed label / key / validation / condition, plus anything the agent could not confidently match (left unenriched, flagged). Declined gate = nothing saved.
7. **Save** — `form_create` with `display: "pdf"`, `settings.pdf` built from the upload response per `pdf-api.md`, and the enriched components. Then the standard SAVE confirmation (`{FORMIO_PROJECT_URL}/{formPath}`) and the normal EMBED conditional.

The pipeline document references `formio-api/references/pdf-api.md` by path for every endpoint detail and never restates request/response shapes.

### D4: Enrichment happens before form creation, not after

The upload response already contains the converted skeleton, so the form is created once, enriched — no intermediate unenriched form, no `form_update` churn, nothing half-labeled visible in the project if the user declines the gate. `form_update` remains the path only when the user asks to enrich an ALREADY-uploaded PDF form (documented as a variant in PDF_FORM.md: `form_get` → enrich → gate → `form_update`).

### D5: Skill surface updates are surgical

- `SKILL.md`: Step 2/3 text notes the pdf type routes through `PDF_FORM.md` (SCHEMA delegation to `formio-schema` still holds for any extra non-overlay fields the user wants added); MCP Tool Preference adds `pdf_upload`; Links table adds the doc.
- `INTENT.md`: the pdf stash note routes to `PDF_FORM.md` instead of only surfacing the prerequisite.
- `FORM_TYPES.md`: PDF section's prerequisite paragraph now says the skill can perform the upload and enrichment itself via `PDF_FORM.md`.
- `pdf-api.md` upload endpoint: MCP Tool Preference names `pdf_upload` (other endpoints keep "no MCP tool").
- Structural tests: the exact step-doc list in `skill-structure.test.ts` gains `PDF_FORM.md`; new content assertions for the pipeline doc (preflight, two passes, overlay preservation, gate, `pdf-api.md` path reference, no endpoint duplication).

### D6: Test strategy

- `formio-client`: unit tests with a mocked `fetch` — FormData body sent unserialized, no `Content-Type: application/json`, JSON path unchanged, 401 retry re-sends the FormData.
- `pdf_upload` tool: registration test (name, description references `formio-form-builder`), happy path (temp PDF file → POST `pdf-proxy/upload` multipart → response passthrough), missing file error, API error passthrough. Follows the existing tool-test pattern in `packages/mcp-server/src/__tests__/`.
- Skill structural tests as in D5. The enrichment semantics themselves are prose/agent behavior — no renderer tests.

## Risks / Trade-offs

- [`pypdf` absent on the user's machine] → PDF_FORM.md scripts a one-time `pip install --user pypdf` with user consent; detection-only fallback via `strings`/`grep` keeps preflight working; if the structural pass is impossible, the visual pass + tooltips from the server conversion still allow partial enrichment, disclosed at the gate.
- [Key renames breaking overlay binding] → overlay geometry lives on the component, not the key; renaming `key` is safe as long as uniqueness holds — the gate table shows old → new keys and the doc mandates uniqueness. `overlay` itself is copy-through by requirement.
- [Conditional/validation inference wrong] → gate is mandatory and itemized; unmatched or low-confidence fields ship unenriched rather than guessed. Same trust posture as the planner's Phase A/B gate.
- [Project without a PDF server / unlicensed] → `pdf_upload` surfaces the server's error verbatim; PDF_FORM.md has an error branch telling the user the project needs the PDF server enabled and offering to bail (no silent fallback to a broken form).
- [Large PDFs vs Read tool page limits] → visual pass loops in ≤20-page batches; structural pass is size-independent; enormous PDFs only slow the visual pass, never block the pipeline.
- [FormData retry on 401] → in-memory Blob re-serializes safely; covered by an explicit client test.

## Open Questions

None — endpoint shapes are documented in-repo, tool/client/test patterns have direct precedents, and the pipeline's trust boundaries (script vs agent vs gate) are settled above.
