## Why

The `formio-form` and `formio-schema` skills duplicate the same Form.io form JSON reference content — `formio-form` ships it as one monolithic `SKILL.md`, while `formio-schema` ships a near-identical router plus split reference files under `references/`. Two skills with overlapping triggers means Claude routinely activates the wrong one (or both), and any future update has to be mirrored in both places. At the same time, Form.io has more JSON schemas worth documenting (submissions, actions, projects, roles), and the current `formio-schema` layout assumes "form definition" is the only domain — there is no room to add other schemas without further muddling the structure.

## What Changes

- **BREAKING** Delete the `formio-form` skill entirely. All of its content folds into `formio-schema`.
- Restructure `plugin/skills/formio-schema/references/` from a flat list keyed to form-only concepts into a domain-partitioned tree, with one subdirectory per schema domain the skill will own:
  - `references/form/` — current `form-definition.md`, `base-component.md`, `input-components.md`, `layout-components.md`, `data-components.md`.
  - `references/submission/`, `references/project/` — created as placeholders (each containing a single `README.md` describing what the domain will document and an explicit "Not yet authored — refer to the `formio-api` skill in the meantime" note).
  - Action configs are deliberately out of scope — they belong to the dedicated `formio-actions` skill, so no `references/action/` subdirectory is created. Role schemas are similarly out of scope — the role object is shallow enough that `formio-api`'s `project-roles` reference is sufficient on its own.
- Update `plugin/skills/formio-schema/SKILL.md`:
  - Broaden the `description` so triggers fire for project, form, and submission JSON shapes — not only form-builder concepts.
  - Replace the "When to load which reference" table with a two-level guide: pick a domain first, then pick a reference inside that domain.
  - Update the negative-trigger / overlap clause to reflect that `formio-form` no longer exists and to route action work to `formio-actions`.
- Update MCP tool descriptions (`form_create`, `form_update`) and dependent skill references (`formio-api`, `formio-resource-planner`, plugin README) to point at `formio-schema` instead of `formio-form`.
- Update the plugin packaging contract so `formio-form` is no longer a required bundled skill, and so the `test-plugin.ts` smoke test stops looking for it.

## Capabilities

### New Capabilities

- `formio-schema-skill`: Defines the consolidated, domain-partitioned Form.io JSON schema reference skill — its router `SKILL.md`, its `references/<domain>/` layout (project, form, submission), and the rule that adding a new schema domain MUST be additive (create a new subdirectory under `references/`, do not flatten). Action JSON is explicitly NOT a domain of this skill — the `formio-actions` skill owns it.

### Modified Capabilities

- `form-create`: Tool description references the `formio-schema` skill instead of `formio-form`.
- `form-update`: Tool description references the `formio-schema` skill instead of `formio-form`.
- `claude-plugin-packaging`: Bundled-skill list and `test-plugin.ts` skill-presence check no longer require `formio-form`; `formio-schema` is the only schema-authoring skill that must ship.

## Impact

- **Skills**: `plugin/skills/formio-form/` deleted. `plugin/skills/formio-schema/` restructured (references move into `references/form/`, new placeholder `submission/` and `project/` domain dirs added, `SKILL.md` rewritten). No `action/` or `role/` subdirectories — action JSON is owned by the dedicated `formio-actions` skill and role objects are handled by `formio-api`'s `project-roles` reference.
- **MCP tools**: `packages/mcp-server/src/tools/form_create.ts` and `form_update.ts` tool-description strings change. Existing tests that assert on those strings (`form_create.test.ts`, `form_update.test.ts`) update with them.
- **Plugin packaging**: `scripts/test-plugin.ts` no longer asserts `formio-form` is present; asserts on `formio-schema` instead. `plugin/README.md` skill table loses the `formio-form` row.
- **Other skills**: `formio-api/SKILL.md`, `formio-api/references/project-forms.md`, and `formio-resource-planner/SKILL.md` swap `formio-form` references for `formio-schema`.
- **Tests**: `pnpm test` (Vitest), `pnpm lint` (typecheck), and `pnpm format` must all pass before the change is done. No validator changes are required by this proposal — `skills-validator.ts` does not currently inspect `formio-schema` or `formio-form`.
