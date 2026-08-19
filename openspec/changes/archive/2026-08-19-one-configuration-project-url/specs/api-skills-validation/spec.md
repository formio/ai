## MODIFIED Requirements

### Requirement: Postman placeholders MUST be resolved

Reference docs SHALL resolve Postman collection placeholders to substitution slots:

- `{{baseUrl}}/{{projectName}}` SHALL become `{projectUrl}` in project-, runtime-, and pdf-scope references.
- Bare `{{baseUrl}}/` (not followed by `{{projectName}}`) SHALL become `{baseUrl}` in platform-scope references.

The resolved form SHALL NOT carry an environment-variable name. A slot in an endpoint heading is a value the reader substitutes, and spelling it `${FORMIO_PROJECT_URL}` instructed an agent to read an environment variable in order to build a URL — a different and wrong action.

Placeholders inside fenced or inline code blocks are stripped before matching, so they do not trigger the rule.

#### Scenario: Unresolved project placeholder outside code fences fails

- **WHEN** a project-scope reference contains `{{baseUrl}}/{{projectName}}/form` as prose
- **THEN** `validateReferenceContent` SHALL emit a `placeholder.project` issue

#### Scenario: An environment-variable root fails

- **WHEN** a reference roots an endpoint at `${FORMIO_PROJECT_URL}` or `${FORMIO_BASE_URL}`
- **THEN** validation SHALL emit an issue naming the environment-variable form as non-conformant
- **AND** the fix SHALL be the `{projectUrl}` or `{baseUrl}` slot

### Requirement: PDF-scope endpoints MUST be under /pdf-proxy

Every endpoint heading (`### GET|POST|PUT|PATCH|DELETE <path>`) inside `pdf-api.md` SHALL have a path that begins with `{projectUrl}/pdf-proxy`. The "PDF server direct API" is out of scope.

#### Scenario: PDF endpoint outside /pdf-proxy fails

- **WHEN** `pdf-api.md` contains `### GET {projectUrl}/file`
- **THEN** `validatePdfProxyPath` SHALL emit a `pdf.proxy_path` issue

### Requirement: Terminology — baseUrl vs projectUrl

Reference docs SHALL NOT describe the project endpoint using `baseUrl` / `base_url`, and SHALL NOT describe the platform deployment endpoint using `projectUrl` / `project_url`. The canonical mapping is:

- `projectUrl` / `project_url` → the project endpoint, written `{projectUrl}` where it is a substitution slot
- `baseUrl` / `base_url` → the platform deployment endpoint, written `{baseUrl}` where it is a substitution slot

Validation SHALL additionally reject an `FORMIO_*` name used as a substitution slot or as the name of a value passed between phases. The environment-variable spelling is reserved for text whose subject is the environment.

#### Scenario: Misuse of baseUrl for project endpoint fails

- **WHEN** a reference contains prose `baseUrl is the project endpoint`
- **THEN** `validateTerminology` SHALL emit a `terminology.baseUrl_for_project` issue

#### Scenario: An environment-variable name used as a slot fails

- **WHEN** a reference or skill document uses `FORMIO_PROJECT_URL` as an endpoint root or as the name of a value handed between phases
- **THEN** `validateTerminology` SHALL emit an issue
- **AND** the same name in an environment table or an `env`-block warning SHALL NOT be flagged
