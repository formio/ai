# Calculated Values

## Overview

A component's `calculateValue` property derives the component's value from other fields. With a JSON Logic expression the result of the expression becomes the value, recomputed on every data change. Expression syntax and operations live in [json-logic.md](./json-logic.md).

## Canonical example

`total` = `quantity` × `price`:

```json
{
  "display": "form",
  "components": [
    { "type": "number", "key": "quantity", "label": "Quantity", "input": true },
    { "type": "number", "key": "price", "label": "Price", "input": true },
    {
      "type": "number",
      "key": "total",
      "label": "Total",
      "input": true,
      "calculateValue": {
        "*": [{ "var": "data.quantity" }, { "var": "data.price" }]
      }
    }
  ]
}
```

Change `quantity` or `price` and `total` recomputes immediately — `form.submission.data.total` always reflects the current product.

Inside `calculateValue`, `data` is the submission data and `row` is the contextual row, so a Data Grid line total is `{ "*": [{ "var": "row.quantity" }, { "var": "row.price" }] }`.

## allowCalculateOverride

By default the calculation wins — user edits to a calculated field are overwritten on the next recompute. Set `allowCalculateOverride: true` to let a manual edit stick (the calculation stops applying once the user changes the value):

```json
{
  "type": "number",
  "key": "total",
  "calculateValue": { "*": [{ "var": "data.quantity" }, { "var": "data.price" }] },
  "allowCalculateOverride": true
}
```

Pair with `calculateServer: true` when the value must also be recomputed server-side on submission (prevents tampering with client-calculated values).

## See also

- [json-logic.md](./json-logic.md) — operations and `var` resolution.
- [validation.md](./validation.md) — validating calculated results.
