
## Overview

The PDF API covers everything a project admin does with PDF-backed forms: uploading PDF templates, listing and retrieving uploaded PDFs, creating PDF-display forms, submitting data against a PDF form, generating temporary download tokens, and downloading rendered submission PDFs. All traffic goes through the project's PDF proxy — never directly to the standalone PDF server.

## Root URL

All endpoints below are rooted at `${FORMIO_PROJECT_URL}/pdf-proxy` — the project-proxied PDF server path. Direct PDF-server endpoints are not supported here.

## Authentication

Every request to these endpoints MUST include an `x-jwt-token` header holding the user JWT issued by the MCP server's browser-based portal-login flow. The MCP server attaches this header automatically via `formioFetch`; external clients must obtain the JWT through the same portal-login flow. Do not use any other authentication mechanism with these endpoints.

## MCP Tool Preference

For uploading a PDF template (`POST ${FORMIO_PROJECT_URL}/pdf-proxy/upload`), prefer the MCP server's first-party `pdf_upload` tool — it performs the multipart upload through the portal-login JWT flow and returns the `path`, `file`, and `formfields` response verbatim. No MCP tool covers the other PDF endpoints — use those HTTP endpoints directly.

## Endpoints

### POST ${FORMIO_PROJECT_URL}/pdf-proxy/upload

Upload a PDF template file to the project. The server parses form fields from the PDF (AcroForm fields) and returns a component skeleton plus a stable `file` UUID used to reference the PDF in subsequent calls.

Request: `multipart/form-data` with a single `file` part holding the PDF binary.

Response (JSON):

```json
{
  "path": "/pdf/69d65f4e040fa2cea257224d/file/7b45f38b-dc26-5b1d-aa33-947522157c57",
  "file": "7b45f38b-dc26-5b1d-aa33-947522157c57",
  "formfields": {
    "components": [
      { "type": "textfield", "key": "f1010", "label": "f1_01[0]", "overlay": { "width": 317.28, "height": 24.92, "top": 167.3 } }
    ]
  }
}
```

Use the returned `path` as the `settings.pdf.src` suffix and `file` as `settings.pdf.id` when creating a PDF form.

Errors: `400` if the uploaded file is not a valid PDF; `401`/`403` for auth failures; `413` if the upload exceeds the project's configured size limit.

Example:

```bash
curl -X POST -H "x-jwt-token: $FORMIO_JWT" \
  -F "file=@w4.pdf" \
  "${FORMIO_PROJECT_URL}/pdf-proxy/upload"
```

### GET ${FORMIO_PROJECT_URL}/pdf-proxy/pdf/:projectId/file

List all PDF uploads associated with the project. `:projectId` is the MongoDB ID of the current project — the proxy validates it matches the JWT's project context.

Response: JSON array of PDF upload documents.

```json
[
  {
    "_id": "69dd414de5cad6669f158ff6",
    "form": "650a5e1cdc01b795146a6def",
    "project": "650a5bfbb9ac8160c0968d80",
    "owner": "650a5bfdb9ac8160c0968e59",
    "created": "2026-04-13T19:17:33.745Z",
    "data": { "id": "7b45f38b-dc26-5b1d-aa33-947522157c57", "path": "/pdf/.../file/..." }
  }
]
```

Errors: `401`/`403` for auth failures; `404` if `:projectId` does not resolve.

Example:

```bash
curl -H "x-jwt-token: $FORMIO_JWT" \
  "${FORMIO_PROJECT_URL}/pdf-proxy/pdf/$PROJECT_ID/file"
```

### GET ${FORMIO_PROJECT_URL}/pdf-proxy/pdf/:projectId/file/:pdfFileName.html

Retrieve the rendered HTML representation of a specific uploaded PDF — used by the form builder to overlay components on the PDF visually.

| Path parameter | Type | Description |
| --- | --- | --- |
| `:projectId` | string | Project MongoDB ID. |
| `:pdfFileName` | string | The `file` UUID returned from the upload call. |

Response: `text/html` document.

Errors: `404` if the PDF does not exist; `401`/`403` for auth failures.

### GET ${FORMIO_PROJECT_URL}/pdf-proxy/pdf/:projectId/file/:pdfFileName.pdf

Download the raw PDF binary.

Response: `application/pdf` stream. Consume with a streaming HTTP client for large files.

Errors: `404` if the PDF does not exist; `401`/`403` for auth failures.

Example:

```bash
curl -H "x-jwt-token: $FORMIO_JWT" \
  "${FORMIO_PROJECT_URL}/pdf-proxy/pdf/$PROJECT_ID/file/$PDF_FILE.pdf" \
  -o template.pdf
```

### POST ${FORMIO_PROJECT_URL}/pdf-proxy/form

Create a new PDF-display form tied to an uploaded PDF template. Equivalent to the standard form-create endpoint but routed via the PDF proxy so overlay metadata is validated against the referenced PDF.

Request body (JSON):

