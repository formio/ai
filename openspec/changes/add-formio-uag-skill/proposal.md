## Why

UAG 2.0 — the Form.io Universal Agent Gateway — ships agentic forms on top of Form.io: conversation forms over its own MCP endpoint, a chat widget (`Formio.createChat` in `@formio/uag-js`), Agentic Formflow (the stateless Agent API and Agent Input), and agentic workflows (the "Agent: Run task" action). Everything it does is configured in Form JSON (the `uag` tag and `uag*` custom properties) and in its deployment, and none of it is in this library. An agent asked to "let an AI triage this form" or "add a chat to our intake page" today has nowhere to route, and the closest skills give wrong answers: `formio-actions` would try `action_create` for `agentRunTask`, which that tool refuses because Form.io's own catalog does not list it.

## What Changes

- **New skill `formio-uag`** (`plugin/skills/formio-uag/`): a router `SKILL.md` with the shared preflight, a five-step flow (PATTERN → FORM → SERVER → APPLICATION → VERIFY), a `## Security` section for the surfaces it documents (keys, research identity, anonymous cost, browser routing, the shared `JWT_SECRET`, criteria as prompts), the **UAG URL** as a third value the user supplies and `project_set` never records, and ten references authored from the UAG 2.0 developer documentation: patterns and licensing, tasks, form properties, workflows, the Agent API, `@formio/uag-js`, the chat widget, MCP clients, deployment, troubleshooting.
- The skill writes no form itself: new forms go through `formio-form-builder` and saved-form changes through its edit lane, with `uagAnonymous`, `uagTools` and removed `uagAuthoritative` named on their own at that gate. It never calls `action_create` for `agentRunTask`; the action is added in a first build's template, a portal stage connected to the UAG, a UAG module's template, or by the user with Form.io's action API.
- **`formio-actions`**: its `Not for:` clause and Action Types section hand "Agent: Run task" to `formio-uag`.
- **`formio-form`**: a section hands agent work (Agent Input, chat) to `formio-uag`.
- **Every description shortened** (top-level total 12,902 → 9,225 characters, all 17 skills 16,551 → 11,600), keeping every pinned trigger phrase and `Not for:` handoff, so the library stays near Claude Code's skill-listing budget (1% of the context window, about 8,000 characters at 200k tokens). A new test caps the combined total; the READMEs say how to raise the budget.
- **`formio-uag` restructured for compaction**: the surface and reference tables lead the body, so the first 5,000 tokens Claude Code re-attaches after compaction carry them and the Security section.
- **Contents lists** on the `formio-uag` references and the four longest library references.
- Registration: dev symlink, manifests' descriptions, root and plugin READMEs, `CLAUDE.md`, three example prompts under `examples/agents/`.

## Capabilities

### New Capabilities

- `formio-uag-skill`

### Modified Capabilities

- `formio-actions-skill`, `formio-form-skill`: each hands UAG work to `formio-uag`.
- `skill-description-budget`: a combined cap on the top-level descriptions.

## Impact

- Skill prose under `plugin/skills/`; no MCP server code changes.
- Tests: `packages/skill-tests/src/formio-uag/skill-structure.test.ts` (layout, description, every `uag*` property, routes, license split, build-time rules); library counts move from sixteen to seventeen `SKILL.md` files; `formio-uag` joins the Security-section list; the description snapshot records the `formio-actions` change; the tool-reference scanner lists `form_name` / `form_data` (the UAG's own MCP arguments) as look-alikes.
- Routing eval: eight new prompts (six to `formio-uag`, two negatives).
