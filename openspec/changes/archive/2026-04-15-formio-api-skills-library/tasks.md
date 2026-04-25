## 1. Validation Suite Foundation
<!-- depends_on: none -->

### Red

- [x] 1.1 Write failing test: a missing skill file in `skills/formio-api/` (e.g., remove `project-forms.md` fixture) causes the suite to fail with a message naming the missing path
- [x] 1.2 Write failing test: a fixture skill file with frontmatter missing the `auth` key fails validation with a message identifying the file and the `auth` rule
- [x] 1.3 Write failing test: a fixture skill file whose `name` frontmatter does not match its filename fails validation
- [x] 1.4 Write failing test: a fixture skill file with `auth: api-key` fails validation
- [x] 1.5 Write failing test: a fixture skill file missing the `## Endpoints` heading fails validation naming the heading
- [x] 1.6 Write failing test: a fixture skill file containing `x-token` outside an allowed context fails validation
- [x] 1.7 Write failing test: a fixture project-scope skill containing the literal `{{baseUrl}}/{{projectName}}` fails validation
- [x] 1.8 Write failing test: a fixture platform-scope skill containing a bare `{{baseUrl}}/` prefix fails validation
- [x] 1.9 Write failing test: a `scope: project` skill with `root_url: FORMIO_BASE_URL` fails the scope/root_url consistency check
- [x] 1.10 Write failing test: a `scope: runtime` skill with `root_url: FORMIO_BASE_URL` fails the scope/root_url consistency check
- [x] 1.11 Write failing test: a `scope: platform` skill with `root_url: FORMIO_PROJECT_URL` fails the scope/root_url consistency check
- [x] 1.12 Write failing test: a `scope: pdf` skill with `root_url: FORMIO_BASE_URL` fails the scope/root_url consistency check
- [x] 1.12a Write failing test: a fixture skill with `scope: server` fails validation because `server` is not an allowed scope value
- [x] 1.13 Write failing test: a `scope: pdf` skill documenting a path that does not begin with `${FORMIO_PROJECT_URL}/pdf-proxy` fails validation
- [x] 1.14 Write failing test: an `## Authentication` section missing the canonical paragraph fails validation (except for `server-status.md`)
- [x] 1.15a Write failing test: a fixture skill containing a sentence like "request the form from the `baseUrl`" in a project-scope context (where the project endpoint is meant) fails the terminology-consistency check
- [x] 1.15b Write failing test: a fixture skill containing a sentence like "call the `projectUrl`" while referring to the platform deployment endpoint fails the terminology-consistency check

### Green

- [x] 1.15 Add `gray-matter` and `fast-glob` (or equivalent) dev dependencies to `packages/mcp-server`
- [x] 1.16 Implement `packages/mcp-server/src/__tests__/skills-library.test.ts` with helpers to load and parse skill files
- [x] 1.17 Implement the frontmatter schema check (exact keys, `name`-filename match, `auth === 'pkce-jwt'`, `root_url` ∈ {`FORMIO_PROJECT_URL`, `FORMIO_BASE_URL`})
- [x] 1.18 Implement the scope/root_url consistency check per the mapping in `api-skills-authoring` (project/runtime/pdf → FORMIO_PROJECT_URL; platform → FORMIO_BASE_URL). Reject any `scope: server` value — `server` is not an allowed scope; `server-status.md` MUST use `scope: platform`.
- [x] 1.19 Implement the required-heading-order check for `## Overview`, `## Root URL`, `## Authentication`, `## Endpoints`, `## Related Skills`
- [x] 1.20 Define and export the canonical authentication paragraph as a constant; implement the presence check (with `server-status.md` exempted)
- [x] 1.21 Implement the forbidden-string check for `x-token`, `FORMIO_API_KEY`, and case-insensitive `api key`
- [x] 1.22 Implement the placeholder checks: reject `{{baseUrl}}/{{projectName}}` in project/runtime/pdf skills and reject bare `{{baseUrl}}/` in platform/server skills
- [x] 1.23 Implement the PDF-scope path check: every endpoint in a `scope: pdf` skill must begin with `${FORMIO_PROJECT_URL}/pdf-proxy`
- [x] 1.24 Implement the required-files-present check driven by the list from `api-skills-library`
- [x] 1.25 Implement the terminology-consistency check: flag sentences where `baseUrl`/`base_url` (outside quoted Postman placeholders) is used to refer to the project endpoint, or `projectUrl`/`project_url` is used to refer to the platform endpoint

