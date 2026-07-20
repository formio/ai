## Overview

The `Utils.Evaluator` evaluates templates (`{{ data.x }}`, `{% code %}`), JavaScript expressions, and JSONLogic. The renderer (`packages/formio.js/src/utils/Evaluator.js`) extends the core evaluator with a cached underscore template compiler. The singleton is mutable — replace it with `registerEvaluator` to install a custom one (e.g., a sandboxed evaluator). Sourced from `packages/core/src/utils/Evaluator.ts` and `packages/formio.js/src/utils/Evaluator.js` in the Form.io source code.

## Imports

```ts
import { Utils, registerEvaluator } from '@formio/js/utils';
```

`Utils.Evaluator` is the SDK's mutable singleton; the top-level `registerEvaluator(custom)` export reassigns the SDK's internal reference so subsequent SDK calls (template interpolation, conditional evaluation, formulas) route through the override. (Note: `registerEvaluator` is a module-level export of `@formio/js/utils`, not a property of the `Utils` namespace.)

Caveat under ESM: `Utils.Evaluator` and named imports like `import { Evaluator } from '@formio/js/utils'` are snapshots captured at module load. After `registerEvaluator(custom)`, those existing references are not rebound — the swap is observable through SDK-internal call sites, not through references held by your code. Call `registerEvaluator` once at bootstrap, before any other SDK code reads `Utils.Evaluator`.

## API

`Utils.Evaluator` (instance of `DefaultEvaluator`):

- `Evaluator.evaluator(func: string | Function, ...params: string): Function` — compile a function from a string body and named params.
- `Evaluator.interpolateString(template: string, data: any, options?): string` — replace `{{ … }}` and `{% … %}` markers with values from `data`. Honors `options.noeval` to forbid `eval()` paths.
- `Evaluator.interpolate(template: string | Function, data: any, options?): any` — smart wrapper: strings go to `interpolateString`, functions are called with `data`. The renderer override caches compiled underscore templates by content hash.
- `Evaluator.evaluate(func, args?, ret?, interpolate?, context?, options?): any` — execute a function, code string, or JSONLogic expression. `args` becomes the variables in scope; `ret` is a variable name whose value to return; `context` is `this` inside the function.
- `Evaluator.execute(func, args, context?, options?): any` — call a previously compiled / function reference with `args`.

Template syntax (core `Evaluator.ts`):

- `{{ data.firstName }}` — variable interpolation; HTML-escaped.
- `{{{ data.htmlField }}}` — raw (un-escaped) interpolation.
- `{% if (data.x) { %} … {% } %}` — code execution.
- `{{ data.method() }}` — function-call interpolation; suppressed when `options.noeval` is true.

Hot-swap helpers (`packages/core/src/utils/Evaluator.ts` and the renderer index re-export):

- `registerEvaluator(override: DefaultEvaluator): void` — top-level module export of `@formio/js/utils` (not a property of `Utils`). Install a custom evaluator (e.g., one that runs expressions in a Web Worker).
- `Utils.interpolate(template, data, options?)` — module-level convenience that delegates to `Utils.Evaluator.interpolate`.
- `Utils.evaluate(func, args?, ret?, interpolate?, context?, options?)` — module-level convenience that delegates to `Utils.Evaluator.evaluate`.

## Examples

### Interpolate a template string

```ts
import { Utils } from '@formio/js/utils';

const greeting = Utils.Evaluator.interpolateString('Hello {{ data.firstName }}!', {
  data: { firstName: 'Alice' },
});
console.log(greeting); // "Hello Alice!"
```

### Evaluate a custom validation expression

```ts
import { Utils } from '@formio/js/utils';

const valid = Utils.Evaluator.evaluate('valid = data.age >= 18;', { data: { age: 21 } }, 'valid');
console.log(valid); // true
```

### Evaluate a JSONLogic expression

```ts
import { Utils } from '@formio/js/utils';

const ok = Utils.Evaluator.evaluate({ '>=': [{ var: 'data.age' }, 18] }, { data: { age: 21 } });
console.log(ok); // true
```

### Compile and reuse a function

```ts
import { Utils } from '@formio/js/utils';

const fn = Utils.Evaluator.evaluator('return data.first + " " + data.last;', 'data');
console.log(fn({ first: 'Ada', last: 'Lovelace' })); // "Ada Lovelace"
```

### `interpolateString` does NOT HTML-escape — pair it with `Utils.sanitize`

`Utils.Evaluator.interpolateString` substitutes `{{ … }}` values into the template **verbatim** — it does not HTML-escape user-supplied data. If you are rendering the interpolated output as HTML, run it through `Utils.sanitize` (which wraps DOMPurify with Form.io's defaults).

Use this pattern: `interpolateString` for value substitution → `sanitize` for HTML-safety.

```ts
import { Utils } from '@formio/js/utils';

const raw = Utils.Evaluator.interpolateString('<p>Hello {{ data.firstName }}</p>', {
  data: { firstName: '<img src=x onerror=alert(1)>' },
});
// raw === '<p>Hello <img src=x onerror=alert(1)></p>' — DANGEROUS to render as-is.

const safe = Utils.sanitize(raw, {});
console.log(safe.toString());
// '<p>Hello <img src="x"></p>' — the onerror handler is stripped.
```

The `{ noeval: true }` option controls only function-call interpolation (`{{ data.method() }}`); it does not affect HTML escaping. If you need plain-text output, call `String(value)` yourself or strip HTML with `Utils.removeHTML(raw)`.

### Install a sandboxed evaluator

Call `registerEvaluator(custom)` at bootstrap, before any other SDK code reads `Utils.Evaluator`. The override takes effect for subsequent SDK-internal evaluations (template interpolation, conditionals, formulas). Existing references held by application code are not retroactively rebound.

```ts
import { registerEvaluator, DefaultEvaluator } from '@formio/js/utils';

class SandboxedEvaluator extends DefaultEvaluator {
  evaluate(func, args, ret, interpolate, context, options = {}) {
    // Reject any non-JSONLogic input.
    if (typeof func === 'string' || typeof func === 'function') {
      throw new Error('JavaScript expressions are disabled.');
    }
    return super.evaluate(func, args, ret, interpolate, context, options);
  }
}

registerEvaluator(new SandboxedEvaluator({ noeval: true }));
```
