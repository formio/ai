## Context

Today, Form.io auth knowledge sits inside `plugin/skills/formio-resource-planner/`:

- `SKILL.md` lines 38–90, 122–129, 150–152, 184–209, 263, 270–295 — role taxonomy, `access` vs `submissionAccess`, action ordering, group-based access "two halves" model
- `references/template-json.md` lines 34–81, 102–158, 297–376, 504–590 — JSON shapes for roles, top-level access, `submissionAccess` patterns, Login / Role Assignment / Group Assignment actions, field-based `submissionAccess` on group-reference selects, transitive group-access mirrors
- `references/template-md.md` lines 68–114, 211–270 — Resource Map "Roles" and "Users & Auth" sections, Access Matrix vocabulary, Access Flow Diagram patterns
- `references/examples/task-manager/template.json` — working end-to-end auth wiring
- `references/examples/complex-crm-transitive/` — multi-level transitive group access

What is **not** there today: SSO (OIDC, SAML, LDAP), Token Swap, Custom JWT, email-token, 2FA/reCAPTCHA, the full eight-permission RBAC matrix, JWT/session/`jti` semantics, the `x-jwt-token` header on the wire, project-level vs form-definition vs submission-data permission scoping as documented at https://help.form.io/developers/roles-and-permissions.

The two top-level skills that border this work are:

- **`formio-resource-planner`** — plans roles, login/registration forms, joins, and `submissionAccess` patterns as part of resource design; emits `template.json`.
- **`formio-application`** — full-stack orchestrator that runs planner → `project_import` → framework scaffolding (Angular today). It calls into auth only transitively.

Neither is the right home for "explain OIDC Role Mapping" or "how do I forge a Custom JWT for on-prem". We need a peer skill — narrative, reference-driven — that owns auth end-to-end.

The skills validator (`packages/mcp-server/src/skills-validator.ts`, 476 lines) is scoped only to `formio-api` (the router with `ROUTER_DIR = 'formio-api'`). It does not enforce shape rules on narrative skills, so adding `formio-auth` requires no validator change. Skills are auto-discovered from `plugin/skills/` — no plugin manifest update needed.

Stakeholders: skill authors, agents using the plugin to build/extend Form.io apps, users with SSO or custom-JWT requirements that the planner cannot address.

## Goals / Non-Goals

**Goals:**

- Stand up `plugin/skills/formio-auth/` as a first-class, activatable skill on auth-only triggers.
- Cover the full Form.io auth surface in topic-scoped reference docs: resource login + Login Action, Role Assignment Action, login/registration form shapes, RBAC (roles + the eight permission types across project/form/submission scopes), Group Permissions (single + transitive), SSO (OIDC, SAML, LDAP), Token Swap, Custom JWT, email-token, JWT/session/`jti` semantics, 2FA, reCAPTCHA.
- Make `formio-auth` and `formio-resource-planner` interoperable: each names the other in handoff prose, and `formio-resource-planner` stops claiming SSO/Token-Swap/Custom-JWT/email-token triggers it does not actually cover.
- Use the existing planner JSON shapes (Login Action, Role Assignment Action, Group Assignment Action, `submissionAccess` patterns) as the single source of truth for emitted `template.json` snippets — `formio-auth` references and reuses those, not forks them.
- Prefer first-party MCP tools (`authenticate`, `role_*`, `form_*`, `action_*`, `project_*`) in MCP Tool Preference sections, matching the convention in `formio-api`'s references.

**Non-Goals:**

- No new MCP tools. Auth is configured via existing tools and via the Form.io project portal where appropriate.
- No `formio-auth` eval harness in this change. Pattern is `formio-resource-planner` / `formio-angular`; can be added later under `plugin/skills/formio-auth/evals/`.
- No validator changes. The validator stays scoped to `formio-api`; narrative skills are unchecked for shape today and that stays true here.
- No Angular/React/etc. front-end auth wiring. Framework-specific auth UI is the job of `formio-angular` (and future framework skills), which can reference `formio-auth` for the Form.io side of the contract.
- No removal of auth content from `formio-resource-planner` that is load-bearing for resource emission (action JSON shapes, role objects, `submissionAccess` patterns stay where they are). Only narrative scoping and the trigger surface change.

## Decisions

### 1. Layout: SKILL.md + topic-scoped references/, mirroring `formio-resource-planner`, not `formio-api`

`formio-api` is an endpoint catalog (one file per capability group, strict heading layout enforced by the validator). `formio-auth` is a narrative skill (concepts, configuration walkthroughs, decision trees) — closer in shape to `formio-resource-planner`.

