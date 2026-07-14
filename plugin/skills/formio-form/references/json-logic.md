# JSON Logic Primer for the Renderer

## Overview

Three component properties evaluate [JSON Logic](https://jsonlogic.com)
expressions — `validate.json`, `conditional.json`, and `calculateValue` — plus
`logic` entries with a `json` trigger. This primer covers the operations
vocabulary once; the consumer docs ([validation.md](./validation.md),
[conditionals.md](./conditionals.md),
[calculated-values.md](./calculated-values.md),
[field-logic.md](./field-logic.md)) show where each expression plugs in.

A JSON Logic expression is a JSON object whose single key is the operator and
whose value is the argument list:

```json
{ "===": [{ "var": "data.employed" }, "yes"] }
```

## `var` — resolving data

`var` reads a value out of the evaluation context. The renderer supplies two
roots — `data` (the whole submission) and `row` (the contextual row):

| Path | Resolves to |
| --- | --- |
| `data.<key>` | the submission data (any field on the form) |
| `row.<key>` | the contextual row — inside a Data Grid / Edit Grid, the current row's fields; elsewhere identical to `data` |
| `input` | (`validate.json` only) the value of the component being validated |
| `_` | lodash, exposed for expressions that need it |

```json
{ "var": "data.quantity" }
{ "var": "row.lineTotal" }
{ "var": "input" }
```

## Operations

Full reference: [jsonlogic.com/operations.html](https://jsonlogic.com/operations.html).
The ones that matter in form definitions:

| Category | Operators |
| --- | --- |
| Comparison | `==`, `===`, `!=`, `!==`, `>`, `>=`, `<`, `<=` |
| Logic | `if`, `and`, `or`, `!`, `!!` |
| Numeric | `+`, `-`, `*`, `/`, `%`, `min`, `max` |
| Array | `in`, `map`, `filter`, `reduce`, `merge`, `all`, `some`, `none` |
| String | `cat`, `substr`, `in` |
| Data | `var`, `missing`, `missing_some` |

`if` takes `[condition, thenValue, elseValue]` — condition/value pairs chain
for else-if. This is the backbone of `validate.json` (see
[validation.md](./validation.md)):

```json
{ "if": [{ "===": [{ "var": "input" }, "Bob"] }, true, "Your name must be 'Bob'!"] }
```

`reduce` folds an array — e.g. summing a Data Grid column into a total:

```json
{
  "reduce": [
    { "var": "data.lineItems" },
    { "+": [{ "var": "accumulator" }, { "var": "current.amount" }] },
    0
  ]
}
```

`missing` returns the listed keys that have no value — handy for "all of these
are filled in" checks:

```json
{ "!": { "missing": ["data.firstName", "data.lastName"] } }
```

## Where each expression runs

| Property | Expression result | Documented in |
| --- | --- | --- |
| `validate.json` | `true` = valid; a string = the error message | [validation.md](./validation.md) |
| `conditional.json` | truthy = show the component | [conditionals.md](./conditionals.md) |
| `calculateValue` | becomes the component's value | [calculated-values.md](./calculated-values.md) |
| `logic[].trigger.json` | truthy = fire the entry's actions | [field-logic.md](./field-logic.md) |
