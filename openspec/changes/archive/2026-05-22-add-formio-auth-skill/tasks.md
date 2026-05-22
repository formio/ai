## 1. Skill scaffold and SKILL.md
<!-- depends_on: none -->

### Red

- [x] 1.1 In a new Vitest file `packages/mcp-server/src/formio-auth-skill.test.ts`, write failing tests that assert: `plugin/skills/formio-auth/SKILL.md` exists and is non-empty; its YAML frontmatter parses; `frontmatter.name === 'formio-auth'`; `frontmatter.description` is a non-empty string.
- [x] 1.2 In the same file, write a failing test that asserts `plugin/skills/formio-auth/references/` exists and is a directory.

### Green

- [x] 1.3 Create `plugin/skills/formio-auth/SKILL.md` with valid frontmatter (`name: formio-auth`, placeholder description for now), an `## Overview` body section, and a "Map of references" body section that lists each reference doc by filename + one-line topic summary.
- [x] 1.4 Create the empty directory `plugin/skills/formio-auth/references/` (with a `.gitkeep` if needed) so the directory-existence test passes ahead of file creation in later groups.

### Refactor

- [x] 1.5 Review implementation and refactor as needed.

## 2. Activation description — three-clause template
<!-- depends_on: 1 -->

### Red

- [x] 2.1 Write a failing test that the `formio-auth` SKILL.md `description` contains the phrase `Use when` (case-insensitive).
- [x] 2.2 Write a failing test that the `description` contains the phrase `Not for` (case-insensitive) AND mentions `formio-resource-planner` AND mentions at least one of `formio-application` / `formio-api` / `formio-angular`.

### Green

- [x] 2.3 Author the final `description` in `plugin/skills/formio-auth/SKILL.md` as a single string with three clauses: (a) capability statement covering resource login, Login/Role-Assignment/Group-Assignment actions, RBAC, group permissions, SSO (OIDC/SAML/LDAP), Token Swap, Custom JWT, email-token, JWT/session mechanics; (b) `Use when the user asks to …` listing the auth-only triggers; (c) `Not for: …` naming `formio-resource-planner` (resource modeling), `formio-application` (full-stack orchestration), `formio-api` (endpoint lookup), and `formio-angular` (front-end UI wiring).

### Refactor

- [x] 2.4 Review implementation and refactor as needed.

## 3. Reference docs — existence, naming heading, no frontmatter
<!-- depends_on: 1 -->

### Red

- [x] 3.1 Write failing tests asserting that all 11 required reference files exist and are non-empty under `plugin/skills/formio-auth/references/`: `resource-auth.md`, `login-forms.md`, `roles-and-permissions.md`, `group-permissions.md`, `sso-oidc.md`, `sso-saml.md`, `sso-ldap.md`, `token-swap.md`, `custom-jwt.md`, `email-auth.md`, `jwt-and-sessions.md`.
- [x] 3.2 Write a failing test that each reference doc's first top-level heading (`#` or `##`) contains the topic word(s) (e.g., `resource-auth.md` first heading mentions "Resource", `sso-oidc.md` first heading mentions "OIDC" or "OAuth").
- [x] 3.3 Write a failing test that no reference doc begins with a line equal to `---` (i.e., no YAML frontmatter on reference docs).

### Green

- [x] 3.4 Create all 11 reference docs with their first heading naming the topic, body content stubbed out (skeleton sections from group 4 will fill them), and no frontmatter.

### Refactor

- [x] 3.5 Review implementation and refactor as needed.

## 4. Reference doc section layout
<!-- depends_on: 3 -->

### Red

- [x] 4.1 Write a failing test that each reference doc contains all five required `##` headings (`Overview`, `When to use this`, `Configuration`, `MCP Tool Preference`, `See also`) AND that they appear in that order.

### Green