### Refactor

- [x] 1.26 Review implementation and refactor as needed

## 2. Index Skill and Coverage Checks
<!-- depends_on: 1 -->

### Red

- [x] 2.1 Write failing test: a required skill file not linked from `skills/formio-api/README.md` causes validation to fail naming the unlinked file
- [x] 2.2 Write failing test: a broken relative link target from `README.md` causes validation to fail naming the missing target
- [x] 2.3 Write failing test: `README.md` containing an endpoint method/path heading (e.g., `### GET /form`) fails the "no endpoint docs in index" rule

### Green

- [x] 2.4 Implement the index-link coverage check (every required skill name appears as a Markdown link in `README.md`)
- [x] 2.5 Implement the link-target-existence check (each linked `.md` under `formio-api/` resolves to a real file)
- [x] 2.6 Implement the "no endpoint docs in index" check (no level-3 heading matching an HTTP method + path in `README.md`)
- [x] 2.7 Author `skills/formio-api/README.md` with the scope map and links to all 17 required skills

### Refactor

- [x] 2.8 Review implementation and refactor as needed

## 3. Pilot Skill — Project Forms
<!-- depends_on: 1, 2 -->

### Red

- [x] 3.1 Write failing test: running the full validation suite on a repo containing only `README.md` fails because `project-forms.md` is missing
- [x] 3.2 Write failing test: `project-forms.md` with invalid frontmatter (e.g., missing `description`) fails validation

### Green

- [x] 3.3 Invoke the `skill-creator` skill to author `skills/formio-api/project-forms.md` covering the Forms API group from the Postman collection (Get forms/resources, Get form by name/tag/id/alias, Create/Update Form, Export Form Data as JSON/CSV)
- [x] 3.4 Verify `project-forms.md` passes all validation checks from group 1 and 2

### Refactor

- [x] 3.5 Review implementation and refactor as needed

## 4. Platform Scope Skills
<!-- depends_on: 3 -->

### Red

- [x] 4.1 Write failing test: running validation with platform-scope files missing fails naming each of `platform-auth.md`, `platform-projects.md`, `platform-teams.md`, `platform-staging.md`, `platform-tenants.md`

### Green

- [x] 4.2 Author `skills/formio-api/platform-auth.md` covering Platform Scope → Authentication (Platform Admin Login, New Platform User, Platform User Login, Get current user, Platform User Logout, Using Identity Providers)
- [x] 4.3 Author `skills/formio-api/platform-projects.md` covering Platform Scope → Project API (Create/List/Update/Get/Export/Import/Delete Project, Access Info)
- [x] 4.4 Author `skills/formio-api/platform-teams.md` covering Platform Scope → Team API (all 15 endpoints)
- [x] 4.5 Author `skills/formio-api/platform-staging.md` covering Platform Scope → Staging API (all 14 endpoints)
- [x] 4.6 Author `skills/formio-api/platform-tenants.md` covering Platform Scope → Multi-Tenant API (all 9 endpoints)
- [x] 4.7 Verify every platform-scope file passes validation

### Refactor

- [x] 4.8 Review implementation and refactor as needed

## 5. Remaining Project Scope Skills
<!-- depends_on: 3 -->

### Red

- [x] 5.1 Write failing test: running validation with remaining project-scope files missing fails naming each of `project-auth.md`, `project-roles.md`, `project-form-revisions.md`, `project-actions.md`

### Green

