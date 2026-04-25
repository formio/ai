## Context

The Form.io API skills library (produced by the sibling change `formio-api/references/skills-library`) ships 17 capability-group markdown files plus a README index at `skills/formio-api/`. Content quality is high: every file shares a canonical PKCE-JWT authentication paragraph, uniform headings enforced by `packages/mcp-server/src/skills-validator.ts`, strict `baseUrl` / `projectUrl` terminology, and a scope map across platform / project / runtime / pdf.

Claude Code's skill loader, however, discovers skills from one of two fixed locations: `~/.claude/skills/<skill>/SKILL.md` (user-level) or `<project>/.claude/skills/<skill>/SKILL.md` (project-level). The repo already uses this pattern for `formio-form` (at `.claude/skills/formio-form/SKILL.md`). The new library uses a flat layout under `skills/formio-api/` with arbitrary filenames (`project-forms.md`, `runtime-submissions.md`, etc.), so the loader never enumerates it. No skill in the library will activate regardless of user intent.

Even if discoverable, skill activation is driven by the `description` field. Claude matches user intent to descriptions. The new library's descriptions state **capability** ("Project-scope Forms API — list, filter, create, update, and export forms and resources within a Form.io project using the project admin JWT") but omit **trigger intent** ("Use when the user asks to …"). Working skills in this repo (`formio-form`, `openspec-propose`, `loop`) all use trigger-style phrasing — and Claude's own skill documentation recommends it. Without it, ambiguous requests ("work with forms") may miss the skill entirely or land on a sibling scope (`runtime-submissions` versus `project-forms`) by accident.

Finally, the MCP server exposes first-party tools for common form operations (`form_create`, `form_get`, `form_list`, `form_update`). Skills document the equivalent raw HTTP endpoints but never instruct Claude to prefer the tools when both paths exist, so agents may bypass the server's authenticated, type-safe surface for no reason.

## Goals / Non-Goals

**Goals:**

- Make every skill in the Form.io API library discoverable by Claude Code's skill loader without relying on plugins or custom configuration.
- Ensure every skill `description` contains an explicit trigger phrase, common user-language synonyms, and a disambiguation clause for overlapping sibling scopes so activation is accurate.
- Ensure every skill tells Claude to prefer matching MCP tools over raw HTTP when both exist.
- Mechanically enforce all of the above in `skills-validator.ts` so drift is caught by `pnpm test`.
- Preserve the scope map, canonical auth paragraph, terminology rules, and required-heading contract already enforced by the validator.

**Non-Goals:**

- No new MCP tools. Tool coverage stays exactly where `formio-api/references/skills-library` left it.
- No runtime changes to the MCP server. Skills are author-time artifacts consumed by the Claude client.
- No changes to the `## Authentication` canonical paragraph, the `baseUrl`/`projectUrl` terminology rules, or the scope map.
- No plugin packaging — Claude Code's native `.claude/skills/` discovery is sufficient and does not require a plugin manifest.
- No documentation of endpoints beyond what the sibling library already provides. We move and wrap content; we do not re-research Postman.

## Decisions

### Decision 1 — Use Claude Code's native `.claude/skills/<name>/SKILL.md` layout

Every capability-group skill becomes its own directory with a single `SKILL.md` file:

```
.claude/skills/
├── formio-api/SKILL.md                 # router/index (pointer-only)
├── formio-api/references/platform-auth.md
├── formio-api/references/platform-projects.md
├── formio-api/references/platform-teams.md
├── formio-api/references/platform-staging.md
├── formio-api/references/platform-tenants.md
├── formio-api/references/project-auth.md
├── formio-api/references/project-roles.md
├── formio-api/references/project-forms.md
├── formio-api/references/project-form-revisions.md
├── formio-api/references/project-actions.md
├── formio-api/references/runtime-auth.md
├── formio-api/references/runtime-custom-users.md
├── formio-api/references/runtime-access-control.md
├── formio-api/references/runtime-reports.md
├── formio-api/references/runtime-submissions.md
├── formio-api/references/pdf-api.md
└── formio-api/references/server-status.md
```

