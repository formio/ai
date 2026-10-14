## Why

A focused review of the 25-tool surface that 1.0 freezes, followed by an adversarial triage of its 21 findings, left two to fix before the release, plus one one-line annotation fix:

- **Action conditions are lost or refused.** Form.io's portal stores every action's condition as `{conjunction: '', conditions: [], custom: ''}`. The action input schema accepts only `conjunction: 'all' | 'any'`, so saving a portal-built action back with `action_update` is refused. The obvious workaround, `'all'`, has the schema silently drop `custom`. The save then replaces the condition, and the action runs on every submission.
- **Unknown arguments are silently ignored on 24 of the 25 tools.** An agent that passes `projectUrl` to a write tool writes to the project the folder resolves to and is told nothing. This is the one decision 1.0 cannot reverse: strict schemas can be relaxed in a 1.0.x patch, but tightening after 1.0 is a breaking change.
- **`project_import` is annotated idempotent**, although each import recreates actions under new ids and its own timeout error says not to retry blind.

## What Changes

- **Action conditions:**
  - The `action_create` / `action_update` condition schema accepts every shape Form.io stores: `conjunction` of `''`, `all`, or `any`; `custom` (a JavaScript or JSON Logic string); legacy keys; and `null`.
  - Rows keep the server's 18 operators.
  - `settings` may be `null`.
- **Unknown arguments:** every tool's top-level arguments are a strict object, as `project_set`'s already are. A call with an undeclared argument is refused, naming it. Form, action, role, and template bodies stay open.
- **`project_import`** is annotated `idempotentHint: false`.

## Capabilities

### New Capabilities

- `tool-input-schemas`: tools refuse undeclared top-level arguments.

### Modified Capabilities

- `action-crud`: the condition shape the action tools accept.
- `project-import`: its annotations.

## Impact

- **Code:** `packages/mcp-server` tool registrations, `action-schema.ts`, and the `project_import` annotation, with tests; plus a live case that round-trips a portal-shaped action condition.
- **tools/list:** grows by about 850 bytes, staying under the 42,000-byte budget.
- **Changeset:** `@formio/mcp` patch, folding into 1.0.0.