- [x] 4.2 In each of the 11 reference docs, populate the five required sections with topic-specific content drawn from the design.md "What Changes" and the inputs in the change directory:
  - `resource-auth.md` — Login Action + Role Assignment Action, JWT in `x-jwt-token`, bcrypt password compare, six-step Form.io auth flow; references the planner's `template-json.md` for action JSON shapes.
  - `login-forms.md` — login + registration form shapes; anonymous `create_own`; admin `create_all`/`read_all`/`update_all`/`delete_all`; brute-force settings; references planner.
  - `roles-and-permissions.md` — three default roles + custom roles; the eight permission types; project / form-definition / submission-data scopes; `Everyone` fixed ID `00000000000000000000000`; `update_all` implies `create_all` on submissions.
  - `group-permissions.md` — Group Assignment Action JSON shape; field-based `submissionAccess` (two-halves model); transitive group access via hidden calculated mirror.
  - `sso-oidc.md` — OAuth/OIDC provider setup + OAuth Role Mapping.
  - `sso-saml.md` — SAML provider setup + SAML Role Mapping.
  - `sso-ldap.md` — LDAP provider setup + LDAP Role Mapping.
  - `token-swap.md` — exchanging an external OIDC token for a Form.io JWT.
  - `custom-jwt.md` — `JWT_SECRET` env var, required payload shape (`external: true`, `form._id`, `project._id`, `user._id`, `user.data`, `user.roles`), `localStorage.formioToken` injection.
  - `email-auth.md` — email/passwordless token flow.
  - `jwt-and-sessions.md` — JWT payload (`iss`, `sub`, `jti`, `iat`, `exp`), `x-jwt-token`, logout invalidates `jti`, 2FA, reCAPTCHA.

### Refactor

- [x] 4.3 Review implementation and refactor as needed.

## 5. MCP Tool Preference content
<!-- depends_on: 4 -->

### Red

- [x] 5.1 Write a failing test that the `## MCP Tool Preference` section in each reference doc is non-empty AND either names at least one approved first-party MCP tool (`authenticate`, `role_create`, `role_list`, `role_update`, `form_create`, `form_get`, `form_list`, `form_update`, `action_create`, `action_list`, `action_get`, `action_update`, `action_delete`, `action_type_get`, `action_types_list`, `project_export`, `project_import`) or contains the phrase `Form.io project portal` (or equivalent "portal-only" wording — define the exact string to test for).

### Green

- [x] 5.2 Fill the `## MCP Tool Preference` section in each reference doc:
  - `resource-auth.md` → `form_create` + `action_create` (Login + Role Assignment actions), `role_create`/`role_list` for roles; `authenticate` for first-time portal login.
  - `login-forms.md` → `form_create` (login + register forms).
  - `roles-and-permissions.md` → `role_create` / `role_list` / `role_update` for roles; `form_update` for `access` / `submissionAccess` updates.
  - `group-permissions.md` → `action_create` (Group Assignment) + `form_update` (field-based `submissionAccess`).
  - `sso-oidc.md` / `sso-saml.md` / `sso-ldap.md` → "Form.io project portal" (UI-only; no MCP tool covers SSO provider configuration today).
  - `token-swap.md` → "Form.io project portal" + reference to `runtime-auth` endpoints in the `formio-api` skill.
  - `custom-jwt.md` → "Form.io project portal" for `JWT_SECRET`; reference the `runtime-auth` reference in `formio-api` for the token-exchange endpoints.
  - `email-auth.md` → `action_create` (Email Authentication action) + `form_create`.
  - `jwt-and-sessions.md` → `authenticate` for portal login; reference `runtime-auth` for `/logout` endpoint.

### Refactor

- [x] 5.3 Review implementation and refactor as needed.

## 6. Canonical portal-login JWT paragraph
<!-- depends_on: 4 -->

### Red

- [x] 6.1 Write a failing test that both `plugin/skills/formio-auth/references/jwt-and-sessions.md` and `plugin/skills/formio-auth/references/resource-auth.md` contain the exact same canonical portal-login JWT authentication paragraph used by `formio-api` (import `CANONICAL_AUTH_PARAGRAPH` from `packages/mcp-server/src/skills-validator.ts` for the comparison string).

### Green

- [x] 6.2 Insert `CANONICAL_AUTH_PARAGRAPH` verbatim into `jwt-and-sessions.md` (inside its `## Configuration` section or a dedicated `## Authentication` sub-heading) and into `resource-auth.md` (inside `## Configuration`), copied character-for-character from `skills-validator.ts`.

### Refactor

- [x] 6.3 Review implementation and refactor as needed.

## 7. Terminology — baseUrl vs projectUrl
<!-- depends_on: 4 -->

### Red

- [x] 7.1 Write a failing test that no reference doc under `plugin/skills/formio-auth/references/` contains the case-insensitive prose pattern that misuses `baseUrl` for a project-scoped operation or `projectUrl` for a platform-deployment operation. (Strip fenced + inline code blocks first, matching the planner-style stripping in `skills-validator.ts`.)

