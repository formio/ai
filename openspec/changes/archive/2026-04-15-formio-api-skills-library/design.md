## Context

### Terminology (non-negotiable)

Two distinct endpoints exist, and this design NEVER conflates them:

- **`baseUrl` / `base_url` → platform deployment endpoint → `FORMIO_BASE_URL`.** This is the Postman `{{baseUrl}}` variable when used bare (not followed by `{{projectName}}`).
- **`projectUrl` / `{{baseUrl}}/{{projectName}}` → project endpoint → `FORMIO_PROJECT_URL`.** This is a *separate* environment variable, not a computed sub-path.

Throughout this document, if the word "baseUrl" or "base URL" appears, it refers strictly to the platform endpoint. If the project endpoint is meant, the document uses "projectUrl" or `FORMIO_PROJECT_URL` explicitly.

### API scope map

The Form.io API surface in the Postman collection is organized into four scopes. The Postman "Server API" (Health, Status) is part of **Platform Scope** — it shares `${FORMIO_BASE_URL}/` as its root — and is NOT a separate scope. It is maintained as its own skill file purely for activation clarity.

- **Platform Scope** — operates against `{{baseUrl}}/` (i.e., `FORMIO_BASE_URL`): Authentication, Project API, Team API, Staging API, Multi-Tenant API, and the Server API (Health / Status)
- **Project Scope** — operates against `{{baseUrl}}/{{projectName}}` (i.e., `FORMIO_PROJECT_URL`): project-admin Authentication, Project Roles, Forms API, Form Revisions, Action API
- **Runtime Scope** — operates against `{{baseUrl}}/{{projectName}}` (i.e., `FORMIO_PROJECT_URL`): Authentication, Custom User Types, Auth & Authorization, Group Permissions, Report API, Submission API
- **PDF API** — covered exclusively via `${FORMIO_PROJECT_URL}/pdf-proxy` (project-rooted). The Postman `PDF server direct API` group is explicitly out of scope for this library.

The MCP server already implements PKCE browser-login auth (`packages/mcp-server/src/auth.ts`, `ensure-auth.ts`, `token-cache.ts`). On success, `formioFetch` attaches the `x-jwt-token` header automatically. From a skill's perspective, the JWT is obtained transparently — the skill only needs to document the endpoint, method, params, and body.

Skills are Markdown files with YAML frontmatter. Claude activates a skill when its `description` matches the user's request. A skill library for Form.io means a set of focused, single-responsibility Markdown files — one per capability group — each self-sufficient enough that an agent can drive the API without re-reading the Postman documentation.

The `skill-creator` skill (see system-reminder) is the authoring tool: it interrogates intent, structures the skill file, and writes it to disk. Our job here is to define the authoring *contract* (rules, frontmatter, structure) so every skill is produced to the same standard, and to enumerate the concrete list of skills to generate.

## Goals / Non-Goals

**Goals:**

- Produce a Claude-consumable skill library covering every endpoint in the Postman collection
- Make skill selection deterministic: each skill has a focused `description` that triggers only for its capability area
- Guarantee every skill documents PKCE/`x-jwt-token` auth (no `x-token` / API-key paths leaked into skills)
- Guarantee every project-scoped skill resolves `{{baseUrl}}/{{projectName}}` to `${FORMIO_PROJECT_URL}` and every platform-scoped skill resolves a bare `{{baseUrl}}/` to `${FORMIO_BASE_URL}` — never confusing the two
- Make authoring repeatable: a validation test fails CI if any skill violates the rules, so future API additions stay consistent
- Keep the library organized by scope so agents (and humans) can find the right skill quickly

**Non-Goals:**

- No new MCP tools. Skills are runtime documentation for Claude, not tool definitions.
- No automatic HTTP-client generation from the skills (future work, tracked separately).
- No changes to existing auth, token cache, or `formioFetch` code paths.
- No rewriting of the Postman documentation into skill form *verbatim* — skills are curated, example-driven guides, not a 1:1 copy.
- No support for legacy `x-token` auth in skill examples.

## Decisions

### Decision 1: Directory layout mirrors Postman scope groups

