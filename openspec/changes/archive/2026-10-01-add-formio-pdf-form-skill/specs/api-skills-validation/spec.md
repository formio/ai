## MODIFIED Requirements

### Requirement: PDF-scope endpoints MUST be under /pdf-proxy

Every endpoint heading (`### GET|POST|PUT|PATCH|DELETE <path>`) inside `pdf-api.md` SHALL have a path that begins with `{projectUrl}/` — a route the project serves, either through its PDF proxy (`{projectUrl}/pdf-proxy/…`) or as a project route the enterprise server forwards to the PDF server (`{projectUrl}/upload`, `{projectUrl}/token`, `{projectUrl}/form/:formId/submission/:submissionId/download`). The "PDF server direct API" — any path on a PDF server's own host — is out of scope. The requirement keeps its name for history; the rule it states is that a PDF endpoint is reached through the project, not that it is under `/pdf-proxy`.

#### Scenario: PDF endpoint outside /pdf-proxy fails

- **WHEN** `pdf-api.md` contains `### GET {pdfServer}/pdf/:projectId/file`
- **THEN** `validatePdfProxyPath` SHALL emit a `pdf.proxy_path` issue

#### Scenario: Project-routed PDF endpoints pass

- **WHEN** `pdf-api.md` contains `### POST {projectUrl}/upload` or `### GET {projectUrl}/token`
- **THEN** `validatePdfProxyPath` SHALL emit no issue for it
