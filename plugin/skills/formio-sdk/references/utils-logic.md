## Overview

Form-component logic — a separate system from conditionals. A component's `logic[]` is a list of `{ name, trigger, actions[] }` entries. Triggers fire actions that can set properties, set values, merge schema, or run custom code.

The renderer (`@formio/js`) does **not** re-export the logic primitives. Use `@formio/core/process` for the runtime entrypoint (`logicProcessSync` / `logicProcessInfo`) and `@formio/js/utils`'s `Utils.checkTrigger` only for one-off trigger evaluation. Sourced from `packages/core/src/utils/logic.ts` and `packages/core/src/process/logic/index.ts` in the Form.io source code.

## Imports

```ts
import { logicProcessSync, logicProcessInfo } from '@formio/core/process';
import { Utils } from '@formio/js/utils';
```

## API

Runtime entrypoint (`@formio/core/process`):

- `logicProcessSync(context): boolean` — evaluate every trigger in `context.component.logic[]` and execute the matched actions in place. Returns `true` if any action mutated the component or data. Synchronous variant; `logicProcess(context): Promise<boolean>` is the async wrapper.
- `logicProcessInfo: { name, process, processSync, shouldProcess }` — packaged processor entry for use with `processSync({ components, data, processors: [logicProcessInfo] })`. `logicProcessInfo.shouldProcess(context)` returns `true` when the component has a non-empty `logic[]` (this is the `hasLogic` check).

`LogicContext` (the `context` argument to `logicProcessSync`):

```ts
interface LogicContext {
  component: Component; // the component whose logic[] is being processed
  data: object; // full submission data
  row: object; // contextual row data (same as data at top level)
  form: { components: Component[] };
  path: string; // dotted path of the component (used by scope writes)
  scope: { conditionals?: object[] };
  instance?: Component; // renderer-attached instance (optional)
}
```

Single-trigger evaluation (`@formio/js/utils`):

- `Utils.checkTrigger(component, trigger, row, data, form, instance): boolean` — evaluate a single trigger without running its actions. Trigger shape is one of:
  - `{ type: 'simple', simple: { ...SimpleConditional } }`
  - `{ type: 'javascript', javascript: 'result = ...;' }`
  - `{ type: 'json', json: { …JSONLogic… } }`
  - `{ type: 'event', event: 'eventName' }` (renderer-only — fires from `form.emit('eventName')`)

Note: `@formio/core` ships its own `checkTrigger`/`applyActions` pair with a different signature (`(context, trigger)`), but those helpers are **not** re-exported from `@formio/core`'s public entry points. Prefer the `logicProcessSync` wrapper for action execution and `Utils.checkTrigger` for trigger-only checks.

Action shapes (see `Utils.LogicAction*` types in `packages/core/src/utils/logic.ts`):

- Property — `{ type: 'property', property: { type: 'boolean' | 'string', label, value, component } }`.
- Value — `{ type: 'value', value: 'value = data.x + data.y;' }`.
- Merge schema — `{ type: 'mergeComponentSchema', schemaDefinition: '({ disabled: data.locked })' }`.
- Custom — `{ type: 'customAction', customAction: 'instance.show = data.kind === "vip";' }`.

## Examples

### Run logic for every component in a form

```ts
import { logicProcessSync, logicProcessInfo } from '@formio/core/process';

for (const component of form.components) {
  if (!logicProcessInfo.shouldProcess({ component })) continue;
  logicProcessSync({
    component,
    data: submission.data,
    row: submission.data,
    form,
    path: component.key,
    scope: {},
  });
}
```

### Check a single JavaScript trigger

```ts
import { Utils } from '@formio/js/utils';

const fired = Utils.checkTrigger(
  component,
  { type: 'javascript', javascript: 'result = data.qty > 10;' },
  submission.data,
  submission.data,
  form,
  null
);
```

### Apply a "set hidden when always true" rule (property action)

The property-action setter writes back to `component[property.value]` (here, `component.hidden`).

```ts
import { logicProcessSync } from '@formio/core/process';

const component = {
  key: 'managerApproval',
  type: 'textfield',
  input: true,
  hidden: false,
  logic: [
    {
      name: 'hide once approved',
      trigger: { type: 'javascript', javascript: 'result = data.status === "approved";' },
      actions: [
        {
          type: 'property',
          property: { type: 'boolean', label: 'Hidden', value: 'hidden', component: 'hidden' },
          state: true,
        },
      ],
    },
  ],
};

const data = { status: 'approved' };
logicProcessSync({
  component,
  data,
  row: data,
  form: { components: [component] },
  path: 'managerApproval',
  scope: {},
});

console.log(component.hidden); // true
```

### Compute a derived value via a value action

```ts
import { logicProcessSync } from '@formio/core/process';

const component = {
  key: 'total',
  type: 'number',
  input: true,
  logic: [
    {
      name: 'sum',
      trigger: { type: 'javascript', javascript: 'result = true;' },
      actions: [{ type: 'value', value: 'value = data.qty * data.unitPrice;' }],
    },
  ],
};

const data = { qty: 3, unitPrice: 19.99 };
logicProcessSync({
  component,
  data,
  row: data,
  form: { components: [component] },
  path: 'total',
  scope: {},
});

console.log(data.total); // 59.97
```
