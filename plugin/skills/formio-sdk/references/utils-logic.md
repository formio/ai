## Overview

Form-component logic — a separate system from conditionals. A component's `logic[]` is a list of `{ name, trigger, actions[] }` entries. Triggers fire actions that can set properties, set values, merge schema, or run custom code. Sourced from `packages/core/src/utils/logic.ts` in the Form.io source code.

## Imports

```ts
import { Utils } from '@formio/js/utils';
```

## API

Trigger evaluation:

- `Utils.hasLogic(context): boolean` — does the component have a non-empty `logic[]`?
- `Utils.checkTrigger(context, trigger): boolean` — evaluate a single trigger. Trigger shape is one of:
  - `{ type: 'simple', simple: { ...SimpleConditional } }`
  - `{ type: 'javascript', javascript: 'result = ...;' }`
  - `{ type: 'json', json: { …JSONLogic… } }`
  - `{ type: 'event', event: 'eventName' }` (renderer-only — fires from `form.emit('eventName')`)

Action application:

- `Utils.applyActions(context): boolean` — iterate the component's `logic[]`, evaluate each trigger, and run every action whose trigger fired. Returns `true` if any action mutated the component or data.

Individual action helpers (called by `applyActions`):

- `Utils.setActionProperty(context, action): boolean` — generic dispatcher for property actions.
- `Utils.setActionBooleanProperty(context, action): boolean` — set `disabled`, `hidden`, etc.
- `Utils.setActionStringProperty(context, action): boolean` — set `label`, `placeholder`, etc., with template interpolation.
- `Utils.setValueProperty(context, action): boolean` — set `data[component.key]` via a JS expression / JSONLogic.
- `Utils.setMergeComponentSchema(context, action): boolean` — deep-merge a partial schema into the component (live re-config).
- `Utils.setCustomAction(context, action): boolean` — run arbitrary code from `action.customAction`.

`LogicContext` shape:

```ts
interface LogicContext {
  component: Component;
  row: object;
  data: object;
  form?: Form;
  instance?: Component;
  result?: any; // populated by trigger evaluators
}
```

Action shapes (see `Utils.LogicAction*` types in `packages/core/src/utils/logic.ts`):

- Property — `{ type: 'property', property: { type: 'boolean' | 'string', label, value, component } }`.
- Value — `{ type: 'value', value: 'value = data.x + data.y;' }`.
- Merge schema — `{ type: 'mergeComponentSchema', schemaDefinition: '({ disabled: data.locked })' }`.
- Custom — `{ type: 'customAction', customAction: 'instance.show = data.kind === "vip";' }`.

## Examples

### Run logic for every component in a form

```ts
import { Utils } from '@formio/js/utils';

Utils.eachComponent(form.components, (component) => {
  if (!Utils.hasLogic({ component })) return;
  Utils.applyActions({ component, data: submission.data, row: submission.data, form });
});
```

### Check a single JavaScript trigger

```ts
import { Utils } from '@formio/js/utils';

const fired = Utils.checkTrigger(
  { component, data: submission.data, row: submission.data, form },
  { type: 'javascript', javascript: 'result = data.qty > 10;' },
);
```

### Apply a "set hidden when manager approves" rule

```ts
import { Utils } from '@formio/js/utils';

const component = {
  key: 'managerApproval',
  type: 'textfield',
  input: true,
  hidden: false,
  logic: [
    {
      name: 'hide once approved',
      trigger: {
        type: 'simple',
        simple: {
          conjunction: 'all',
          conditions: [{ component: 'data.status', operator: 'isEqual', value: 'approved' }],
          show: true,
        },
      },
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

Utils.applyActions({
  component,
  data: { status: 'approved' },
  row: { status: 'approved' },
  form,
});

console.log(component.hidden); // true
```

### Compute a derived value via a value action

```ts
import { Utils } from '@formio/js/utils';

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
Utils.applyActions({ component, data, row: data, form });

console.log(data.total); // 59.97
```