```json
{
  "title": "W4",
  "path": "w4",
  "name": "w4",
  "display": "pdf",
  "settings": {
    "pdf": {
      "id": "7b45f38b-dc26-5b1d-aa33-947522157c57",
      "src": "https://pdf.form.io/pdf/69d65f4e040fa2cea257224d/file/7b45f38b-dc26-5b1d-aa33-947522157c57"
    }
  },
  "components": [
    {
      "type": "textfield",
      "key": "firstName",
      "overlay": { "page": 1, "top": 1218, "left": 808.344, "height": 18, "width": 215 }
    }
  ]
}
```

Required: `title`, `name`, `path`, `display: "pdf"`, `settings.pdf.id`, `settings.pdf.src`, and overlay-coordinate-bearing `components`.

Response: the created form document with server-assigned `_id`, `machineName`, `created`, and `modified`.

Errors: `400` for validation errors (missing overlay, bad PDF reference); `401`/`403` for auth failures.

### POST ${FORMIO_PROJECT_URL}/pdf-proxy/form/:pdfFormId/submission

Create a submission against a PDF form. The submission is stored and optionally pre-renders data onto the PDF for later download.

Request body (JSON): standard submission `data` object plus an optional `signature` data-URL.

```json
{
  "data": {
    "expectedReturn": "23",
    "withholdings": 23,
    "employersName": "Form.io",
    "date": "2018-02-23T06:00:00.000Z",
    "signature": "data:image/png;base64,iVBORw0KGgoAAAA..."
  }
}
```

Response: the created submission document (`_id`, `form`, `owner`, `data`, `created`, `modified`).

Errors: `400` for validation errors against the form's component schema; `401`/`403` for auth failures; `404` if `:pdfFormId` does not exist.

### POST ${FORMIO_PROJECT_URL}/pdf-proxy/pdf/:projectId/download

Create an ad-hoc PDF rendered from an inline form definition and submission — no stored form or submission required. Useful for one-off export workflows.

Request body (JSON):

```json
{
  "form": {
    "title": "My custom form",
    "components": [
      { "type": "textfield", "key": "firstName", "label": "First Name", "input": true },
      { "type": "textfield", "key": "lastName", "label": "Last Name", "input": true }
    ]
  },
  "submission": {
    "data": { "firstName": "Joe", "lastName": "Smith" }
  }
}
```

Response: `application/pdf` binary stream.

Errors: `400` for invalid form/submission shape; `401`/`403` for auth failures.

### GET ${FORMIO_PROJECT_URL}/pdf-proxy/token

Mint a short-lived download token that grants GET access to a specific submission PDF without the caller's primary JWT. Used to embed download URLs in emails or front-end links.

Required request headers:

| Header | Description |
| --- | --- |
| `x-allow` | Whitelisted route, e.g. `GET:/project/:projectId/form/:pdfFormId/submission/:pdfSubmissionId/download`. |
| `x-expire` | Seconds until the token expires (e.g. `3600`). |

Response:

```json
{ "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." }
```

Errors: `400` if `x-allow`/`x-expire` are missing or malformed; `401`/`403` for auth failures.

Example:

```bash
curl -H "x-jwt-token: $FORMIO_JWT" \
  -H "x-allow: GET:/project/$PROJECT_ID/form/$FORM_ID/submission/$SUB_ID/download" \
  -H "x-expire: 3600" \
  "${FORMIO_PROJECT_URL}/pdf-proxy/token"
```

### GET ${FORMIO_PROJECT_URL}/pdf-proxy/form/:pdfFormId/submission/:pdfSubmissionId/download

Download a specific submission rendered onto its PDF template.

| Query parameter | Type | Description |
| --- | --- | --- |
| `token` | string | Temporary download token from the `/pdf-proxy/token` endpoint. Required when the caller is not authenticated via `x-jwt-token`. |

Response: `application/pdf` binary stream.

Errors: `401`/`403` if neither a valid JWT nor a valid token is supplied; `404` if the submission or form does not exist.

Example:

```bash
curl "${FORMIO_PROJECT_URL}/pdf-proxy/form/$FORM_ID/submission/$SUB_ID/download?token=$DOWNLOAD_TOKEN" \
  -o submission.pdf
```

### DELETE ${FORMIO_PROJECT_URL}/pdf-proxy/pdf/:projectId/file/:pdfFileName

Delete a specific PDF upload. Forms still referencing the PDF will fail to render until their `settings.pdf.id` is updated.

Response: `204 No Content` on success.

Errors: `404` if the PDF does not exist; `409` if one or more forms still reference it (depending on project policy); `401`/`403` for auth failures.

Example:

```bash
curl -X DELETE -H "x-jwt-token: $FORMIO_JWT" \
  "${FORMIO_PROJECT_URL}/pdf-proxy/pdf/$PROJECT_ID/file/$PDF_FILE"
```

## Related Skills

- [project-forms](./project-forms.md) — creating and managing the form definitions that reference PDF templates
- [runtime-submissions](./runtime-submissions.md) — generic submission CRUD for non-PDF and PDF forms alike
- [server-status](./server-status.md) — platform health and version checks