Frontmatter `name` equals the directory name (`formio-api/references/project-forms`), which matches how `formio-form` works today.

**Alternatives considered:**
- *Ship as a Claude Code plugin*: adds packaging overhead, requires a `plugin.json` and a marketplace entry, and needs users to run `/plugin install` — strictly worse than native discovery for a project-internal library.
- *Keep skills at `skills/formio-api/` and load them via a single discoverable router skill that references supporting files*: `SKILL.md` can reference supporting files within its own directory, but a single router cannot make 17 sibling skills independently activatable. Defeats the whole point of per-capability activation.
- *Use `~/.claude/skills/` (user-level) instead of project-level*: couples the library to the developer's machine and breaks for CI / new clones. Project-level is strictly better.

**Decision**: native `.claude/skills/formio-api-<group>/SKILL.md` directories at project scope, one per capability group, plus a router at `.claude/skills/formio-api/SKILL.md`.

### Decision 2 — Prefix skill names with `formio-api-` to namespace them

Directory names (and frontmatter `name`) use a `formio-api-` prefix. The existing `formio-form` skill keeps its name; new Form.io API skills use `formio-api-<group>`.

**Alternatives considered:**
- *Bare names* (`project-forms`, `runtime-submissions`): collides with generic-looking slugs, and `project-forms` is a confusing global skill name. Rejected.
- *`formio-<group>`* without the `api-` segment: overloads the namespace with `formio-form` (a form-schema skill) and shortens identifiers at the cost of clarity. Rejected.

**Decision**: prefix is `formio-api-`. Router is `formio-api` (bare).

### Decision 3 — Description template with three required clauses

Every capability-group skill's `description` is one sentence of ≤ 2 lines composed of three clauses:

