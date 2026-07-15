## ADDED Requirements

### Requirement: pdf_upload tool is registered with an enrichment-referencing description

The `pdf_upload` tool SHALL be registered on the MCP server with a description stating that it uploads a local PDF template to the project's PDF server and that the returned `formfields.components` are a raw auto-converted skeleton which the `formio-form-builder` skill's PDF flow enriches (labels, validations, conditionals) before the form is created with `form_create`.

#### Scenario: Tool appears in tool listing with skill reference

- **WHEN** the MCP server is initialized with valid configuration
- **THEN** the `pdf_upload` tool is available with required `cwd` and `filePath` parameters
- **AND** the tool description contains the literal substring `formio-form-builder`
- **AND** the tool description mentions enrichment before form creation

### Requirement: pdf_upload posts the file as multipart to the pdf-proxy

The `pdf_upload` tool SHALL read the PDF at `filePath` from the local filesystem, build a `multipart/form-data` body with a single `file` part holding the PDF binary (filename taken from the path), and send it via `formioFetch` as `POST {FORMIO_PROJECT_URL}/pdf-proxy/upload` with the standard auth header. Project resolution SHALL use the same `cwd`-based `resolveProjectConfig` flow as the other tools.

#### Scenario: Happy-path upload

- **WHEN** `pdf_upload` is called with a `filePath` pointing at a readable PDF
- **THEN** it sends `POST {projectUrl}/pdf-proxy/upload` with a multipart body containing the file part
- **AND** the request carries the standard auth header supplied by the client layer

#### Scenario: Missing or unreadable file

- **WHEN** `pdf_upload` is called with a `filePath` that does not exist or cannot be read
- **THEN** it returns an MCP error naming the path, without issuing any HTTP request

### Requirement: pdf_upload returns the conversion response verbatim

The tool SHALL return the server's JSON response unmodified — `path`, `file` (the PDF UUID), and `formfields` (the auto-converted components with `overlay` geometry) — so the agent can enrich the skeleton and reference the PDF in `settings.pdf` when creating the form.

#### Scenario: Response passthrough

- **WHEN** the server responds with `{ path, file, formfields }`
- **THEN** the tool result contains that JSON verbatim, including every `formfields.components[*].overlay` value

#### Scenario: API error passthrough

- **WHEN** the server responds with a non-OK status (e.g. `400` for a non-PDF file, or an error because the project has no PDF server enabled)
- **THEN** the tool returns an MCP error containing the status and URL from the client layer
- **AND** auth failures follow the client's standard 401 portal-login re-auth and single retry

### Requirement: pdf-api.md names pdf_upload for the upload endpoint

The `plugin/skills/formio-api/references/pdf-api.md` upload endpoint documentation SHALL name `pdf_upload` as the preferred MCP tool (replacing "No MCP tool covers this operation" for that endpoint). Other PDF endpoints in the reference remain HTTP-only.

#### Scenario: Reference updated

- **WHEN** `plugin/skills/formio-api/references/pdf-api.md` is inspected
- **THEN** its `## MCP Tool Preference` section names `pdf_upload` for the `pdf-proxy/upload` endpoint
