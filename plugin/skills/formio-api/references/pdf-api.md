## Overview

The PDF API covers what a project admin does with PDF-backed forms: uploading a PDF and receiving the server's conversion of its fields, listing and retrieving uploaded PDFs, minting temporary download tokens, and downloading submissions rendered as PDFs. Every route is reached through the project — through its PDF proxy or through project routes the server forwards to the PDF server — never directly on the standalone PDF server.

Creating a PDF form and submitting to it use the ordinary project routes: `POST {projectUrl}/form` with `display: "pdf"` and `settings.pdf` (see [project-forms](./project-forms.md)), and `POST {projectUrl}/form/:formId/submission` (see [runtime-submissions](./runtime-submissions.md)). There is no PDF-specific create or submit route.

## Root URL

All endpoints below are rooted at `{projectUrl}` — the project endpoint. PDF file routes sit under `{projectUrl}/pdf-proxy`; upload, token, and submission download are project routes the server forwards to the PDF server.

## Authentication

Every request to these endpoints MUST include an `x-jwt-token` header holding the user JWT issued by the MCP server's browser-based portal-login flow. The MCP server attaches this header automatically via `formioFetch`; external clients must obtain the JWT through the same portal-login flow. Do not use any other authentication mechanism with these endpoints.

## MCP Tool Preference

Prefer the MCP server's first-party tools when they cover the requested operation. Call the HTTP endpoint directly only when no MCP tool applies.

| Operation | Preferred MCP tool | Fallback endpoint |
| --- | --- | --- |
| Upload a PDF and receive its field conversion | `pdf_upload` | `POST {projectUrl}/upload` |
| Create a PDF form | `form_create` | `POST {projectUrl}/form` |

`pdf_upload` also returns the derived `settings.pdf` value and each AcroForm field's tooltip and flags. The other operations below have no MCP tool.

## Endpoints

### POST {projectUrl}/upload

Upload a PDF to the project's PDF server. The server converts the PDF's AcroForm fields into components with overlay positions, and returns a stable `file` identifier for the uploaded document. The proxied route `POST {projectUrl}/pdf-proxy/pdf/:projectId/file` is equivalent; this one needs no project id and is the one the portal and the `@formio/js` PDF builder use.

Request: `multipart/form-data` with a single `file` part holding the PDF binary (`application/pdf`).

Response (JSON):

```json
{
  "path": "/pdf/69d65f4e040fa2cea257224d/file/7b45f38b-dc26-5b1d-aa33-947522157c57",
  "file": "7b45f38b-dc26-5b1d-aa33-947522157c57",
  "formfields": {
    "components": [
      {
        "type": "textfield",
        "key": "f1010",
        "label": "f1_01[0]",
        "overlay": { "width": 445, "height": 35.6, "top": 137.06, "left": 356, "page": 1, "style": "" }
      }
    ]
  }
}
```

- `path` — `/pdf/{projectId}/file/{fileId}`.
- `formfields.components` — the converted fields. Released PDF servers label each with its raw field name and set no validation; a PDF radio group arrives as `checkbox` components with `inputType: "radio"` and a shared `name`.
- `formfields.nonFillableConversionUsed` — absent when the PDF's own AcroForm fields were converted; `true` when the deployment recognized fields on a PDF that had none (an optional, deployment-configured feature); `false` alongside `components: []` when a PDF has no fields and nothing was recognized.

The form's `settings.pdf` is `{ "id": file, "src": … }`, where `src` is `{filesServer}{path}` when the response names a `filesServer`, and otherwise the origin of the Project URL followed by `/pdf-proxy` and `path` — for example `https://forms.mysite.com/pdf-proxy/pdf/69d65f4e040fa2cea257224d/file/7b45f38b-dc26-5b1d-aa33-947522157c57`.

Errors: `401` without a valid JWT; a license that does not include PDF forms is refused; a file that is not a PDF is answered with `500` and an HTML error page rather than JSON.

Example:

```bash
curl -X POST -H "x-jwt-token: $FORMIO_JWT" \
  -F "file=@w4.pdf" \
  "{projectUrl}/upload"
```

### GET {projectUrl}/pdf-proxy/pdf/:projectId/file

List the PDFs uploaded to the project. `:projectId` is the project's MongoDB ID.

Response: JSON array of upload documents.

```json
[
  {
    "_id": "69dd414de5cad6669f158ff6",
    "form": "650a5e1cdc01b795146a6def",
    "project": "650a5bfbb9ac8160c0968d80",
    "owner": "650a5bfdb9ac8160c0968e59",
    "access": [],
    "created": "2026-04-13T19:17:33.745Z",
    "modified": "2026-04-13T19:17:33.745Z",
    "data": {
      "project": "650a5bfbb9ac8160c0968d80",
      "id": "7b45f38b-dc26-5b1d-aa33-947522157c57",
      "path": "/pdf/650a5bfbb9ac8160c0968d80/file/7b45f38b-dc26-5b1d-aa33-947522157c57",
      "status": "active"
    }
  }
]
```

