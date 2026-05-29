## Why

Form.io authentication and authorization knowledge is currently locked inside `formio-resource-planner`, where it lives as supporting material for resource design (role taxonomy, Login/Role Assignment/Group Assignment actions, `access` vs `submissionAccess`, group-based access patterns). Agents asking auth-only questions ("how do I wire OIDC into Form.io?", "what does the JWT payload look like?", "how do I issue a Custom JWT for an on-prem deployment?", "how do I configure email-token authentication?") have no first-class skill to activate, and the planner has no room to cover SSO (OIDC/SAML/LDAP), Token Swap, Custom JWT, email-token, or the eight-permission RBAC matrix in the depth they deserve. A stand-alone `formio-auth` skill makes auth a peer of resource planning, so the planner can stay focused on data modeling and hand off cleanly to an auth-specialist skill once the resource map is settled.

## What Changes

- Add a new top-level Claude skill at `plugin/skills/formio-auth/` with `SKILL.md` and a `references/` directory covering the full Form.io auth surface.
- `SKILL.md` activates on auth/authorization-only triggers (login, JWT, SSO, OIDC, SAML, LDAP, Token Swap, Custom JWT, email token, roles, permissions, RBAC, group permissions) and disambiguates against `formio-resource-planner` (data modeling) and `formio-application` (full-stack orchestrator) via "Use when…" + "Not for…" clauses, following the same three-clause description template enforced by `packages/mcp-server/src/skills-validator.ts`.
- Author the following reference documents under `plugin/skills/formio-auth/references/` (one `.md` per topic, no frontmatter, MCP-tool-preference section where applicable):
  - `resource-auth.md` — Resource-backed login with Login Action + Role Assignment Action
  - `login-forms.md` — Login & registration form patterns (`access`, `submissionAccess`, anonymous self-register)
  - `roles-and-permissions.md` — Default roles, eight permission types (`create_own`/`create_all`/`read_own`/`read_all`/`update_own`/`update_all`/`delete_own`/`delete_all`), project/form/submission scopes
  - `group-permissions.md` — Group Assignment Action, field-based `submissionAccess` (two-halves pattern), transitive group access via hidden calculated mirrors
  - `sso-oidc.md` — OAuth/OpenID Connect provider setup + OAuth Role Mapping
  - `sso-saml.md` — SAML provider setup + SAML Role Mapping
  - `sso-ldap.md` — LDAP provider setup + LDAP Role Mapping
  - `token-swap.md` — Exchanging an external OIDC token for a Form.io JWT
  - `custom-jwt.md` — Enterprise/on-prem Custom JWT (`JWT_SECRET`, payload shape, `localStorage.formioToken` injection)
  - `email-auth.md` — Email-token (passwordless) authentication
  - `jwt-and-sessions.md` — JWT payload, `x-jwt-token` header, `jti` Session ID, logout semantics, 2FA & reCAPTCHA
- Add the canonical Form.io portal-login JWT auth paragraph and MCP Tool Preference section (preferring `role_*` / `form_*` / `project_*` / `authenticate` first-party MCP tools) to references where they apply, matching the patterns enforced by the skills validator.
- Cross-link `formio-auth` ↔ `formio-resource-planner`: planner emits a "next step → run formio-auth" handoff once roles/login forms/group joins are in the resource map, and `formio-auth` references the planner whenever a configuration requires a new resource, role, or form.
- Update `plugin/skills/formio-resource-planner/SKILL.md` and its `references/` so the auth coverage there shrinks to a high-level pointer ("for any auth-only or SSO question, activate `formio-auth`") and stops being the canonical home for SSO/Token-Swap/Custom-JWT/email-token content the planner never actually covered. **BREAKING** for any caller that previously expected the planner to answer SSO questions directly — they will be routed to `formio-auth` instead. Existing planner sections that are load-bearing for resource emission (roles in `template.json`, Login/Role-Assignment/Group-Assignment action shapes, `submissionAccess` patterns) stay in the planner; only narrative scoping changes.
- Update `CLAUDE.md` "Skills Library" section to list `formio-auth` alongside `formio-api`, `formio-application`, `formio-resource-planner`, and `formio-angular`, and to describe the planner ↔ auth handoff contract.

## Capabilities

### New Capabilities

- `formio-auth-skill`: A stand-alone Claude skill that teaches an AI agent the complete Form.io auth/authz surface — resource-backed login, login-action + role-assignment-action wiring, login/registration form shapes, the eight-permission RBAC matrix, group permissions (single-level + transitive), SSO (OIDC/SAML/LDAP), Token Swap, Custom JWT, email-token, JWT/session mechanics — and coordinates with `formio-resource-planner` so an agent can hand off cleanly between data modeling and auth configuration.

### Modified Capabilities

<!-- None. The `formio-auth` skill is a narrative documentation skill (like `formio-resource-planner` and `formio-application`), not an endpoint catalog. `api-skills-validation` and `api-skills-library` are scoped to `formio-api` specifically (router + per-group endpoint references with `## Overview`/`## Root URL`/`## Authentication`/`## MCP Tool Preference`/`## Endpoints` layout) and do NOT apply to narrative skills. Skills are auto-discovered from `plugin/skills/`, so no registry edit is required. -->


## Impact

- **Affected code**: `plugin/skills/formio-auth/**` (new), `plugin/skills/formio-resource-planner/SKILL.md` + `plugin/skills/formio-resource-planner/references/**` (scoping changes — narrative pointers, no shape changes to action JSON or `submissionAccess` patterns).
- **Affected docs**: `CLAUDE.md` "Skills Library" section to mention `formio-auth` alongside the other top-level skills and describe the planner ↔ auth handoff.
- **APIs**: No MCP tool changes. `formio-auth` references existing tools (`authenticate`, `role_*`, `form_*`, `action_*`, `project_export`/`project_import`) under MCP Tool Preference sections.
- **Dependencies**: No new runtime deps. Skill is documentation-only.
- **Tests**: `pnpm test` already runs the skills validator over `plugin/skills/`. The validator is scoped to the `formio-api` router today and does not enforce shape rules on narrative skills, so no validator changes are needed. The change adds Markdown content only.
- **Eval harness**: Not in scope for this change. A future iteration may add `plugin/skills/formio-auth/evals/` following the `formio-resource-planner` / `formio-angular` pattern.
