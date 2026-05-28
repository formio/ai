## Overview

Evaluate Form.io conditional logic: simple (conjunction + conditions array), JSON (raw JSONLogic), legacy (`when` / `eq` / `show`), and custom (JavaScript) conditionals. Sourced from `packages/core/src/utils/conditions.ts` in the Form.io source code.

## Imports

```ts
import { Utils } from '@formio/js/utils';
```

## API

Type discrimination:

- `Utils.isSimpleConditional(cond): boolean` — `cond` has `conjunction` + `conditions` array.
- `Utils.isJSONConditional(cond): boolean` — `cond` has a `json` property holding a JSONLogic expression.
- `Utils.isLegacyConditional(cond): boolean` — `cond` has `when` / `eq` / `show`.

Evaluation:

- `Utils.checkCondition(component, row, data, form, instance): boolean` — high-level helper that picks the right strategy based on the component's `conditional` shape.
- `Utils.checkSimpleConditional(component, condition, row, data, instance): boolean` — evaluate a simple conditional (`conjunction: 'all' | 'any'`, `conditions: [{ component, operator, value }]`, optional `show`). Also handles the legacy `{ when, eq, show }` shape — when `condition.when` is set it routes through the same function.
- `Utils.checkJsonConditional(component, json, row, data, form, onError): boolean` — evaluate a JSONLogic conditional. `json` is the raw JSONLogic expression (the value of `conditional.json`); `onError` is the value returned if the evaluator throws.
- `Utils.checkCustomConditional(component, custom, row, data, form, variable, onError, instance): boolean` — evaluate a JS string and return the value of `variable` (commonly `'show'` or `'result'`). When `custom` is a string, the SDK wraps it as `var ${variable} = true; ${custom}; return ${variable};`.

Call positions are SDK-fixed: every helper takes `component` first, then the per-helper input (the conditional or trigger object), then `row`, then `data`, then `form`/`instance`/`onError`/`variable` as applicable. Pass `{}` for `component` when calling these helpers in isolation (outside a renderer-attached component).

## Examples

### Evaluate a simple conditional

`conditions[i].component` is a plain data key — do not prefix with `data.` when calling these helpers outside the renderer. (The renderer normalizes paths internally; standalone callers pass keys directly.) `operator` is one of the registered operators in `Utils.ConditionOperators` — `isEqual`, `isNotEqual`, `isEmpty`, `isNotEmpty`, `lessThan`, `greaterThan`, `lessThanOrEqual`, `greaterThanOrEqual`, `includes`, `notIncludes`, `startsWith`, `endsWith`, `dateGreaterThan`, `dateLessThan`, `dateGreaterThanOrEqual`, `dateLessThanOrEqual`, `isDateEqual`, `isNotDateEqual`.

```ts
import { Utils } from '@formio/js/utils';

const conditional = {
  conjunction: 'all',
  conditions: [
    { component: 'subscribe', operator: 'isEqual', value: true },
    { component: 'region', operator: 'isEqual', value: 'EU' },
  ],
  show: true,
};

const data = { subscribe: true, region: 'EU' };
const visible = Utils.checkSimpleConditional({}, conditional, data, data, null);
console.log(visible); // true
```

### Evaluate a JSONLogic conditional

```ts
import { Utils } from '@formio/js/utils';

const json = { '>': [{ var: 'data.age' }, 17] };
const data = { age: 21 };
const eligible = Utils.checkJsonConditional({}, json, data, data, null, false);
console.log(eligible); // true
```

### Evaluate a custom JavaScript conditional

```ts
import { Utils } from '@formio/js/utils';

const data = { kind: 'premium', seats: 3 };
const visible = Utils.checkCustomConditional(
  {},
  'show = data.kind === "premium" && data.seats > 0;',
  data,
  data,
  null,
  'show',
  false,
);
console.log(visible); // true
```

### Evaluate via the high-level helper

```ts
import { Utils } from '@formio/js/utils';

Utils.eachComponent(form.components, (component) => {
  if (!component.conditional) return;
  const show = Utils.checkCondition(
    component,
    submission.data,
    submission.data,
    form,
    null,
  );
  console.log(component.key, '→', show);
});
```

### Handle a legacy `when` / `eq` / `show` conditional

The legacy shape `{ when, eq, show }` is handled by `checkSimpleConditional` — when `condition.when` is set, the SDK routes through the legacy branch automatically. As with `conditions[i].component`, `when` is a plain data key (no `data.` prefix) when called outside the renderer.

```ts
import { Utils } from '@formio/js/utils';

const data = { country: 'US' };
const visible = Utils.checkSimpleConditional(
  {},
  { when: 'country', eq: 'US', show: 'true' },
  data,
  data,
  null,
);
console.log(visible); // true
```