1. **Capability clause** — what the skill covers (essentially what's there today).
2. **Trigger clause** — begins with "Use when the user asks to" followed by 3–6 action verbs and, where applicable, 2–3 user-language synonyms in parentheses. Example: "Use when the user asks to create, list, update, export, or import forms (also called form definitions, form schemas, or form JSON)."
3. **Negative-trigger clause** — begins with "Not for:" and names the sibling skill(s) whose scope would otherwise be conflated. Required for every `project` and `runtime` scope skill (they share `FORMIO_PROJECT_URL`). Optional for `platform` and `pdf` scopes but encouraged wherever overlap exists.

The full description therefore lives entirely in the YAML frontmatter `description` field and is visible to Claude during skill selection. Example for `formio-api/references/project-forms`:

> Project-scope Forms API — list, filter, create, update, import, and export forms and resources within a Form.io project as a project admin. Use when the user asks to create, list, update, export, import, or rename forms, resources, or form definitions (also called form schemas or form JSON). Not for: form submissions (see `formio-api/references/runtime-submissions`), form drafts/revisions (see `formio-api/references/project-form-revisions`), or form actions (see `formio-api/references/project-actions`).

**Alternatives considered:**
- *Multi-sentence freeform descriptions*: harder to enforce mechanically and inconsistent across skills. Rejected.
- *Moving trigger language into the body*: Claude selects skills from the `description` only; body content is read only after activation. A trigger clause in the body does not influence activation. Rejected.

**Decision**: three-clause description template, with the trigger clause mandatory everywhere and the negative-trigger clause mandatory for `project` and `runtime` scopes.

### Decision 4 — New required section `## MCP Tool Preference`

Every capability-group skill adds a new top-level section between `## Authentication` and `## Endpoints`:

```markdown
## MCP Tool Preference

Prefer the MCP server's first-party tools when they cover the requested operation. Call the HTTP endpoint directly only when no MCP tool applies.

| Operation | Preferred MCP tool | Fallback endpoint |
| --- | --- | --- |
| Create a form | `form_create` | `POST ${FORMIO_PROJECT_URL}/form` |
| Get a form by ID or name | `form_get` | `GET ${FORMIO_PROJECT_URL}/form/:idOrName` |
| List forms | `form_list` | `GET ${FORMIO_PROJECT_URL}/form` |
| Update a form | `form_update` | `PUT ${FORMIO_PROJECT_URL}/form/:idOrName` |
```

Skills without any matching first-party tool still include the section with a single sentence: "No MCP tool covers this operation — use the HTTP endpoint directly." This keeps the validator rule uniform and reminds authors of future tools to update the table.

**Alternatives considered:**
- *Embed the guidance inside `## Overview`*: easy to miss on skim, hard to validate. Rejected.
- *Global doc at the router*: Claude reads a single skill at a time; guidance must live inside every skill to be reliably seen. Rejected.

**Decision**: a dedicated, validator-enforced `## MCP Tool Preference` section, positioned between `## Authentication` and `## Endpoints`.

### Decision 5 — Validator extensions enforce all three contracts

`packages/mcp-server/src/skills-validator.ts` gains four additions:

- `REQUIRED_SKILL_DIRS` replaces `REQUIRED_SKILL_FILES`: an array of the 17 `formio-api-<group>` directory names. The library root changes from `skills/formio-api/` to `.claude/skills/`.
- `REQUIRED_HEADINGS` inserts `## MCP Tool Preference` in order between `## Authentication` and `## Endpoints`. All existing per-file order checks cascade.
- A new `validateDescriptionTriggers` rule asserts that `data.description` contains the phrase `use when` (case-insensitive) for every non-router skill.
- A new `validateDescriptionNegativeTrigger` rule asserts that for skills whose `scope` is `project` or `runtime`, `data.description` contains the phrase `not for:` (case-insensitive).
- The router skill (`formio-api/SKILL.md`) is exempt from capability-skill rules (no `scope`, `root_url`, `auth` frontmatter; no `## MCP Tool Preference` section; no trigger clause — the router's description is pointer-only).

**Alternatives considered:**
- *Soft warnings only*: drift goes undetected the moment the author pipeline changes. Rejected — this library's whole value is uniform activation, and uniformity needs a hard gate.
- *Regex the synonyms*: too brittle. Synonyms are a quality guideline enforced by review, not the validator. Rejected.

**Decision**: four new validator rules, all hard failures in `pnpm test`. Synonym quality remains a review responsibility.

### Decision 6 — Remove the old library path entirely

`skills/formio-api/` is deleted after the move. No symlinks, no redirect stubs. Rationale: it was never discoverable by Claude in the first place, so nothing downstream can depend on it yet; leaving it would create a second source of truth and inevitable drift. CLAUDE.md and the root README update to the new path in the same change.

## Risks / Trade-offs

- **Risk**: the sibling change `formio-api/references/skills-library` has not been archived; its specs still live in `openspec/changes/formio-api/references/skills-library/specs/`. Modifying the validator here may force edits to that in-flight change. → **Mitigation**: the two changes are sequenced. This change assumes the library change has been applied to code (files exist under `skills/formio-api/`); it does *not* edit the sibling's openspec artifacts. If the library change is still pending apply, land it first.
- **Risk**: trigger-phrase matching via `use when` is lexical and can be gamed by an author who writes the phrase without real trigger content. → **Mitigation**: accept it. The validator guarantees the phrase is *present*; human review of PRs guarantees the phrase is *useful*. Lexical enforcement is the minimum useful bar.
- **Risk**: adding `## MCP Tool Preference` to every skill inflates file size and duplicates content across 17 skills when most skills have no matching MCP tool. → **Mitigation**: skills without a matching tool use a one-line form. The payload is small and the uniformity buys validator simplicity.
- **Risk**: renaming to `formio-api` may collide with future skill names if the prefix is too generic. → **Mitigation**: the prefix is specific to this library and aligns with the existing `formio-form` pattern; collisions would be deliberate namespace overloads and a pull request would catch them.
- **Trade-off**: Tighter description template reduces author freedom. That is the point — uniform activation beats bespoke prose for an endpoint library.