```
skills/
├── formio-schema.md                 # existing — untouched
└── formio-api/
    ├── README.md                    # index skill — scope map and skill router
    ├── platform-auth.md
    ├── platform-projects.md
    ├── platform-teams.md
    ├── platform-staging.md
    ├── platform-tenants.md
    ├── project-auth.md
    ├── project-roles.md
    ├── project-forms.md
    ├── project-form-revisions.md
    ├── project-actions.md
    ├── runtime-auth.md
    ├── runtime-custom-users.md
    ├── runtime-access-control.md    # merges "Auth & Authorization" + "Group Permissions"
    ├── runtime-reports.md
    ├── runtime-submissions.md
    ├── pdf-api.md                   # merges PDF API + PDF server direct API, with a clear sub-section split
    └── server-status.md
```

- **Why one skill per group**: groups are already cohesive, Claude's skill-matching works best with focused descriptions, and it mirrors the mental model a human developer uses when reading the Postman docs.
- **Alternatives considered**:
  - *One mega-skill*: rejected — too broad a description, would match nearly any Form.io request and crowd out the existing `formio-schema` and `formio-form` skills.
  - *One skill per endpoint*: rejected — ~100+ files, high maintenance, weak skill descriptions.
- **PDF scope**: `pdf-api.md` documents only the project-rooted `pdf-proxy` endpoints reachable at `${FORMIO_PROJECT_URL}/pdf-proxy/...`. The Postman `PDF server direct API` group is deliberately excluded; agents are instructed to route all PDF operations through the project-proxied path.

### Decision 2: Frontmatter schema

Every skill file MUST declare:

```yaml
---
name: <kebab-case-id>             # must match filename (minus .md)
description: <single sentence>    # activation hint — used by Claude's skill router
scope: platform | project | runtime | pdf
root_url: FORMIO_PROJECT_URL | FORMIO_BASE_URL
auth: pkce-jwt                    # constant — single allowed value
---
```

- `scope` and `root_url` are explicit so validation can check that project/runtime/pdf skills reference `FORMIO_PROJECT_URL` and platform skills reference `FORMIO_BASE_URL`. Note: `server-status.md` uses `scope: platform` because Server API endpoints share the platform root; there is no separate `server` scope.
- **Placeholder substitution rule** (enforced by validation): `{{baseUrl}}/{{projectName}}` → `${FORMIO_PROJECT_URL}`; a bare `{{baseUrl}}/` (not followed by `{{projectName}}`) → `${FORMIO_BASE_URL}`. Neither raw placeholder may appear in any skill body.
- `auth: pkce-jwt` is a fixed string; any other value fails validation.
- **Alternatives considered**: free-form frontmatter (rejected — makes validation impossible); JSON-schema-driven frontmatter (rejected — overkill for 17 files).

### Decision 3: Skill body structure (authoring template)

Each skill body MUST contain these sections in order:

1. `## Overview` — 1–2 sentence summary of the capability group
2. `## Root URL` — explicit statement naming whichever of `FORMIO_PROJECT_URL` or `FORMIO_BASE_URL` is the root for every endpoint in the skill, with an unambiguous Postman mapping. Examples:
   - Project/runtime/pdf: *"All endpoints below are rooted at `${FORMIO_PROJECT_URL}` — the project endpoint, equivalent to `{{baseUrl}}/{{projectName}}` in Postman."*
   - Platform/server: *"All endpoints below are rooted at `${FORMIO_BASE_URL}` — the platform deployment endpoint, equivalent to bare `{{baseUrl}}/` in Postman."*
3. `## Authentication` — boilerplate paragraph referencing PKCE + `x-jwt-token` + the `user-auth` capability (stored as a reusable snippet)
4. `## Endpoints` — one subsection per endpoint with: HTTP method + path, params table, request body shape, response shape, error notes, one worked example (curl or fetch)
5. `## Related Skills` — cross-links to adjacent skills (e.g., `project-forms.md` links to `project-form-revisions.md`)

- **Why a fixed structure**: validation can assert section headings are present; agents can predict where to find information; authoring load is low because `skill-creator` can follow a template.
- **Why a reusable auth snippet**: prevents drift and ensures every skill tells agents the same auth story. The snippet lives at `skills/formio-api/_partials/auth.md` and is either inlined at author time or referenced by `include:` marker (see Decision 4).

### Decision 4: No build-time template expansion — inline the auth snippet

We considered a pre-commit hook or build step that expands `<!-- include: auth.md -->` markers. Rejected because:

- Skills are consumed directly by Claude from the filesystem; a build step adds operational complexity and a new failure mode.
- Inlining is verified by the validation test (string-match the canonical auth paragraph), which catches drift at PR review time without a build pipeline.

Trade-off: if the canonical auth text ever changes, all skills must be updated together. The validation test will flag any file that falls behind, so this is a one-PR sweep, not a hidden-regression risk.

### Decision 5: Validation via Vitest, not a standalone script

- Lives at `packages/mcp-server/src/__tests__/skills-library.test.ts`
- Reads `skills/formio-api/**/*.md` via `fast-glob` (already available transitively, or we add `gray-matter` + `fast-glob` explicitly)
- Asserts for each file: required frontmatter keys, `auth === 'pkce-jwt'`, scope/base-url consistency, required section headings present, canonical auth paragraph present
- Runs as part of `pnpm test` — fails the existing Definition-of-Done gate if any skill drifts
- **Alternatives considered**: shell script (rejected — weaker assertions, harder to extend); eslint rule (rejected — Markdown isn't in the eslint pipeline).

### Decision 6: `skill-creator` drives authoring, humans review

The actual skill content for each of the ~17 files will be produced by invoking the `skill-creator` skill with:

- A pointer to the Postman group it covers
- The authoring template from Decision 3
- The frontmatter schema from Decision 2
- The canonical auth snippet

This keeps authoring consistent and within the spirit of the user's original request. The tasks list (see `tasks.md`) enumerates each skill as a discrete task so progress is trackable.

## Risks / Trade-offs

- **[Risk] Postman doc drift**: The Postman collection may add endpoints after skills are authored. → Mitigation: a `tasks.md` follow-up item to re-review quarterly; validation test guards structure, not content.
- **[Risk] Skill router mis-selection**: Two skills with overlapping descriptions (e.g., `project-auth` vs `runtime-auth`) could both match. → Mitigation: descriptions are explicit about scope ("project admin" vs "end-user runtime"); tested by inspection during PR review.
- **[Risk] Canonical auth text rot**: If PKCE flow changes (e.g., new env var), all 17 skills need updates. → Mitigation: central constant in the validation test; touching it fails until all skills are updated — deliberate coupling.
- **[Risk] Over-documentation crowds context window**: Loading all 17 skills at once would be heavy. → Mitigation: Claude's skill activation is per-request; only the matching skill is loaded. The index skill (`README.md`) is deliberately short.
- **[Trade-off] No code generation**: Skills document endpoints but do not produce typed client code. Agents construct requests themselves via existing MCP tooling or `fetch`. Accepted scope for this change; a future change can generate typed clients from the same source.
- **[Trade-off] Merged skills (PDF, Group Permissions)**: Merging PDF API + PDF server direct API, and Auth & Authorization + Group Permissions, loses 1:1 Postman grouping. Accepted because the merged groups share call patterns and splitting them would create confusingly thin skills.

## Migration Plan

1. Land the authoring contract (frontmatter schema, template, validation test) with zero skills — the validation test passes vacuously.
2. Author the index skill (`skills/formio-api/README.md`) and one pilot skill (`project-forms.md`) to de-risk the template.
3. Author the remaining ~15 skills in parallel PRs or a single sweep — each gated by the validation test.
4. Update root `CLAUDE.md` or `README.md` with a pointer to the library.
5. No rollback needed — skills are additive Markdown; removing them has no runtime effect.

## Open Questions

- **Partials directory**: do we ship `skills/formio-api/_partials/` even though we inline auth text? → Proposed: no; keep it simple. Revisit if inlining causes drift in practice.

## Resolved Questions

- **Platform base URL env var**: `FORMIO_BASE_URL` is used by every platform-scope skill (including `server-status.md`) as the resolution for a bare `{{baseUrl}}/` prefix (i.e., paths that are NOT `{{baseUrl}}/{{projectName}}/...`). No new MCP server code consumes it today — it is referenced purely inside skill documentation and in example commands agents are expected to run.
- **PDF base URL**: `FORMIO_PDF_URL` is NOT introduced. The `pdf-api.md` skill documents PDF operations exclusively through the project-proxied path `${FORMIO_PROJECT_URL}/pdf-proxy`. The Postman `PDF server direct API` group is out of scope.
