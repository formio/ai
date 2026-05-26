## Context

The skills library currently ships two near-overlapping skills covering the Form.io form JSON schema:

- `plugin/skills/formio-form/SKILL.md` — a single 584-line monolithic skill documenting form, base component, input components, layout components, and data components in one file.
- `plugin/skills/formio-schema/SKILL.md` + `plugin/skills/formio-schema/references/*.md` — a router skill that points at five reference files: `form-definition.md`, `base-component.md`, `input-components.md`, `layout-components.md`, `data-components.md`. Its content is functionally a re-cut of `formio-form` into smaller files.

Both skills' frontmatter `description` fires on the same triggers ("Form.io form JSON", `components`, etc.), so Claude routinely activates the wrong one or both. Whichever fires, the user sees roughly the same information. Maintaining both means every schema fix lands twice (or, more often, once and silently drifts).

Other parts of the codebase reference `formio-form` by name in tool descriptions, validator tests, plugin packaging, and other skills:

- MCP tools: `packages/mcp-server/src/tools/form_create.ts`, `packages/mcp-server/src/tools/form_update.ts`.
- Tests: `packages/mcp-server/src/__tests__/form_create.test.ts`, `form_update.test.ts`, `plugin-build.test.ts`.
- Smoke test: `scripts/test-plugin.ts`.
- Skills: `plugin/skills/formio-api/SKILL.md` (negative-trigger clause), `plugin/skills/formio-api/references/project-forms.md`, `plugin/skills/formio-resource-planner/SKILL.md` (two cross-references).
- Plugin docs: `plugin/README.md` skill table.
- Existing specs: `openspec/specs/form-create/spec.md`, `openspec/specs/form-update/spec.md`, `openspec/specs/claude-plugin-packaging/spec.md`.

Separately, the user wants `formio-schema` to grow to cover other Form.io JSON schemas — submissions and projects — not just form definitions. Action JSON is explicitly out of scope here because the dedicated `formio-actions` skill already owns it; role JSON is also out of scope because the role object is shallow enough that the `formio-api` `project-roles` reference is sufficient. The current flat `references/` layout puts form-specific files at the top level (`form-definition.md`, `base-component.md`, etc.), which would collide as soon as we add, say, a `submission-definition.md` or a separate `base-component.md` for a different domain.

## Goals / Non-Goals

**Goals:**

- Eliminate the duplicate `formio-form` skill. One skill, `formio-schema`, owns every Form.io JSON schema reference.
- Lay out `formio-schema/references/` so each schema domain owned by the skill (form, submission, project) lives in its own subdirectory. Action JSON and role JSON are explicitly out of scope and have no subdirectory under `references/` — `formio-actions` covers actions and `formio-api`'s `project-roles` covers roles. Adding a new domain in the future is an additive change to the directory tree and the SKILL.md router table.
- Preserve all current technical content. No reference property tables are dropped during the merge — the existing five `formio-schema/references/*.md` files are the canonical content, and any net-new property docs that exist in `formio-form/SKILL.md` but not in `formio-schema/references/*.md` get merged in (verified file-by-file during implementation).
- Update every cross-reference in the repo so nothing still points at `formio-form`.
- Keep the change purely structural and documentary. No MCP server behavior changes.

**Non-Goals:**

- Authoring the actual submission / action / project / role schema reference content. This change creates the *directory structure* and placeholder README files only; filling those references is follow-up work.
- Adding schema-skill validation to `packages/mcp-server/src/skills-validator.ts`. The validator currently inspects only `formio-api`; extending it to enforce the new `formio-schema` layout is out of scope and would be its own proposal.
- Changing MCP tool inputs/outputs. Only the tool *description strings* change (skill name swap).
- Backwards-compatibility aliases. There is no shim mapping old `formio-form` references to `formio-schema`; the change is a hard rename per CLAUDE.md ("No backward compatibility unless explicitly requested").

## Decisions

### Decision: Partition `references/` by schema domain, one subdirectory per domain

`plugin/skills/formio-schema/references/` becomes:

```
references/
  form/
    form-definition.md
    base-component.md
    input-components.md
    layout-components.md
    data-components.md
  submission/
    README.md           # placeholder describing future content
  project/
    README.md           # placeholder describing future content
```

Action JSON is intentionally absent — `formio-actions` already owns the action schema. Role JSON is also intentionally absent — the role object is shallow (`title`, `description`, `admin`, `default`, `machineName`) and the `formio-api` `project-roles` reference is sufficient on its own.

**Why subdirectories, not filename prefixes:** A prefixed flat layout (`form-base-component.md`, `submission-shape.md`) leaks the domain into every filename, makes the directory listing hard to scan, and gets ugly fast if any domain needs more than three or four references. Subdirectories give each domain its own namespace, so `base-component.md` can mean different things in `form/` vs. (hypothetically) some other domain.

**Why ship placeholder `README.md`s for the empty domains:** The user explicitly asked the restructure to "leave room for other schema definitions." An empty directory git-ignores away; a `README.md` placeholder documents intent, is discoverable when someone greps the skill, and tells Claude where to start when those domains are actually authored. Each placeholder includes a "Not yet authored — refer to the `formio-api` skill in the meantime" note so a user who navigates there gets actionable guidance.

**Alternatives considered:**

- **Flat layout with `domain-` prefix.** Rejected — see above.
- **Keep current flat layout, just rename `form-definition.md` → `submission-definition.md` later.** Rejected — assumes every future domain has only one file. Form already has five.
- **One subdirectory per file group, no placeholders.** Rejected — the user explicitly wants visible "room" for future schemas, and empty directories don't survive git.

### Decision: Merge `formio-form/SKILL.md` content into `formio-schema/references/form/*.md` before deletion