- [x] 5.2 Author `skills/formio-api/project-auth.md` covering Project Scope → Authentication (Admin Resource, Create/List/Get/Delete Project Admin, Admin Login Form, Admin Login Actions, Project Admin Login)
- [x] 5.3 Author `skills/formio-api/project-roles.md` covering Project Scope → Project Roles (List/Create/Update Role)
- [x] 5.4 Author `skills/formio-api/project-form-revisions.md` covering Project Scope → Form Revisions (Enable, Create/Get draft, Publish, Get revisions, Get specific revision)
- [x] 5.5 Author `skills/formio-api/project-actions.md` covering Project Scope → Action API (all 7 endpoints)
- [x] 5.6 Verify every remaining project-scope file passes validation

### Refactor

- [x] 5.7 Review implementation and refactor as needed

## 6. Runtime Scope Skills
<!-- depends_on: 3 -->

### Red

- [x] 6.1 Write failing test: running validation with runtime-scope files missing fails naming each of `runtime-auth.md`, `runtime-custom-users.md`, `runtime-access-control.md`, `runtime-reports.md`, `runtime-submissions.md`

### Green

- [x] 6.2 Author `skills/formio-api/runtime-auth.md` covering Runtime Scope → Authentication (Create User, User Login, Get Current User, User Logout, Session Expired)
- [x] 6.3 Author `skills/formio-api/runtime-custom-users.md` covering Runtime Scope → Custom User Types and Role Assignments (all 12 endpoints)
- [x] 6.4 Author `skills/formio-api/runtime-access-control.md` merging Runtime Scope → Authentication & Authorization (5) and Group Permissions (15) with clearly labeled sub-sections
- [x] 6.5 Author `skills/formio-api/runtime-reports.md` covering Runtime Scope → Report API (aggregated report)
- [x] 6.6 Author `skills/formio-api/runtime-submissions.md` covering Runtime Scope → Submission API (all 12 endpoints)
- [x] 6.7 Verify every runtime-scope file passes validation

### Refactor

- [x] 6.8 Review implementation and refactor as needed

## 7. PDF and Server Skills
<!-- depends_on: 3 -->

### Red

- [x] 7.1 Write failing test: running validation with `pdf-api.md` and `server-status.md` missing fails naming each file
- [x] 7.2 Write failing test: `server-status.md` containing the canonical authentication paragraph fails validation (server endpoints are unauthenticated)
- [x] 7.3 Write failing test: `pdf-api.md` documenting any endpoint whose path does not begin with `${FORMIO_PROJECT_URL}/pdf-proxy` fails validation

### Green

- [x] 7.4 Author `skills/formio-api/pdf-api.md` covering the project-proxied PDF endpoints at `${FORMIO_PROJECT_URL}/pdf-proxy` (upload PDF, list PDFs, get PDF HTML, download PDF file, create form with PDF, create PDF submission, create PDF form with submission, get temporary download token, download submission as PDF, delete PDF). The Postman "PDF server direct API" group is explicitly excluded.
- [x] 7.5 Author `skills/formio-api/server-status.md` covering Server API (Health, Status) rooted at `${FORMIO_BASE_URL}` with `scope: platform` (Server API is NOT a separate scope — it shares the platform root), with an `## Authentication` section explicitly stating no auth is required
- [x] 7.6 Verify both files pass validation (with the server-status auth-paragraph exemption applied)

### Refactor

- [x] 7.7 Review implementation and refactor as needed

## 8. Repository Wiring
<!-- depends_on: 4, 5, 6, 7 -->

### Red

- [x] 8.1 Write failing test: `pnpm test` exit code reflects any skills-library validation failure (simulated by temporarily breaking a skill fixture)

### Green

- [x] 8.2 Confirm `packages/mcp-server/vitest.config.ts` picks up the new test file (no config change expected — verify)
- [x] 8.3 Update root `CLAUDE.md` with a short pointer to `skills/formio-api/` describing when Claude will activate these skills
- [x] 8.4 Update `README.md` (or `packages/mcp-server/README.md`) with a one-paragraph description of the skills library and a link to the index

### Refactor

- [x] 8.5 Review implementation and refactor as needed