```
plugin/skills/formio-auth/
├── SKILL.md
└── references/
    ├── resource-auth.md
    ├── login-forms.md
    ├── roles-and-permissions.md
    ├── group-permissions.md
    ├── sso-oidc.md
    ├── sso-saml.md
    ├── sso-ldap.md
    ├── token-swap.md
    ├── custom-jwt.md
    ├── email-auth.md
    └── jwt-and-sessions.md
```

**Alternative considered:** Drop everything into a single big `SKILL.md`. Rejected — auth has eleven distinct sub-topics and an agent should be able to navigate to one without loading the others into context.

**Alternative considered:** Add `formio-auth` as a sub-skill under `formio-resource-planner/`. Rejected — auth questions are common without a planning context (e.g., wiring SSO into an existing project), and forcing the planner to be the entry point makes activation worse, not better.

### 2. Activation: three-clause description, auth-only triggers, explicit negative-triggers against planner + application

Skills activate from `description` content. To avoid stealing planner traffic, `formio-auth`'s description follows the same three-clause template used elsewhere in this repo:

> *Capability statement.* *Use when the user asks to …* *Not for: …*

- **Use when** triggers (claimed): login flow, JWT, `x-jwt-token`, SSO, OIDC, OAuth, SAML, LDAP, Token Swap, Custom JWT, `JWT_SECRET`, email token, passwordless, roles, permissions, RBAC, group permissions, "who can read/update/delete", `read_own`/`read_all`/etc., 2FA, reCAPTCHA, Login Action, Role Assignment Action, Group Assignment Action.
- **Not for** (disambiguated):
  - Resource/data modeling, building an app from scratch, planning the resource map → `formio-resource-planner`.
  - Full-stack scaffolding (run planner → import → scaffold a framework) → `formio-application`.
  - Looking up a specific REST endpoint → `formio-api`.
  - Front-end UI wiring (Angular login screen, route guards) → `formio-angular`.

**Alternative considered:** No negative-trigger clause, rely on positive triggers alone. Rejected — the planner today claims terms like "roles", "permissions", "login form" as part of resource design. Without explicit negative-triggers on the planner side AND positive auth-specific claims on the auth side, the two skills race.

### 3. Cross-skill handoff contract

Two directions:

- **Planner → Auth**: After `formio-resource-planner` emits a Resource Map's "Users & Auth" line (`Login: <form>; Register: <form>; Role Assignment: <role>; SSO: <none|OIDC|SAML|LDAP>; Custom JWT: <yes|no>`), it prints a "Next steps" footer:
  > *"For SSO setup, Token Swap, Custom JWT, email-token auth, or detailed RBAC tuning, activate `formio-auth`."*
- **Auth → Planner**: When a `formio-auth` walkthrough requires a missing resource, role, or form (e.g., "add a `user` resource with email + password fields", "add an Authenticated role"), the doc names the planner explicitly:
  > *"This requires a `user` resource and an `authenticated` role. If you do not have them yet, run `formio-resource-planner` to design them."*

**Alternative considered:** Have `formio-auth` emit `template.json` partials directly. Rejected — there is exactly one canonical place for `template.json` emission (the planner) and forking that into auth doubles maintenance for action shapes that are already 100% accurate in `references/template-json.md`. `formio-auth` references those shapes by file path + line range instead.

### 4. Reference-doc rules (lighter than `formio-api`)

`formio-api`'s validator enforces a strict heading layout (`## Overview` / `## Root URL` / `## Authentication` / `## MCP Tool Preference` / `## Endpoints`). That layout makes sense for endpoint catalogs. `formio-auth` is narrative, so each reference doc follows a lighter convention:

1. `## Overview` — 1-paragraph scope statement
2. `## When to use this` — bulleted activation triggers + "not for" pointers to neighbors
3. `## Configuration` — step-by-step setup, with JSON / config snippets
4. `## MCP Tool Preference` — when an MCP tool can do the work, name it (e.g., `role_create`, `action_create`, `authenticate`); when only the portal can do it, say so explicitly
5. `## See also` — cross-references to `formio-resource-planner` (and back-pointers to neighbor refs in `formio-auth/references/`)

The canonical portal-login JWT auth paragraph (the one `formio-api` enforces verbatim) is included in `references/jwt-and-sessions.md` and `references/resource-auth.md` because those reference docs describe the on-the-wire JWT directly. Other docs reference it by link instead of copying.

