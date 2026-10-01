## Purpose

Defines the structure of the consolidated Form.io API skill — one activatable router with per-capability-group reference documents beneath it.
## Requirements
### Requirement: Consolidated Form.io API skill structure

The Form.io API skill library SHALL be implemented as a single activatable skill at `plugin/skills/formio-api/SKILL.md` whose body indexes per-capability-group reference documents stored under `plugin/skills/formio-api/references/<group>.md`.

Reference documents SHALL NOT have YAML frontmatter. Only the router `SKILL.md` carries frontmatter (`name: formio-api`, `description`).

The library SHALL cover these 17 capability groups as reference documents:

- `platform-auth`, `platform-projects`, `platform-teams`, `platform-staging`, `platform-tenants` (platform scope)
- `project-auth`, `project-roles`, `project-forms`, `project-form-revisions`, `project-actions` (project scope)
- `runtime-auth`, `runtime-custom-users`, `runtime-access-control`, `runtime-reports`, `runtime-submissions` (runtime scope)
- `pdf-api` (pdf scope)
- `server-status` (platform scope, unauthenticated)

#### Scenario: Router skill exists with correct frontmatter

- **WHEN** `plugin/skills/formio-api/SKILL.md` is parsed
- **THEN** its frontmatter SHALL contain exactly `name` and `description`
- **AND** `name` SHALL equal `formio-api`

#### Scenario: Every required reference group has a file

- **WHEN** the library is inspected
- **THEN** `plugin/skills/formio-api/references/<group>.md` SHALL exist and be non-empty for every group in `REQUIRED_REFERENCE_GROUPS`

#### Scenario: Reference files have no frontmatter

- **WHEN** any `plugin/skills/formio-api/references/*.md` is parsed
- **THEN** the parsed frontmatter SHALL be empty (the file SHALL NOT begin with `---`)

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

