# Add `formio-form-builder` skill

## Why

The skills library has no orchestrator for the single most common Form.io request: "build me a form." Today a standalone form-creation intent ("create a survey", "I need a contact form", "build a multi-page wizard") has no owner — it mis-routes to `formio-application` (full app orchestration), `formio-resource-planner` (data-model planning), or `formio-schema` (a JSON reference, not a pipeline). Nothing determines the form type (webform vs wizard vs PDF form), authors the definition, persists it via `form_create`, and optionally hands off to embedding.

## What Changes

- New orchestrator skill at `plugin/skills/formio-form-builder/` — same tier and shape as `formio-application` — owning the full "build me a form" pipeline: INTENT → SCHEMA → SAVE → EMBED (conditional).
  - **INTENT** — one batched `AskUserQuestion` interview (mirroring `formio-application`'s INTENT step) capturing (a) form type: `webform` (single-page), `wizard` (multi-page), or `pdf` form — inferred from phrasing when unambiguous and confirmed, asked when ambiguous; and (b) embed intent: embed in an application afterward, or just create in the Form.io project. Embed handoff fires ONLY on an explicit yes.
  - **SCHEMA** — delegate component selection and full form JSON authoring to the existing `formio-schema` skill for the chosen form type. No component/schema documentation is duplicated; `formio-schema` is referenced by name only.
  - **SAVE** — persist the definition via the MCP server's `form_create` tool (which already instructs use of `formio-schema`; no MCP tool changes). Auth errors route through the `authenticate` portal-login flow (`x-jwt-token`; never PKCE or API keys). Confirm the saved form path/URL back to the user.
  - **EMBED** (conditional) — only on an explicit yes at INTENT: hand off to `formio-form` to embed the saved form by its form URL; Angular-explicit requests route through `formio-angular` per existing rules.
- Reference docs (no YAML frontmatter) mirroring `formio-application`'s INTENT.md/IMPORT.md pattern: a form-types reference authored from the official help.form.io docs (form types, PDF forms, nested wizard workflows), the INTENT interview script, the SAVE `form_create` invocation + error handling, and the EMBED handoff contract.
- Routing boundaries encoded in the three-clause description. Sharpest boundary — form vs resource/data model: "build a form to collect X" (standalone form) = `formio-form-builder`; "track X / manage X / app around X" (data model, CRUD, resources) = `formio-application` / `formio-resource-planner`. The description states this rule explicitly.
- Reverse `Not for:` pointers added to sibling descriptions: `formio-application`, `formio-resource-planner`, and `formio-form` each point standalone create-a-new-form requests at `formio-form-builder`. `formio-form` also gains the inbound handoff: when an embed request reveals the form does not exist yet, route to `formio-form-builder` first. `formio-schema`'s description is NOT touched — its spec forbids the string `formio-form` in its description; `formio-form-builder` references `formio-schema` one-way.
- The skill SHIPS in the `@formio/ai` plugin bundle — the `claude-plugin-packaging` spec's bundled-skills list and the `packages/mcp-server/src/__tests__/plugin-build.test.ts` inclusion assertions are updated in this change (the add-formio-form-skill change hit a stale exclusion here; not repeated).
- Dev symlink `.claude/skills/formio-form-builder` like the other orchestrators.
- Structural tests at `packages/skill-tests/src/formio-form-builder/` following the `formio-form` skill-structure.test.ts pattern (frontmatter, three-clause description with all Not-for names, reference docs present/no-frontmatter, MCP Tool Preference section, sibling reverse-pointer assertions). Flow behavior itself is prose/orchestration — no renderer behavior tests.

## Capabilities

### New Capabilities

- `formio-form-builder-skill`: The `plugin/skills/formio-form-builder/` orchestrator — directory layout and dev symlink, three-clause description with single-form-creation triggers and the form-vs-resource boundary rule, the four-step INTENT/SCHEMA/SAVE/EMBED flow with its reference docs, no-duplication constraints (defer to `formio-schema` and `formio-form` by name), MCP Tool Preference (`form_create` / `form_get` / `authenticate`), strict URL terminology, and structural tests.
- `formio-resource-planner-skill`: New (narrow) spec for the existing `formio-resource-planner` skill's routing boundary — its description gains a `Not for:` pointer at `formio-form-builder` for standalone single-form creation requests. (The planner has no spec today; this capability starts with the routing requirement only.)

### Modified Capabilities

- `formio-application-skill`: description's `Not for:` clauses additionally point standalone single-form creation requests ("build/create a form", surveys, contact forms) at `formio-form-builder`; the orchestrator hands off to `formio-form-builder` when the user asks to create a standalone form rather than a resource/data model or app.
- `formio-form-skill`: description gains a `Not for:` pointer at `formio-form-builder` for create-a-new-form requests (`formio-form` stays embed-only); the skill routes to `formio-form-builder` when the form to embed does not exist yet or the request needs form-type determination. (Base spec currently lives in the unarchived `add-formio-form-skill` change; this delta layers on top of it.)
- `claude-plugin-packaging`: the plugin bundle SHALL include the `formio-form-builder` skill; build/smoke test inclusion assertions updated accordingly.

## Impact

- New: `plugin/skills/formio-form-builder/SKILL.md` + reference docs; `.claude/skills/formio-form-builder` symlink.
- New: `packages/skill-tests/src/formio-form-builder/skill-structure.test.ts`.
- Modified: `plugin/skills/formio-application/SKILL.md`, `plugin/skills/formio-resource-planner/SKILL.md`, `plugin/skills/formio-form/SKILL.md` (description clauses + handoff prose only); `packages/mcp-server/src/__tests__/plugin-build.test.ts` (inclusion assertion).
- No MCP server changes — `form_create`, `form_get`, and `authenticate` already exist and `form_create` already instructs use of `formio-schema`.
- Source material (authoring inputs, not runtime dependencies): help.form.io Form Types, PDF Forms, and Nested Wizard Workflow docs.
