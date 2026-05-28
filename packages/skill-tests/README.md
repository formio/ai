# @formio/skill-tests

One-shot integration tests that verify the code examples shipped in the Form.io skill library at [`plugin/skills/`](../../plugin/skills/) actually work against the real Form.io SDK at runtime.

Unlike a documentation linter, these tests don't parse the markdown — they hand-import the same modules each example imports (`@formio/js`, `@formio/js/utils`), call the same functions with the same arguments, and assert the same outputs. When the SDK changes its export shape or a reference doc drifts from the underlying source, the relevant test fails with a clear pointer to the bad example.

## What's covered

One Vitest file per reference doc under [`plugin/skills/formio-sdk/references/`](../../plugin/skills/formio-sdk/references/):

| Reference doc | Test file | Style |
| --- | --- | --- |
| `setup.md`, `auth.md`, `forms.md`, `submissions.md`, `projects.md`, `roles.md`, `files.md`, `plugins.md`, `rendering.md` | [`src/formio-sdk/sdk-surface.test.ts`](src/formio-sdk/sdk-surface.test.ts) | Surface presence — every claimed static/instance method on `Formio` is asserted to be a callable function; URL config and the plugin lifecycle are exercised end-to-end. |
| `utils-evaluator.md` | [`src/formio-sdk/utils-evaluator.test.ts`](src/formio-sdk/utils-evaluator.test.ts) | Execution — every example is run and its documented output is asserted. |
| `utils-form-traversal.md` | [`src/formio-sdk/utils-form-traversal.test.ts`](src/formio-sdk/utils-form-traversal.test.ts) | Execution against a synthetic form definition. |
| `utils-conditions.md` | [`src/formio-sdk/utils-conditions.test.ts`](src/formio-sdk/utils-conditions.test.ts) | Execution. |
| `utils-logic.md` | [`src/formio-sdk/utils-logic.test.ts`](src/formio-sdk/utils-logic.test.ts) | Execution. |
| `utils-jsonlogic.md` | [`src/formio-sdk/utils-jsonlogic.test.ts`](src/formio-sdk/utils-jsonlogic.test.ts) | Execution. |
| `utils-mask-sanitize.md` | [`src/formio-sdk/utils-mask-sanitize.test.ts`](src/formio-sdk/utils-mask-sanitize.test.ts) | Execution. |
| `utils-misc.md` | [`src/formio-sdk/utils-misc.test.ts`](src/formio-sdk/utils-misc.test.ts) | Execution. |

The Vitest environment is `jsdom` because `@formio/js` pulls in DOM-dependent modules (dragula, DOMPurify, …) at import time.

## Running

```bash
pnpm --filter @formio/skill-tests test
```

Or via the repo-wide Turbo pipeline:

```bash
pnpm test
```

## Interpreting failures

These tests are deliberately one-shot — they are not maintained against a moving target. **A failing test is a signal that the skill reference doc and the SDK have diverged.** Two flavors:

- **Missing surface** — the reference claims `Utils.X` or `Formio.Y` exists but it isn't exported under that name. Action: update the reference (the method may have been renamed, moved to a different namespace, or removed). Examples observed at the time of writing:
  - `Utils.jsonLogic` (referenced in `utils-jsonlogic.md`) is not exposed on the `Utils` namespace.
  - `Utils.registerEvaluator` is exported at the module level as `registerEvaluator`, not as a property of `Utils`.
  - `Utils.dom`, `Utils.jwtDecode`, `Utils.date`, `Utils.I18n`, `Utils.unwind`, `Utils.override`, `Utils.checkLegacyConditional` are referenced in the skill but not on `Utils`.
  - `Formio.clearTokens` is referenced but not exported; the runtime exposes `Formio.tokens` and `Formio.clearCache` instead.
  - `Formio.Providers.storage` is referenced but the real path is `Formio.Providers.providers.storage` (plus `addProvider`).
  - `new Formio(projectUrl).projectRoles` is referenced but the instance method does not exist; only the static `Formio.projectRoles(formio?)` does.

- **Documented behavior differs** — the reference shows an example output that the SDK does not produce. Examples observed:
  - `Utils.matchInputMask('acm-001', getInputMask('AAA-999'))` returns `true` (the SDK's `A` token is case-insensitive), but the example asserts `false`.
  - `Utils.getComponentValue(form, data, 'data.address.line1')` returns `undefined`; the SDK expects the path **without** the leading `data.` prefix (`'address.line1'`).
  - `Utils.eachComponentData` callback's `contextualData` parameter is the full data tree, not the row of data at the current path. The example's `contextualData[component.key]` returns `undefined` for nested components — the `row` argument is what the example actually needs.
  - `Utils.Evaluator.interpolateString(..., { noeval: true })` returns the user-supplied string verbatim (does not HTML-escape), contrary to the example's comment.
  - `Utils.eachComponent` skips layout components (panel) by default, so `return true` in the callback never fires for them — the "stop descent into hidden containers" example needs `includeAll` to actually visit and short-circuit the panel.
  - `Utils.checkTrigger(..., { type: 'javascript', javascript: 'result = data.qty > 10' })` throws — the JS-trigger evaluator does not expose `data` directly as documented.

## Adding tests for a new skill

1. Add a `src/<skill-name>/` directory and one test file per reference doc.
2. Mirror each example block: import the same modules, call the same APIs with the same arguments, and assert the documented output.
3. Prefer execution tests over surface-presence tests where possible — execution catches behavior drift, surface presence catches only export drift.
