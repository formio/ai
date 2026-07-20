# Field Logic — Triggers and Actions

## Overview

A component's `logic` array is the general-purpose reaction mechanism: when a **trigger** fires, its **actions** mutate the component. Use it when [conditionals.md](./conditionals.md) (visibility) and [calculated-values.md](./calculated-values.md) (value derivation) aren't enough — disabling fields, swapping labels, merging schema changes.

```json
{
  "logic": [
    {
      "name": "<entry name>",
      "trigger": { "type": "<trigger type>", ... },
      "actions": [ ... ]
    }
  ]
}
```

## Trigger types

| Type | Fires when | Shape |
| --- | --- | --- |
| `simple` | a field equals a value (same shape as a simple conditional) | `{ "type": "simple", "simple": { "show": true, "when": "status", "eq": "locked" } }` |
| `json` | a JSON Logic expression is truthy (see [json-logic.md](./json-logic.md)) | `{ "type": "json", "json": { "===": [{ "var": "data.status" }, "locked"] } }` |
| `javascript` | a JS snippet sets `result` truthy (`data`, `row`, `component` in scope) | `{ "type": "javascript", "javascript": "result = data.status === 'locked';" }` |
| `event` | a form event fires (`form.emit('<event>')`) | `{ "type": "event", "event": "lockEverything" }` |

## Action types

| Type | Effect |
| --- | --- |
| `property` | Sets a component property while the trigger is true — e.g. `disabled`, `hidden`, `required`, label text, CSS class. |
| `value` | Runs a JS snippet assigning `value` to set the component's value. |
| `mergeComponentSchema` | Merges a schema fragment into the component (change anything the JSON schema controls). |
| `customAction` | Runs an arbitrary JS snippet. |

## Complete example

Disable `notes` while `status` is `locked`:

```json
{
  "type": "textfield",
  "key": "notes",
  "label": "Notes",
  "input": true,
  "logic": [
    {
      "name": "lock notes while status is locked",
      "trigger": {
        "type": "json",
        "json": { "===": [{ "var": "data.status" }, "locked"] }
      },
      "actions": [
        {
          "name": "disable notes",
          "type": "property",
          "property": {
            "label": "Disabled",
            "value": "disabled",
            "type": "boolean"
          },
          "state": true
        }
      ]
    }
  ]
}
```

While `data.status === 'locked'` the component's `disabled` property is `true`; when the trigger stops matching, the property reverts.

A `mergeComponentSchema` variant of the same trigger:

```json
{
  "actions": [
    {
      "name": "make notes required",
      "type": "mergeComponentSchema",
      "schemaDefinition": "schema = { validate: { required: true } }"
    }
  ]
}
```

## See also

- [json-logic.md](./json-logic.md) — the `json` trigger's expression language.
- [conditionals.md](./conditionals.md) — visibility-only conditions.
- [javascript-api.md](./javascript-api.md) — `form.emit` for `event` triggers.
