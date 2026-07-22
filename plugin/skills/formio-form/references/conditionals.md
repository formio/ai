# Conditional Components

## Overview

A component's `conditional` property controls its visibility from other fields' values. Two mechanisms:

- **Simple** — `show` / `when` / `eq`: one driver field, one comparison value.
- **JSON Logic** — `conditional.json`: any expression; truthy shows the component. Syntax and operations live in [json-logic.md](./json-logic.md).

Hidden components are removed from validation and (by default) their values are cleared on submit (`clearOnHide`).

## Simple conditional

Show `employer` only while `employed` equals `yes`:

```json
{
  "type": "textfield",
  "key": "employer",
  "label": "Employer",
  "input": true,
  "conditional": {
    "show": true,
    "when": "employed",
    "eq": "yes"
  }
}
```

`show: false` inverts it — hide when the comparison matches.

## JSON Logic conditional

The same rule as an expression — and the doorway to multi-field, negated, or computed conditions:

```json
{
  "type": "textfield",
  "key": "employer",
  "label": "Employer",
  "input": true,
  "conditional": {
    "json": { "===": [{ "var": "data.employed" }, "yes"] }
  }
}
```

Inside `conditional.json`, `data` is the submission data and `row` is the contextual row (see [json-logic.md](./json-logic.md)). A multi-field example — show only for employed residents of Texas:

```json
{
  "conditional": {
    "json": {
      "and": [
        { "===": [{ "var": "data.employed" }, "yes"] },
        { "===": [{ "var": "data.state" }, "TX"] }
      ]
    }
  }
}
```

## Behavior notes

- Visibility re-evaluates on every data change; the component's `visible` property reflects the current state (`form.getComponent('employer').visible`).
- Set `"clearOnHide": false` on the component to keep its value while hidden.
- Wizard pages accept the same `conditional` shapes to skip whole pages — see [wizards.md](./wizards.md).

## See also

- [json-logic.md](./json-logic.md) — operations and `var` resolution.
- [field-logic.md](./field-logic.md) — conditions that change more than visibility.
