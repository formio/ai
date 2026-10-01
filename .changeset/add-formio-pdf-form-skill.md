---
'@formio/mcp': minor
'@formio/ai': minor
---

Add PDF-first forms: a `formio-pdf-form` skill and a `pdf_upload` MCP tool.

**`pdf_upload`** uploads a local PDF to the project's `{projectUrl}/upload` route and returns the server's field conversion verbatim, plus the exact `settings.pdf` value a form over that PDF needs (derived with the same rule `@formio/js`'s PDF builder applies) and an `acroform` report of each AcroForm field's tooltip and required/read-only flags, read with `pdf-lib`. Released PDF servers label converted fields with raw field names and set no validation, so the report is how a human label and a required flag survive the upload. `formioFetch` now accepts a `FormData` body for multipart requests.

**`formio-pdf-form`** is a peer skill with five lanes: build a form from a PDF (the server places the fields, the agent proposes labels, keys, validation, and conditionals behind an approval gate, and the form is created once, already enriched), improve or replace the PDF behind a saved PDF form while keeping its keys, design the PDF template a webform's submissions download as (`pdfComponents`), render a PDF form, and download a submission as PDF. Every saved overlay position comes verbatim from the server's conversion — the agent never authors one. A PDF-processing skill already present in the client may help the inspect step; the skill never installs one.

`formio-form-builder` hands the PDF form type to the new skill, and `formio-form` links its render reference. `pdf-api.md` is corrected to the routes a deployment serves — upload, form create, submission, token, and download use project routes, not `pdf-proxy` paths — and `formio-schema` documents `overlay.page`, `settings.pdf`, and `pdfComponents`.