### 5. Planner scope changes (narrative only, no shape changes)

`plugin/skills/formio-resource-planner/SKILL.md` changes:

- Description's "Not for" clause adds: *"SSO (OIDC/SAML/LDAP), Token Swap, Custom JWT, email-token auth, JWT/session mechanics, 2FA — those go through `formio-auth`."*
- "Determine the user/auth model" section keeps its existing scope (asking who the users are, whether the user resource is the built-in `user`, whether roles are needed, what access pattern fits) but adds a one-liner: *"For anything beyond resource-backed login + Role Assignment + Group Assignment, hand off to `formio-auth`."*
- The "Users & Auth" line in the Resource Map (`SKILL.md` ~lines 184–209) gains an SSO field that emits `<none | OIDC | SAML | LDAP>` and an optional `Custom JWT: <yes | no>` field, both of which are handoff signals.

`plugin/skills/formio-resource-planner/references/template-json.md` is **unchanged**. Action shapes (Login, Role Assignment, Group Assignment), role objects, `access`/`submissionAccess` patterns, and group-reference selects remain canonical there. `formio-auth` references them by file path.

### 6. CLAUDE.md update

Add `formio-auth` to the Skills Library section as a peer of `formio-resource-planner`, name the planner ↔ auth handoff explicitly, and document the layout convention (`SKILL.md` + narrative `references/`).

## Risks / Trade-offs

- **Risk**: Triggers overlap between `formio-auth` ("roles", "permissions") and `formio-resource-planner` ("roles" as part of resource map). → **Mitigation**: planner's "Not for" clause names auth explicitly; `formio-auth`'s positive triggers focus on the *configuration* of auth, not on naming roles inside a resource map.
- **Risk**: Drift between the planner's canonical `template.json` action shapes and any examples copied into `formio-auth`. → **Mitigation**: `formio-auth` references action shapes by `references/template-json.md` file path + line range instead of forking them. JSON examples in `formio-auth` are limited to JWT payloads, SSO settings blocks, and Token Swap headers — content the planner does not own.
- **Risk**: SSO/Token-Swap/Custom-JWT/email-token docs lag the Form.io product if vendors change provider settings. → **Mitigation**: each SSO doc links back to the authoritative `https://help.form.io/developers/auth` page and the per-provider sub-pages; reference docs name "see the linked Form.io docs for current settings" for provider-specific UI fields.
- **Risk**: Validator does not gate `formio-auth` content, so quality drift goes uncaught by `pnpm test`. → **Mitigation**: out of scope for this change; a follow-up can add an eval harness (`evals/evals.json` + `evals/grade.py`) modeled on `formio-resource-planner/evals/`.
- **Trade-off**: Eleven topic files is a lot of surface area. Single-file alternative was rejected (see Decision 1); the cost is real but bounded — each file is short and topic-scoped, and an agent only loads the one it needs.

## Migration Plan

This is a documentation-only change; there is no runtime migration. Steps:

1. Author `plugin/skills/formio-auth/SKILL.md` + the eleven reference docs.
2. Update `plugin/skills/formio-resource-planner/SKILL.md` description (negative-trigger) and "Users & Auth" section (handoff prose + new SSO/Custom-JWT fields).
3. Update `CLAUDE.md` Skills Library section.
4. Run `pnpm test` (validator is scoped to `formio-api` so it should pass without changes), `pnpm lint`, `pnpm format`.
5. No rollback action needed beyond `git revert` — change is additive in `plugin/skills/formio-auth/` and narrative-only in the planner.

## Open Questions

- Should `formio-auth` carry its own `examples/` directory (e.g., a working OIDC config snippet, a Custom JWT generator, an email-token webhook) the way `formio-resource-planner/references/examples/` does? Current decision: **no in this change** — keep examples inline in the reference docs to limit surface area. Revisit when the eval harness is added.
- Should the planner's `Users & Auth` line gain a structured `Token Swap: <yes | no>` field, or is naming SSO + Custom JWT sufficient as a handoff signal? Current decision: **SSO + Custom JWT fields only**; Token Swap is a sub-case of OIDC and the OIDC field carries it.
- 2FA and reCAPTCHA — own reference doc, or sub-section of `resource-auth.md` / `jwt-and-sessions.md`? Current decision: **sub-section of `jwt-and-sessions.md`** (since they layer on top of any auth method and gate JWT issuance), with a one-line pointer from `resource-auth.md`. Open to splitting out if the section grows past ~50 lines.