An unknown `:projectId` returns `[]`.

Example:

```bash
curl -H "x-jwt-token: $FORMIO_JWT" \
  "{projectUrl}/pdf-proxy/pdf/$PROJECT_ID/file"
```

### GET {projectUrl}/pdf-proxy/pdf/:projectId/file/:fileId.html

Retrieve the HTML rendering of an uploaded PDF — the page the PDF renderer's iframe loads, with fields drawn over it.

| Path parameter | Type   | Description                                    |
| -------------- | ------ | ---------------------------------------------- |
| `:projectId`   | string | Project MongoDB ID.                            |
| `:fileId`      | string | The `file` identifier returned from the upload. |

Response: `text/html` document.

Errors: a file that does not exist is answered with `500` and an HTML error page.

### GET {projectUrl}/pdf-proxy/pdf/:projectId/file/:fileId.pdf

Download the uploaded PDF itself.

Response: `application/pdf` stream. Consume with a streaming HTTP client for large files.

Errors: as for the HTML rendering.

Example:

```bash
curl -H "x-jwt-token: $FORMIO_JWT" \
  "{projectUrl}/pdf-proxy/pdf/$PROJECT_ID/file/$PDF_FILE.pdf" \
  -o template.pdf
```

### POST {projectUrl}/pdf-proxy/pdf/:projectId/download

Render an ad hoc PDF from an inline form definition and submission — no stored form or submission required.

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

### GET {projectUrl}/token

Mint a short-lived token that grants access to one route without the caller's JWT — used to put a submission's PDF download in a link or an email. This is the call the SDK's `getTempToken` makes.

Request headers:

| Header | Description |
| --- | --- |
| `x-allow` | The route the token may call, e.g. `GET:/project/:projectId/form/:formId/submission/:submissionId/download`. |
| `x-expire` | Seconds until the token expires (e.g. `3600`). |

Response:

```json
{ "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...", "key": "a1b2c3d4e5f6" }
```

The two values differ: a download URL carries `key` as its `token` query parameter, as the SDK's `getDownloadUrl` does. Scope `x-allow` to the one route and keep `x-expire` short; the URL that carries the key is a credential.

Example:

```bash
curl -H "x-jwt-token: $FORMIO_JWT" \
  -H "x-allow: GET:/project/$PROJECT_ID/form/$FORM_ID/submission/$SUB_ID/download" \
  -H "x-expire: 3600" \
  "{projectUrl}/token"
```

### GET {projectUrl}/form/:formId/submission/:submissionId/download

Download a submission as a PDF. A PDF form prints over its PDF; a webform with a saved `pdfComponents` template prints through the template; any other webform prints its own layout. The SDK's `getDownloadUrl` returns the same route addressed as `{baseUrl}/project/{projectId}/form/{formId}/submission/{submissionId}/download`.

| Query parameter | Type | Description |
| --- | --- | --- |
| `token` | string | The `key` from `GET {projectUrl}/token`. Required when the caller sends no `x-jwt-token`; without either the request is answered `401`. |
| `format` | string | `pdf` (default), or `html` to return the page the PDF is printed from. |
| `pageSize` | string | Page size, e.g. `A4` or `Letter`. Defaults to the form's setting, else A4. |
| `orientation` | string | `landscape` for landscape output. |
| `margin` | string | Four comma-separated margins: top, right, bottom, left. Defaults to the form's `settings.margins`. |
| `language` | string | Language code for a translated rendering. |

Response: `application/pdf` binary stream (or `text/html` with `format=html`).

Example:

```bash
curl "{projectUrl}/form/$FORM_ID/submission/$SUB_ID/download?token=$DOWNLOAD_KEY" \
  -o submission.pdf
```

### DELETE {projectUrl}/pdf-proxy/pdf/:projectId/file/:fileId

Delete an uploaded PDF. A form whose `settings.pdf.id` still names it can no longer render until it is given another PDF.

Response: `204 No Content` with an empty body.

Example:

```bash
curl -X DELETE -H "x-jwt-token: $FORMIO_JWT" \
  "{projectUrl}/pdf-proxy/pdf/$PROJECT_ID/file/$PDF_FILE"
```

## Related Skills

- [project-forms](./project-forms.md) — creating and managing the form definitions that reference PDF templates
- [runtime-submissions](./runtime-submissions.md) — generic submission CRUD for non-PDF and PDF forms alike
- [server-status](./server-status.md) — platform health and version checks
