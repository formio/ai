# Tasks: add PDF form enrichment

## 1. formio-client multipart support
<!-- depends_on: none -->

### Red

- [x] 1.1 Write failing client tests (mocked `fetch`, existing formio-client test pattern): a `FormData` body is passed to `fetch` unserialized; no `Content-Type: application/json` header is set for FormData requests; JSON body behavior unchanged (regression assertions); a 401 in JWT mode re-authenticates and retries once, re-sending the same `FormData`

### Green

- [x] 1.2 Implement the `FormData` branch in `buildFetchInit` (`packages/mcp-server/src/formio-client.ts`): `body instanceof FormData` → assign directly, skip JSON serialization and the `Content-Type` header; widen `FormioFetchOptions.body` typing accordingly (no `any`)

### Refactor

- [x] 1.3 Review implementation and refactor as needed

## 2. pdf_upload MCP tool
<!-- depends_on: 1 -->

### Red

- [x] 2.1 Write failing tool tests (existing tool-test pattern in `packages/mcp-server/src/__tests__/`): tool registers with required `cwd` and `filePath` params and a description containing `formio-form-builder` and mentioning enrichment; happy path — a temp PDF file is sent as `POST {projectUrl}/pdf-proxy/upload` multipart with a `file` part and the `{ path, file, formfields }` response (including `overlay` values) is returned verbatim; missing/unreadable `filePath` returns an MCP error naming the path without any HTTP request; non-OK API responses surface as MCP errors with status and URL

### Green

- [x] 2.2 Implement `packages/mcp-server/src/tools/pdf_upload.ts` (model on `form_create.ts`): `cwd` + `filePath` schema, `resolveProjectConfig`, read file via `node:fs`, build `FormData` with a `Blob` (`application/pdf`, filename from path), `formioFetch('pdf-proxy/upload', …, { method: 'POST', body: formData })`, `toMcpTextResult` passthrough, `toMcpError` on failure; register in `tools/index.ts`

### Refactor

- [x] 2.3 Review implementation and refactor as needed

## 3. PDF_FORM.md and skill surface updates
<!-- depends_on: none -->

### Red

- [x] 3.1 Update `packages/skill-tests/src/formio-form-builder/skill-structure.test.ts`: add `PDF_FORM.md` to the exact step-doc list (exists, non-empty, no frontmatter); extend the MCP Tool Preference assertion to require `pdf_upload`
- [x] 3.2 Write failing content tests in `step-docs.test.ts`: `PDF_FORM.md` documents the preflight AcroForm check with flat-PDF off-ramps, both analysis passes, the `pdf_upload` call, overlay preservation ("never" modified), the approval gate before `form_create`, and references `pdf-api.md` by path without restating endpoint shapes; `INTENT.md` contains `PDF_FORM.md` for the pdf branch; `FORM_TYPES.md`'s PDF section contains `PDF_FORM.md`

### Green

- [x] 3.3 Author `plugin/skills/formio-form-builder/PDF_FORM.md` per the design's D3 pipeline: Collect → Preflight (pypdf script + `strings` fallback, flat-PDF off-ramps) → Analyze (structural dump script + visual Read pass in ≤20-page batches) → Upload (`pdf_upload`) → Enrich (match by AcroForm name + page/rect; labels/keys/validate/options/conditionals; overlay copied through unmodified; component shapes defer to `formio-schema`) → Gate (approval table, unmatched fields flagged unenriched) → Save (`form_create` with `display: "pdf"` + `settings.pdf` per `pdf-api.md`, then standard SAVE confirmation + EMBED conditional); include the enrich-existing-PDF-form variant (`form_get` → enrich → gate → `form_update`) and the no-PDF-server error branch
- [x] 3.4 Update the skill surface: `SKILL.md` (pdf lane note in the step flow, `pdf_upload` in MCP Tool Preference, Links table row), `INTENT.md` (pdf branch routes to `PDF_FORM.md`), `FORM_TYPES.md` (PDF section points at `PDF_FORM.md`)

### Refactor

- [x] 3.5 Review implementation and refactor as needed

## 4. pdf-api.md reference update
<!-- depends_on: 2 -->

### Red

- [x] 4.1 Write a failing structural assertion (in the formio-form-builder or a small formio-api test file under `packages/skill-tests/src/`): `plugin/skills/formio-api/references/pdf-api.md`'s `## MCP Tool Preference` section names `pdf_upload`

### Green

- [x] 4.2 Update `plugin/skills/formio-api/references/pdf-api.md`: MCP Tool Preference names `pdf_upload` for the `pdf-proxy/upload` endpoint (other endpoints stay HTTP-only)

### Refactor

- [x] 4.3 Review implementation and refactor as needed

## 5. Definition of Done
<!-- depends_on: 1, 2, 3, 4 -->

### Red

- [x] 5.1 Run the full suite (`pnpm test`) and capture any remaining failures; rebuild the plugin (`pnpm build:plugin`) and confirm the bundled server exposes `pdf_upload` (smoke `tools/list`)

### Green

- [x] 5.2 Fix any failures; then `pnpm test`, `pnpm lint`, and `pnpm format` all pass clean

### Refactor

- [x] 5.3 Review implementation and refactor as needed
