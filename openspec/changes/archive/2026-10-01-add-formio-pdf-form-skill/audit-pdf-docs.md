# Audit: PDF claims in the shipped skills

Every statement about PDF APIs or PDF behavior in `plugin/skills/` (as of main `ebd8ceb`), checked against a live deployment and the Form.io source.

- **Live:** a local Enterprise deployment (`formio/formio-enterprise:latest`, `/status` 9.9.2; legacy portal with `@formio/js` 5.5.2), 1 October 2026. Probes ran in the logged-in portal tab — `fetch` with the portal's JWT — plus the portal's own PDF-form and re-upload flows under network capture. Test PDFs were hand-built: a fillable Letter page (two text fields, one with a `/TU` tooltip and the required flag; a choice field; a checkbox; a two-button radio group), the same page with no fields, a 433×287 pt page, and a non-PDF file.
- **Source:** the Form.io source monorepo (`nirvana`) at `d7abb28e5e` (`main` = released; `nextgen-pdf-first` = unreleased).

Verdicts: **Correct**, **Wrong**, **Partly wrong**, **Unverified** (not exercised live; source noted).

## `formio-api/references/pdf-api.md`

| # | Claim | Verdict | Evidence |
| --- | --- | --- | --- |
| A1 | "All endpoints below are rooted at `{projectUrl}/pdf-proxy`" | Wrong | Upload, token, and submission download are project routes; four documented `pdf-proxy` paths are unrouted (A2, A9, A10, A12, A14). |
| A2 | Upload is `POST {projectUrl}/pdf-proxy/upload` | Wrong | `400 {}`, the same answer as a nonsense `pdf-proxy` path. `POST {projectUrl}/upload` → 200, and it is what the portal sends. `POST {projectUrl}/pdf-proxy/pdf/{projectId}/file` → 200 too. |
| A3 | Upload response `{ path, file, formfields: { components } }`; sample component `key: "f1010"`, `label: "f1_01[0]"`, overlay geometry | Correct | Exact match for a field named `f1_01[0]`. Each overlay also carries `left`, `page`, and `style: ""`, and `formfields` carries `nonFillableConversionUsed` (`false` for a flat PDF). |
| A4 | "Use the returned `path` as the `settings.pdf.src` suffix" | Correct, incomplete | The portal saved `src` = `{origin}/pdf-proxy` + `path` — the origin of the Project URL plus `/pdf-proxy`. The doc does not say what the prefix is. |
| A5 | Errors: `400` for a non-PDF file | Wrong | `500` with an HTML "Error" page (an Axios stack trace from the proxy). |
| A6 | Errors: `413` above the size limit | Unverified | Source: the proxy's body limit is 50 MB (`pdfProxy/router.js:16`); the portal caps uploads at 20 MB. |
| A7 | List `GET …/pdf-proxy/pdf/:projectId/file` returns upload documents | Correct | 200; each item `{ _id, form, project, owner, access, created, modified, data: { project, id, path, status } }`. The doc's sample omits `access`, `data.project`, `data.status`. |
| A8 | List: "the proxy validates it matches the JWT's project context"; `404` for an unknown project | Wrong | An unknown project id → 200 `[]`, not 404. |
| A9 | `GET …/file/:id.html` / `.pdf`; `404` when missing | Partly wrong | Existing file → 200 (`text/html` / `application/pdf`). Missing file → `500` HTML page ("The specified key does not exist"), not 404. |
| A10 | `POST {projectUrl}/pdf-proxy/form` creates a PDF form, "validated against the referenced PDF" | Wrong | Unrouted (`400 {}`). The portal creates PDF forms with the ordinary `POST {projectUrl}/form`; nothing validates overlays against the PDF. |
| A11 | Create example `settings.pdf.src: "https://pdf.form.io/pdf/…"` | Wrong | Saved forms use `{origin of the Project URL}/pdf-proxy/pdf/{projectId}/file/{fileId}`. A direct PDF-server URL bypasses the proxy. |
| A12 | `POST {projectUrl}/pdf-proxy/form/:id/submission` | Wrong | Unrouted (`400 {}`). Submissions use `POST {projectUrl}/form/:id/submission` (`runtime-submissions.md`). |
| A13 | Ad hoc `POST …/pdf-proxy/pdf/:projectId/download` with inline `{ form, submission }` returns a PDF | Correct | 200 `application/pdf`. |
| A14 | Token `GET {projectUrl}/pdf-proxy/token` with required `x-allow` / `x-expire`, returning `{ token }` | Wrong | Unrouted (`400 {}`). `GET {projectUrl}/token` → 200 `{ token, key }` (two different values); it also answers 200 without either header. The SDK puts `key` in the download URL (`Formio.ts:1245`). |
| A15 | Download `GET {projectUrl}/pdf-proxy/form/:id/submission/:sid/download?token=` | Wrong | Unrouted (`400 {}`). `GET {projectUrl}/form/:id/submission/:sid/download` → 200 PDF with a JWT; `{baseUrl}/project/{projectId}/form/:id/submission/:sid/download?token={key}` → 200 PDF; the same without a token → 401. |
| A16 | Delete `DELETE …/file/:id`; `204`, `409` when referenced | Partly verified | Cleanup deleted six unreferenced test uploads: each `204` with an empty body, and each gone from the list afterward. The `409`-when-referenced case was not exercised. |
| A17 | MCP Tool Preference: "No MCP tool covers this operation" | Correct today | Becomes `pdf_upload` for the upload with this change. |

