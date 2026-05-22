## Overview

JSONLogic — the JSON-based expression language Form.io uses to express conditional logic, calculated values, and validation rules. The `Utils.jsonLogic` engine is the upstream `json-logic-js` instance with Form.io-specific custom operators registered (`getDate`, `relativeMinDate`, `relativeMaxDate`, and shorthand condition operators prefixed with `_`). Sourced from `packages/core/src/utils/jsonlogic/index.ts` and `packages/core/src/utils/jsonlogic/operators.ts` in the Form.io source code.

## Imports

```ts
import { Utils } from '@formio/js/utils';
```

## API

Engine:

- `Utils.jsonLogic.apply(rule, data?): any` — evaluate `rule` against `data` and return the result.
- `Utils.jsonLogic.add_operation(name, fn): void` — register a custom operator.
- `Utils.jsonLogic.rm_operation(name): void` — remove an operator.
- `Utils.jsonLogic.uses_data(rule): string[]` — return every `var` reference inside a rule (useful for dependency tracking).
- `Utils.jsonLogic.truthy(value): boolean` — JSONLogic's truthiness rules (empty arrays / strings / `0` are falsy).

Form.io custom operators (registered by `Utils.jsonLogic` at import time):

- `{ "getDate": [value] }` — coerce `value` to an ISO date string via `dayjs`.
- `{ "relativeMinDate": [days] }` — ISO date `days` ago.
- `{ "relativeMaxDate": [days] }` — ISO date `days` in the future.
- `{ "_isEqual": [...] }`, `{ "_isNotEqual": [...] }`, `{ "_isEmpty": [...] }`, `{ "_isNotEmpty": [...] }`, `{ "_includes": [...] }`, `{ "_startsWith": [...] }`, `{ "_endsWith": [...] }`, `{ "_dateLessThan": [...] }`, `{ "_dateGreaterThan": [...] }`, … (full set in `packages/core/src/utils/jsonlogic/operators.ts`).

Standard JSONLogic operators (from `json-logic-js`) that you will use most:

- `{ "var": "data.x" }`
- `{ "==": [a, b] }`, `{ "!=": [...] }`, `{ "<": [...] }`, `{ "<=": [...] }`, `{ ">": [...] }`, `{ ">=": [...] }`
- `{ "and": [...] }`, `{ "or": [...] }`, `{ "!": expr }`, `{ "!!": expr }`
- `{ "if": [cond, then, else] }`
- `{ "map": [arr, expr] }`, `{ "filter": [arr, expr] }`, `{ "reduce": [arr, expr, init] }`, `{ "all": [arr, expr] }`, `{ "some": [arr, expr] }`, `{ "none": [arr, expr] }`
- `{ "in": [item, arr_or_str] }`, `{ "cat": [...] }`, `{ "substr": [str, start, len?] }`
- `{ "+": [...] }`, `{ "-": [...] }`, `{ "*": [...] }`, `{ "/": [...] }`, `{ "%": [...] }`, `{ "min": [...] }`, `{ "max": [...] }`

## Examples

### Evaluate a simple rule

```ts
import { Utils } from '@formio/js/utils';

const isAdult = Utils.jsonLogic.apply({ '>=': [{ var: 'data.age' }, 18] }, { data: { age: 21 } });
console.log(isAdult); // true
```

### Compute a derived value

```ts
import { Utils } from '@formio/js/utils';

const total = Utils.jsonLogic.apply(
  { '*': [{ var: 'data.qty' }, { var: 'data.unitPrice' }] },
  { data: { qty: 3, unitPrice: 19.99 } },
);
console.log(total); // 59.97
```

### Combine conditions

```ts
import { Utils } from '@formio/js/utils';

const eligible = Utils.jsonLogic.apply(
  {
    and: [
      { '==': [{ var: 'data.country' }, 'US'] },
      { '>=': [{ var: 'data.age' }, 21] },
      { '==': [{ var: 'data.consent' }, true] },
    ],
  },
  { data: { country: 'US', age: 25, consent: true } },
);
console.log(eligible); // true
```

### Use Form.io date helpers

```ts
import { Utils } from '@formio/js/utils';

const within30 = Utils.jsonLogic.apply(
  {
    '<=': [{ var: 'data.appointment' }, { relativeMaxDate: [30] }],
  },
  { data: { appointment: '2026-06-01T00:00:00.000Z' } },
);
```

### Register a custom operator

```ts
import { Utils } from '@formio/js/utils';

Utils.jsonLogic.add_operation('startsWith', (str: string, prefix: string) =>
  typeof str === 'string' && typeof prefix === 'string' && str.startsWith(prefix),
);

const ok = Utils.jsonLogic.apply(
  { startsWith: [{ var: 'data.sku' }, 'ACME-'] },
  { data: { sku: 'ACME-1234' } },
);
```

### Inspect dependencies before evaluating

```ts
import { Utils } from '@formio/js/utils';

const rule = {
  and: [
    { '==': [{ var: 'data.country' }, 'US'] },
    { '>=': [{ var: 'data.age' }, 21] },
  ],
};

console.log(Utils.jsonLogic.uses_data(rule));
// ['data.country', 'data.age']
```