The current `formio-schema/references/*.md` files are the merge target. During implementation, walk through `formio-form/SKILL.md` section by section against the corresponding `formio-schema/references/*.md` file. If a property table row, validation rule, or component sub-section exists in `formio-form` but not in `formio-schema`, port it over. The two skills *should* be near-identical content-wise, but the merge step is the safety net against silently dropping a property.

**Alternative considered:** Delete `formio-form` outright and trust `formio-schema` as-is. Rejected — even one missing property would be a regression. The merge step costs one careful read-through and a diff; the cost of a silent drop is open-ended.

### Decision: Broaden `formio-schema/SKILL.md` description to cover project / form / submission JSON

Today the description fires on form-building concepts. After the change, the description must fire on project, form, and submission JSON shapes — but not on actions (owned by `formio-actions`) and not on roles (handled by `formio-api`'s `project-roles`). The new description follows the three-clause template used by `formio-api`:

1. **Capability statement** — "Form.io JSON schema reference covering the document shapes for projects, forms (and resources), and submissions."
2. **Trigger clause** — "Use when the user asks to construct, edit, or interpret any Form.io project / form / submission JSON — form components, submission payloads, or project templates."
3. **Negative-trigger clause** — "Not for: calling Form.io REST endpoints (see `formio-api`); configuring server-side actions on a form (see `formio-actions`); planning a new app's resource model (see `formio-resource-planner`); orchestrating an entire app build (see `formio-application`)."

The negative-trigger clause stops mentioning `formio-form` because that skill is gone, and adds `formio-actions` so action-related prompts route there instead.

### Decision: SKILL.md router table becomes two-column "domain → reference"

Replace the current "Working on… / Load" single-column table with a domain-grouped layout:

```markdown
### Form definitions

| Working on…                                                | Load                                   |
| ---------------------------------------------------------- | -------------------------------------- |
| Top-level form properties (`title`, `path`, `display`, …)  | `references/form/form-definition.md`   |
| Properties shared by all components                        | `references/form/base-component.md`    |
| A specific input field (textfield, number, select, …)      | `references/form/input-components.md`  |
| Visual layout containers (panel, columns, tabs, …)         | `references/form/layout-components.md` |
| Nested or repeatable data (container, datagrid, …)         | `references/form/data-components.md`   |

### Submissions and Projects

| Domain     | Status                                                                        | Load                              |
| ---------- | ----------------------------------------------------------------------------- | --------------------------------- |
| Submission | Not yet authored — use `formio-api`'s `runtime-submissions` reference for now | `references/submission/README.md` |
| Project    | Not yet authored — use `formio-api`'s `platform-projects` reference for now   | `references/project/README.md`    |
```

A short prose paragraph beneath the second table tells the reader that action configs live in the dedicated `formio-actions` skill and that role objects are handled by `formio-api`'s `project-roles` reference — so neither is a domain of this skill.

This makes the "leave room" intent visible at the top of the skill and gives Claude a clear fallback for unauthored domains.

### Decision: Tool description strings rename `formio-form` → `formio-schema` verbatim

`form_create.ts` and `form_update.ts` currently say "use the formio-form skill". They will say "use the formio-schema skill". No semantic change beyond the name swap. The specs for those tools (`form-create`, `form-update`) are updated under `## MODIFIED Requirements` with the full requirement text re-pasted with the new skill name.

### Decision: Plugin packaging contract drops `formio-form` and keeps `formio-schema`

`claude-plugin-packaging` spec lists both today. The MODIFIED delta replaces both occurrences with `formio-schema` only. `scripts/test-plugin.ts` asserts on `formio-schema` (it currently asserts on `formio-form`).

## Risks / Trade-offs

- **Risk:** A property documented only in `formio-form/SKILL.md` is dropped during the merge. → **Mitigation:** Walk both files side by side during implementation; verify each component type's property table from `formio-form` exists in the corresponding `formio-schema/references/*.md`. The implementation task list calls this out as an explicit check before deleting `formio-form/`.
- **Risk:** A consumer outside this repo (downstream docs, blog posts, internal tickets) references `formio-form` by name and breaks. → **Mitigation:** This is a documentation skill, not a public API. The plugin ships as `@formio/ai`; consumers interact via the MCP server and Claude's skill activation, which both use the new name once we update the description strings. We accept the rename per the "no backwards compatibility" rule in CLAUDE.md.
- **Risk:** Claude activates `formio-schema` less reliably for plain "build me a form" prompts because the description now spans more domains. → **Mitigation:** The trigger clause keeps the existing form-builder phrases ("components", "wizard", "textfield", etc.) alongside the new domain triggers. If activation precision drops, follow-up work can tune the description; this proposal does not commit to specific precision targets.
- **Risk:** Placeholder `README.md` files in `submission/`, `action/`, `project/`, `role/` get ignored and never filled. → **Mitigation:** This is acceptable. The placeholders' job is to signal intent and route the user to `formio-api` in the meantime. Authoring those references is explicitly out of scope for this change.
- **Trade-off:** This change touches both the skill content and the tool descriptions in one proposal. Splitting it would mean two sequential merges where one suffices, at the cost of one larger review.

## Migration Plan

1. Implement the directory restructure and content merge on a feature branch.
2. Update all cross-references in tools, tests, scripts, and other skills in the same commit.
3. Update the OpenSpec change archive when the work merges; existing specs adopt the MODIFIED deltas.
4. No runtime migration is required — there is no persisted state. The next time a Claude Code user pulls the plugin update, they get the new skills layout.
5. Rollback: revert the merge commit. The previous `formio-form` directory and `formio-schema` flat layout reappear unchanged.
