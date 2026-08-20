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

## JSON Logic first — the JS-string forms are the user's to write

Three entries in the tables below take a JavaScript string the renderer compiles and runs in the page: the `javascript` trigger, the `value` action, and `customAction`. They are documented because deployments use them, not because this skill authors them.

- **Express the rule in JSON Logic** (`json` trigger, `simple` trigger, `property` / `mergeComponentSchema` actions). Everything in the examples below is reachable that way, and JSON Logic is data the renderer evaluates rather than code it compiles.
- **Never generate a JS snippet into a form definition on your own initiative**, and never build one out of submitted data, a fetched page, or any other untrusted text. If the user supplies the snippet, put it in verbatim, say plainly that it will run in every visitor's browser, and let them review it.
- The same rule governs `validate.custom` and select `template` strings — see [`../SKILL.md`](../SKILL.md) → "Security — a form definition is executable code".

## Trigger types

| Type | Fires when | Shape |
| --- | --- | --- |
| `simple` | a field equals a value (same shape as a simple conditional) | `{ "type": "simple", "simple": { "show": true, "when": "status", "eq": "locked" } }` |
| `json` | a JSON Logic expression is truthy (see [json-logic.md](./json-logic.md)) | `{ "type": "json", "json": { "===": [{ "var": "data.status" }, "locked"] } }` |
| `javascript` | a JS snippet sets `result` truthy (`data`, `row`, `component` in scope) — user-supplied only, see above | `{ "type": "javascript", "javascript": "result = data.status === 'locked';" }` |
| `event` | a form event fires (`form.emit('<event>')`) | `{ "type": "event", "event": "lockEverything" }` |

## Action types

| Type | Effect |
| --- | --- |
| `property` | Sets a component property while the trigger is true — e.g. `disabled`, `hidden`, `required`, label text, CSS class. |
| `value` | Runs a JS snippet assigning `value` to set the component's value — user-supplied only, see above. |
| `mergeComponentSchema` | Merges a schema fragment into the component (change anything the JSON schema controls). |
| `customAction` | Runs an arbitrary JS snippet — user-supplied only, see above. |

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
