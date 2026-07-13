# Add `formio-form` skill

## Why

The skills library has no framework-agnostic "embed a form in my application" skill. Today, embed requests either fall through to `formio-sdk` (an API reference, not a task guide) or get mis-routed to `formio-angular` (Angular-only) / `formio-application` (full app orchestration). Users who just want to drop a Form.io form into an existing page — render by URL or JSON, pre-fill a submission, wire up events, add conditional logic, calculated values, or JSON Logic validation — have no dedicated skill.

## What Changes

- New activatable skill at `plugin/skills/formio-form/` — the library's default "embed a form" entry point, built on the Vanilla JS renderer `@formio/js` (`Formio.createForm` / `Formio.builder`).
- Skill routes to `formio-angular` ONLY when the user explicitly names Angular or `@formio/angular`; otherwise `formio-form` claims all embed/render triggers.
- Reference documents covering:
  - HTML page requirements (script/CSS includes, target `<div>`)
  - Rendering a form by URL (`Formio.createForm(el, url)`)
  - Rendering a form by JSON definition
  - Rendering submissions / pre-filling forms (`submission` set, `src` with submission URL)
  - Controlling the form with JavaScript (events, `form.submission`, `form.getComponent`, methods)
  - Form renderer options (`readOnly`, `noAlerts`, `hooks`, `i18n`, `sanitizeConfig`, etc.)
  - Field Logic (component `logic` arrays)
  - Conditional forms with JSON Logic (`conditional.json`, simple conditionals)
  - Calculated values with JSON Logic (`calculateValue`)
  - Custom validations with JSON Logic (`validate.json` returning `true` or an error string)
  - External data sources and cascading/conditional selects (make → model → year)
  - Worked examples: external data load + submission set, conditional wizards, custom wizards
- Doc examples in the skill are runnable and covered by tests in `packages/skill-tests/src/formio-form/`, executed against the real `@formio/js` in jsdom (same pattern as `formio-sdk`).
- Sibling skill descriptions updated so routing is unambiguous: `formio-sdk`, `formio-application`, and `formio-angular` gain `Not for:` pointers at `formio-form` for framework-agnostic embed requests.

## Capabilities

### New Capabilities

- `formio-form-skill`: The `plugin/skills/formio-form/` skill — directory layout, three-clause description with embed triggers and Angular/Sdk/Application negative triggers, required reference docs, canonical `@formio/js` import + CDN usage conventions, JSON Logic shapes (`validate.json`, `conditional.json`, `calculateValue`), and runnable doc examples verified by `packages/skill-tests/src/formio-form/`.

### Modified Capabilities

- `formio-sdk-skill`: description's `Not for:` clause additionally names `formio-form` for task-oriented "embed/render a form in my page/app" requests (formio-sdk stays the API reference).
- `formio-application-skill`: description's `Not for:` clauses additionally point embed-a-form-in-an-existing-page requests (no app build/orchestration) at `formio-form`.
- `formio-angular-skill`: description's negative-trigger guidance additionally states that framework-agnostic embed requests route to `formio-form`, not `formio-angular`.
- `formio-schema-skill`: the name `formio-form` was previously a form-schema reference skill merged into `formio-schema`; the spec's blanket prohibition ("the repository SHALL NOT contain a separate `formio-form` skill") is lifted — the name is reused for the NEW embed skill, whose scope (rendering/embedding) does not overlap `formio-schema`'s (JSON schema authoring).
- `claude-plugin-packaging`: the plugin bundle SHALL now include the `formio-form` embed skill; the old exclusion assertions (bundle and smoke test) are updated accordingly.

## Impact

- New: `plugin/skills/formio-form/SKILL.md` + `plugin/skills/formio-form/references/*.md`.
- New: `packages/skill-tests/src/formio-form/*.test.ts` (jsdom, real `@formio/js`).
- Modified: `plugin/skills/formio-sdk/SKILL.md`, `plugin/skills/formio-application/SKILL.md`, `plugin/skills/formio-angular/SKILL.md` (description `Not for:` clauses only).
- No changes to the MCP server, plugin packaging manifest beyond the new skill directory, or existing reference docs' content.
- Source material: help.form.io Form Renderer docs, formio.js example pages (fieldLogic, conditions, external, calculated, externalload, conditionalwizard, customwizard), jsonlogic.com operations.
