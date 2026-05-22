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
- `Utils.checkSimpleConditional(cond, context): boolean | null` — evaluate a simple conditional (`conjunction: 'all' | 'any'`, `conditions: [{ component, operator, value }]`, optional `show`). Returns `null` when the component referenced by `conditions[i].component` is missing.
- `Utils.checkJsonConditional(cond, context): boolean | null` — evaluate a JSONLogic conditional (`{ json: { '===': [...] } }`).
- `Utils.checkLegacyConditional(cond, context): boolean | null` — evaluate the legacy `{ when, eq, show }` shape.
- `Utils.checkCustomConditional(condition, context, variable?): boolean | null` — evaluate a JS string / function and return the value of `variable` (defaults to `show`).
- `Utils.convertShowToBoolean(show: any): boolean` — coerce the raw `show` field to a boolean.
- `Utils.conditionallyHidden(context): boolean` — convenience that returns `true` if the component should be hidden by its conditional.

`ConditionsContext` shape (passed by the renderer; assemble it manually when calling these helpers outside the renderer):

```ts
interface ConditionsContext {
  component: Component;
  data: object; // full submission data
  row: object; // contextual row data (datagrid row, editgrid row, top-level)
  form?: Form;
  instance?: Component;
}
```

## Examples

### Evaluate a simple conditional

```ts
import { Utils } from '@formio/js/utils';

const conditional = {
  conjunction: 'all',
  conditions: [
    { component: 'data.subscribe', operator: 'isEqual', value: true },
    { component: 'data.region', operator: 'isEqual', value: 'EU' },
  ],
  show: true,
};

const visible = Utils.checkSimpleConditional(conditional, {
  data: { subscribe: true, region: 'EU' },
  row: { subscribe: true, region: 'EU' },
});
console.log(visible); // true
```

### Evaluate a JSONLogic conditional

```ts
import { Utils } from '@formio/js/utils';

const conditional = { json: { '>': [{ var: 'data.age' }, 17] } };

const eligible = Utils.checkJsonConditional(conditional, {
  data: { age: 21 },
  row: { age: 21 },
});
console.log(eligible); // true
```

### Evaluate a custom JavaScript conditional

```ts
import { Utils } from '@formio/js/utils';

const visible = Utils.checkCustomConditional(
  'show = data.kind === "premium" && data.seats > 0;',
  {
    data: { kind: 'premium', seats: 3 },
    row: { kind: 'premium', seats: 3 },
  },
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

```ts
import { Utils } from '@formio/js/utils';

const visible = Utils.checkLegacyConditional(
  { when: 'data.country', eq: 'US', show: 'true' },
  { data: { country: 'US' }, row: { country: 'US' } },
);
console.log(visible); // true
```