## `formio-api/SKILL.md`

| # | Claim | Verdict | Evidence |
| --- | --- | --- | --- |
| B1 | Navigation heading "PDF scope — `{projectUrl}/pdf-proxy/`" | Partly wrong | As A1. |

## `formio-sdk`

| # | Claim | Verdict | Evidence |
| --- | --- | --- | --- |
| C1 | `submissions.md`: `getDownloadUrl(form?)` returns a temp-token-wrapped download URL | Correct | Live: it called `GET {projectUrl}/token` and returned `/project/{projectId}/form/{formId}/submission/{subId}/download?token=…`, which served a PDF with no JWT. Without `form`, it loads the form first (source). Worth adding: if minting the token fails it returns the URL with no token (source, `Formio.ts:1247-1249`), which then answers 401. |
| C2 | `submissions.md`: `getTempToken(expire, allowed)` mints a scoped token | Correct | Live via C1. |
| C3 | `rendering.md`: a `display: "pdf"` definition switches the renderer to the PDF view automatically | Correct | `createForm` on the saved PDF form mounted an iframe at `{settings.pdf.src}.html?id=…`; with `{ readOnly: true, zoom: -2 }` the query gained `readonly=1&zoom=-2`. |

## `formio-schema`

| # | Claim | Verdict | Evidence |
| --- | --- | --- | --- |
| D1 | `base-component.md`: `overlay` is `{ style, left, top, width, height }` | Partly wrong | Missing `page` (1-based), present on every converted component. Values are numbers. The portal drops an empty `style` on save. |
| D2 | `form-definition.md`: `settings.pdf` is `{ src, id }` | Correct | Every saved PDF form. Also true of a wizard (`patientform`) — a non-PDF form carrying `settings.pdf` downloads over the PDF. |
| D3 | `form-definition.md`: `display` includes `"pdf"` | Correct | — |
| D4 | `form-definition.md`: `settings.fontSize` / `settings.margins` for PDF rendering | Unverified | Source reads `settings.margins` as the default for the `margin` query parameter (`generatePDFOptions.js:99-101`). |
| D5 | `form-definition.md`: no `pdfComponents` entry | Gap | The API returns `pdfComponents: []` on every form, and the download renders it (verified). |
| D6 | `project-settings.md`: `settings.pdfserver` is "the PDF server this project routes PDF operations to" | Partly wrong | Source: used only when the `PDF_SERVER` environment variable is unset, and never on hosted deployments (`pdfProxy/proxy.js`). The live project has no `pdfserver` key; its `settings.pdf` holds `translationsUrl`, which the reference does not mention. |

## `formio-form-builder`

| # | Claim | Verdict | Evidence |
| --- | --- | --- | --- |
| E1 | `FORM_TYPES.md`: overlay components include `radio` | Wrong | Not in the PDF builder allow-list or the portal's "PDF Fields" palette. A PDF radio group converts to `checkbox` components with `inputType: "radio"`, a shared `name`, one `value` each. |
| E2 | `FORM_TYPES.md`: "standard page sizes — A4, Letter — non-standard sizes fail" | Wrong here | A 433×287 pt page uploaded (200), converted its field, and rendered to HTML. The claim comes from the help docs; it may describe an older PDF server. |
| E3 | `FORM_TYPES.md`: the user uploads the PDF "through the Form.io portal" | Correct today | Becomes the `pdf_upload` tool with this change. |
| E4 | `FORM_TYPES.md`: submissions print pixel-perfect over the PDF; hybrid mode keeps the PDF for printing | Partly verified | A PDF form's download rendered over its PDF. Hybrid: a webform given `settings.pdf` rendered over the PDF in HTML, but its binary download failed (500 with `pdfComponents`, hung past 35 s without) because its components had no overlays. |

## `formio-react-form` and `formio-angular-form`

| # | Claim | Verdict | Evidence |
| --- | --- | --- | --- |
| F1 | `mounting.md` (both): a PDF form renders through the same component; it "additionally needs the project's PDF server" | Correct | The renderer loads its iframe from the PDF proxy. |

## What this change fixes

- `api-skills-library` delta: A1, A2, A4, A5, A7–A12, A14, A15, B1.
- `api-skills-validation` delta: the PDF path rule that requires A1.
- `formio-schema-skill` delta: D1, D5, and the `settings.pdf` hybrid note in D2.
- `formio-form-builder-skill` delta: E1, E2.
- Outside this change: C1's no-token fallback note (`formio-sdk`), D4 and D6 (`formio-schema` project settings), A6 and A16's `409` case (verify on a deployment where they can be exercised).
