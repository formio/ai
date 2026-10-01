## ADDED Requirements

### Requirement: pdf_upload is registered with a skill-referencing description

The MCP server SHALL register a `pdf_upload` tool with the standard optional `cwd` parameter (`cwdSchema`, as every project-scoped tool has) and a required `filePath` (an absolute path to a local PDF). Its description SHALL state that it uploads a local PDF to the project's PDF server, that the returned `formfields.components` are an auto-converted skeleton the `formio-pdf-form` skill enriches before any form is saved, and that the returned `pdf` object is the value for the form's `settings.pdf`.

#### Scenario: Tool listed with parameters and skill reference

- **WHEN** the MCP server is initialized
- **THEN** `pdf_upload` is listed with `cwd` and a required `filePath`
- **AND** its description contains the literal substring `formio-pdf-form` and the literal substring `settings.pdf`

### Requirement: pdf_upload posts the file multipart to the project upload route

The tool SHALL resolve the project with `resolveProjectConfig(cwd, …)` like every project-scoped tool, read the file at `filePath`, and send it through `formioFetch` as `POST {projectUrl}/upload` with a `multipart/form-data` body holding one part named `file` (content type `application/pdf`, filename the path's basename). It SHALL NOT use `{projectUrl}/pdf-proxy/upload`, which the PDF server does not route.

#### Scenario: Happy-path upload

- **WHEN** `pdf_upload` is called with a readable PDF path
- **THEN** exactly one request is sent: `POST {projectUrl}/upload`, multipart, with a `file` part named after the file
- **AND** the request carries the auth header the client layer supplies

#### Scenario: Unreadable file sends nothing

- **WHEN** `filePath` does not exist or cannot be read
- **THEN** the tool returns an MCP error naming the path
- **AND** no HTTP request is made

#### Scenario: Non-PDF file is refused locally

The server answers a non-PDF upload with `500` and an HTML error page, which tells the user nothing; the local check gives the cause.

- **WHEN** the file's first bytes are not the `%PDF-` signature
- **THEN** the tool returns an MCP error stating the file is not a PDF
- **AND** no HTTP request is made

### Requirement: pdf_upload returns the response verbatim plus a derived settings value

The tool SHALL return the server's JSON response unmodified — `path`, `file`, and `formfields` (with `components` and, when present, `nonFillableConversionUsed`), every `overlay` value intact — together with the `acroform` report (next requirement) and a derived `pdf` object: `{ id: file, src }`, where `src` is `{filesServer}{path}` when the response carries `filesServer`, and otherwise `{origin of the Project URL}/pdf-proxy{path}`. This is the rule `@formio/js`'s `PDFBuilder` applies, so a form saved with it renders identically to one uploaded in the builder. The derivation SHALL be a pure function with its own unit tests.

#### Scenario: Passthrough with derived pdf on a hosted project

- **WHEN** the project URL is `https://examples.form.io` and the server responds `{ path: "/pdf/p1/file/f1", file: "f1", formfields: { components: [...] } }`
- **THEN** the result contains that response verbatim
- **AND** its `pdf` is `{ id: "f1", src: "https://examples.form.io/pdf-proxy/pdf/p1/file/f1" }`

#### Scenario: Sub-directory deployment

- **WHEN** the project URL is `https://forms.mysite.com/myproject`
- **THEN** the derived `src` begins `https://forms.mysite.com/pdf-proxy/`

#### Scenario: Files server named by the response

- **WHEN** the response carries `filesServer: "https://files.mysite.com"`
- **THEN** the derived `src` is `https://files.mysite.com{path}`

### Requirement: pdf_upload reports each AcroForm field's tooltip and flags

Released PDF servers return raw field names as labels and drop each field's tooltip and required flag. The tool SHALL recover them from the same file it uploads and return them beside the server response as `acroform`, so every client gets them without local tooling:

- `acroform.fields` — one entry per AcroForm field, in document order: `name` (fully qualified), `tooltip` (the field's `/TU` text, or `null`), `required` (`/Ff` bit 2), `readOnly` (`/Ff` bit 1), and `componentKeys` — the keys of the conversion components that belong to this field (one per widget; a radio group has several), found by applying the PDF server's key rule to each widget's partial field name (the `/T` of its terminal field: camel-cased as lodash `camelCase` does; a leading digit prefixed with `_`; a key already taken by an earlier widget, in page and annotation order, suffixed `_1`, `_2`, …) and keeping only keys present in `formfields.components`. A field whose derived keys are absent from the response gets `componentKeys: []`.
- Fields SHALL be read from the document catalog's AcroForm, not from a form API that strips XFA, so XFA-hybrid documents keep their fields.
- An encrypted document, or one the parser cannot open, SHALL yield `acroform: null` with an `acroformError` string; extraction failure SHALL NOT fail the upload.
- `acroform` SHALL carry no geometry. Field rectangles are not returned, so nothing downstream can build an overlay from them.
- Extraction SHALL be a pure function over the file bytes and the conversion response, with its own unit tests.

#### Scenario: Tooltip and required flag recovered

- **WHEN** the uploaded PDF has a text field named `f1_01[0]` with `/TU (First name)` and the required flag, and the server returns a component with key `f1010` and label `f1_01[0]`
- **THEN** `acroform.fields` contains `{ name: "f1_01[0]", tooltip: "First name", required: true, readOnly: false, componentKeys: ["f1010"] }`

#### Scenario: Radio group maps to every widget's component

- **WHEN** the PDF has a radio group `contactPref` with two buttons and the server returns components `contactPref` and `contactPref_1`
- **THEN** that field's `componentKeys` is `["contactPref", "contactPref_1"]`

#### Scenario: Unreadable or encrypted document does not fail the upload

- **WHEN** the document is encrypted
- **THEN** the result carries the server response, the derived `pdf`, `acroform: null`, and an `acroformError`

#### Scenario: No geometry

- **WHEN** any `acroform.fields` entry is inspected
- **THEN** it has no `rect`, `page`, or other position property

### Requirement: pdf_upload surfaces server errors

A non-OK response SHALL surface as an MCP error carrying the status and URL from the client layer — which today does not include the response body, so a license refusal ("License does not support creating pdf forms") or a size-limit refusal arrives as its status alone and the skill names the likely causes — and a 401 SHALL follow the client's standard portal-login re-authentication and single retry.

#### Scenario: Server refusal is relayed

- **WHEN** the server responds `400`
- **THEN** the tool returns an MCP error containing the status and the upload URL
