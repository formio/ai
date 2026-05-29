## Why

Agents authoring code against `@formio/js` lack a grounded reference for the SDK and Utility surfaces. Online documentation drifts from the actual source in `packages/core` and `packages/formio.js`, so Claude routinely emits wrong imports, missing `setBaseUrl`/`setProjectUrl` configuration, or guessed Utils signatures. A source-derived skill closes that gap and prevents broken consumer code in both Hosted and SaaS environments.

## What Changes

- Introduce a new top-level skill at `plugin/skills/formio-sdk/` covering the Form.io JavaScript SDK (`@formio/js`) and the Form.io Utilities (`@formio/js/utils`), derived directly from the Form.io source code — not online docs.
- Author `SKILL.md` with a three-clause description (capability statement, "Use when…" trigger clause, "Not for: …" negative-trigger clause) that disambiguates from `formio-api` (REST endpoints), `formio-application` (orchestrator), and `formio-resource-planner` (planning).
- Mandate the canonical imports — `import { Formio } from '@formio/js'` and `import { Utils } from '@formio/js/utils'` — and reject `@formio/core` or `@formio/js/lib/...` deep imports in examples.
- Document base/project URL configuration as a first-class requirement, with separate Hosted and SaaS examples (`https://forms.mysite.com` + `/myproject` vs. `https://api.form.io` + `https://myproject.form.io`).
- Document rendering a Form.io form inside a plain (VanillaJS) consumer using `Formio.createForm(element, formSrc, options)`, covering form load, prefill, submission, event handling, wizard, builder, PDF, and read-only flows. All examples MUST use the ESM `import { Formio } from '@formio/js'` pattern — NOT the `<script>` tag style shown on `formio.github.io/formio.js/app/examples`. The public examples are referenced for behavior coverage, not for import style.
- Split SDK and Utils coverage into reference documents under `plugin/skills/formio-sdk/references/` (one file per capability group: auth, forms, submissions, projects, roles, files, plugins, rendering, utils-evaluator, utils-components, utils-formula, etc.), each with worked examples sourced from the actual implementations in `core/src/sdk`, `core/src/utils`, `formio.js/src/Formio.js`, and `formio.js/src/utils`.
- Extend the skills validator (`packages/mcp-server/src/skills-validator.ts`) to enforce the new skill's required frontmatter, description clauses, import-statement examples, and base/project URL guidance.

## Capabilities

### New Capabilities

- `formio-sdk-skill`: Source-derived Claude skill that teaches the `@formio/js` SDK and `@formio/js/utils` Utilities, mandates the canonical imports, enforces explicit `setBaseUrl`/`setProjectUrl` configuration for Hosted vs. SaaS environments, and documents VanillaJS form rendering via `Formio.createForm` (ESM imports only — no `<script>` tag style).

### Modified Capabilities

- `api-skills-validation`: Validator gains rules for the `formio-sdk` skill — required reference files, presence of the canonical import statements, presence of the Hosted-vs-SaaS URL configuration block, and the three-clause description template.

## Impact

- New directory tree: `plugin/skills/formio-sdk/SKILL.md` and `plugin/skills/formio-sdk/references/*.md`.
- Modified file: `packages/mcp-server/src/skills-validator.ts` (and its Vitest tests) to add `formio-sdk` checks.
- No runtime MCP server code or tool registry changes; no new dependencies. Source consulted during authoring lives outside this repo (the Form.io source repository (kept outside this repo at authoring time)) and is not vendored.