### Green

- [x] 7.2 Audit each reference doc and rewrite any prose that misuses `baseUrl` / `base_url` / `projectUrl` / `project_url` to the canonical `FORMIO_BASE_URL` / `FORMIO_PROJECT_URL` env-var names.

### Refactor

- [x] 7.3 Review implementation and refactor as needed.

## 8. Cross-skill handoff in See also
<!-- depends_on: 4 -->

### Red

- [x] 8.1 Write a failing test that each of `resource-auth.md`, `login-forms.md`, `roles-and-permissions.md`, `group-permissions.md` contains the string `formio-resource-planner` inside its `## See also` section.
- [x] 8.2 Write a failing test that each of `sso-oidc.md`, `sso-saml.md`, `sso-ldap.md`, `token-swap.md`, `custom-jwt.md`, `email-auth.md` contains a link to at least one other reference doc filename inside its `## See also` section.

### Green

- [x] 8.3 Add `formio-resource-planner` references to the four resource-dependent docs' `## See also` sections.
- [x] 8.4 Add neighbor cross-links (e.g., `[jwt-and-sessions.md](./jwt-and-sessions.md)`) to the six SSO / Token Swap / Custom JWT / email-token docs' `## See also` sections.

### Refactor

- [x] 8.5 Review implementation and refactor as needed.

## 9. Planner skill update — description and Users & Auth section
<!-- depends_on: 1 -->

### Red

- [x] 9.1 Write a failing test that `plugin/skills/formio-resource-planner/SKILL.md` description contains `Not for` AND names `formio-auth` AND mentions at least three of: `SSO`, `OIDC`, `SAML`, `LDAP`, `Token Swap`, `Custom JWT`, `email token`, `JWT`, `2FA`.
- [x] 9.2 Write a failing test that the planner's "Users & Auth" Resource Map section (in `SKILL.md` or `references/template-md.md`) emits an `SSO:` field with value pattern `none | OIDC | SAML | LDAP` AND a `Custom JWT:` field with value `yes | no`.

### Green

- [x] 9.3 Edit `plugin/skills/formio-resource-planner/SKILL.md` description to add the "Not for" auth-handoff clause without breaking existing planner triggers; add a "Next steps → activate `formio-auth`" pointer to the narrative wherever the user's requirements include SSO / Token Swap / Custom JWT / email-token / 2FA / RBAC tuning.
- [x] 9.4 Update the planner's "Users & Auth" Resource Map template (`SKILL.md` ~lines 184–209 and `references/template-md.md` ~lines 68–114) to emit the new `SSO:` and `Custom JWT:` fields.

### Refactor

- [x] 9.5 Review implementation and refactor as needed; verify that planner JSON shapes in `references/template-json.md` are unchanged.

## 10. CLAUDE.md Skills Library section update
<!-- depends_on: 1 -->

### Red

- [x] 10.1 Write a failing test (or an assertion in the existing `formio-auth-skill.test.ts`) that `CLAUDE.md` contains the string `formio-auth` AND contains a description of the planner ↔ auth handoff (e.g., contains both `formio-resource-planner` and `formio-auth` within ~10 lines of each other).

### Green

- [x] 10.2 Update the "Skills Library" section of `CLAUDE.md` to list `formio-auth` as a peer of `formio-api`, `formio-application`, `formio-resource-planner`, and `formio-angular`, and to describe the planner ↔ auth handoff (planner owns resources/roles/forms + action JSON shapes; `formio-auth` owns SSO, Token Swap, Custom JWT, email-token, JWT/session mechanics, RBAC tuning).

### Refactor

- [x] 10.3 Review implementation and refactor as needed.

## 11. Definition of Done gates
<!-- depends_on: 2, 3, 4, 5, 6, 7, 8, 9, 10 -->

### Red

- [x] 11.1 Run `pnpm test` from the repo root and confirm that the new `formio-auth-skill.test.ts` tests all pass AND that all pre-existing tests (including the `formio-api` skills validator suite) still pass.
- [x] 11.2 Run `pnpm lint` and confirm zero TypeScript errors.
- [x] 11.3 Run `pnpm format` and confirm no formatting drift.

### Green

- [x] 11.4 Fix any failure surfaced by 11.1 / 11.2 / 11.3 until all three commands exit with status 0.

### Refactor

- [x] 11.5 Review implementation and refactor as needed.
