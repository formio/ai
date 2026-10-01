## ADDED Requirements

### Requirement: pdf-api.md matches the deployment's PDF routes

`plugin/skills/formio-api/references/pdf-api.md` SHALL document only routes the deployment serves, verified against the Form.io source and a live deployment:

- **Upload** — `POST {projectUrl}/upload` (multipart, one `file` part, `application/pdf`), with prose naming the proxied equivalent `POST {projectUrl}/pdf-proxy/pdf/:projectId/file`. Response: `path` (`/pdf/{projectId}/file/{fileId}`), `file`, and `formfields` with `components` and `nonFillableConversionUsed`. A non-PDF file is answered with `500` and an HTML page.
- **`settings.pdf.src`** — `{filesServer}{path}` when the response names a files server, else `{origin of the Project URL}/pdf-proxy{path}`.
- **Creating a PDF form and its submissions** — the ordinary project routes `POST {projectUrl}/form` and `POST {projectUrl}/form/:formId/submission`, referenced from `project-forms.md` and `runtime-submissions.md` rather than restated.
- **Download token** — `GET {projectUrl}/token` with `x-allow` and `x-expire`, returning `{ token, key }` (two different values); the download URL carries `key` as its `token` query parameter, as the SDK does.
- **Submission download** — `GET {projectUrl}/form/:formId/submission/:submissionId/download`, authenticated by `x-jwt-token` or a `token` query parameter, with the query parameters named as the server reads them, including `margin` (singular), `pageSize`, `orientation`, `language`, and `format` (`pdf` / `html`).
- **Unchanged and verified** — `GET {projectUrl}/pdf-proxy/pdf/:projectId/file` (items `{ _id, form, project, owner, access, created, modified, data: { project, id, path, status } }`), `…/file/:fileId.html`, `…/file/:fileId.pdf`, `POST {projectUrl}/pdf-proxy/pdf/:projectId/download`. A missing file answers `500` with an HTML page, not `404`. An unknown project id returns `[]`, not `404`.
- **Router heading** — `formio-api/SKILL.md`'s PDF navigation heading SHALL NOT state that the scope is rooted at `{projectUrl}/pdf-proxy/`.
- **MCP Tool Preference** — names `pdf_upload` for the upload; the other endpoints remain HTTP-only.

No document under `plugin/skills/` SHALL name `pdf-proxy/upload`, `pdf-proxy/form`, or `pdf-proxy/token`, each of which the deployment answers with `400 {}` like any unrouted path.

#### Scenario: Unrouted endpoints are gone

- **WHEN** any markdown file under `plugin/skills/` is inspected
- **THEN** it contains none of `pdf-proxy/upload`, `pdf-proxy/form`, `pdf-proxy/token`

#### Scenario: Working routes documented

- **WHEN** `pdf-api.md` is inspected
- **THEN** it contains `{projectUrl}/upload`, `{projectUrl}/token`, `nonFillableConversionUsed`, and `margin`
- **AND** it does not contain `https://pdf.form.io`

#### Scenario: Tool preference names pdf_upload

- **WHEN** the `## MCP Tool Preference` section of `pdf-api.md` is inspected
- **THEN** it names `pdf_upload`
