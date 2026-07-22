# Custom Validation with JSON Logic

## Overview

A component's `validate.json` property holds a JSON Logic expression the renderer evaluates on every value change and on submit. The contract:

- The expression result is **`true`** → the value is valid.
- The expression result is a **string** → the value is invalid and that string is the validation error message shown on the component.

Expression syntax and the operations vocabulary live in [json-logic.md](./json-logic.md). Inside `validate.json`, `{"var": "input"}` resolves to the value of the component being validated, and `{"var": "data.<key>"}` reaches any other field for cross-field rules.

## Canonical example

An `if` that returns `true` for the valid case and the error string otherwise:

```json
{
  "type": "textfield",
  "key": "name",
  "label": "Name",
  "input": true,
  "validate": {
    "json": {
      "if": [{ "===": [{ "var": "input" }, "Bob"] }, true, "Your name must be 'Bob'!"]
    }
  }
}
```

Typing anything but `Bob` marks the field invalid with exactly `Your name must be 'Bob'!`; typing `Bob` clears the error. A failed rule also blocks `form.submit()` — the promise rejects and the messages land on `form.errors` (see [javascript-api.md](./javascript-api.md)).

## Cross-field rules

Reach other fields through `data`:

```json
{
  "validate": {
    "json": {
      "if": [
        { ">=": [{ "var": "input" }, { "var": "data.minimumBid" }] },
        true,
        "Your bid must be at least the minimum bid."
      ]
    }
  }
}
```

## Composing with standard validation

`validate.json` runs alongside the declarative `validate` keys — it does not replace them. All configured rules must pass:

```json
{
  "validate": {
    "required": true,
    "minLength": 2,
    "pattern": "[A-Za-z]+",
    "json": { "if": [{ "===": [{ "var": "input" }, "Bob"] }, true, "Your name must be 'Bob'!"] }
  }
}
```

`required`, `minLength`/`maxLength`, `min`/`max`, `pattern`, and `customMessage` keep their standard meanings; `json` adds the escape hatch for everything they cannot express.

## See also

- [json-logic.md](./json-logic.md) — operations and `var` resolution.
- [field-logic.md](./field-logic.md) — reacting to values beyond validity (disable, hide, mutate).
