# Submission Data Reference

`data` is the actual collected values of a submission. It is a plain JSON object whose top-level keys are the `key` properties of input components on the parent form, and whose values are the per-component stored shapes. To interpret any given `data` blob you need the parent form's `components` array (load `references/form/form-definition.md` for the form envelope and `references/form/input-components.md` / `references/form/data-components.md` for per-component value shapes).

This file documents the `data` envelope itself — how keys map to paths, how nesting works, and how the address discriminated union illustrates the general "value shape varies by component type" rule. It does NOT redocument every component's value shape; that lives in the form-domain references.

## Key-to-path mapping

Every input component on a form has a unique `key` within its enclosing scope. The submission stores the value at `data[key]` for top-level components. For example a form with three top-level inputs (`firstName`, `lastName`, `email`) produces:

```json
{
  "data": {
    "firstName": "Ada",
    "lastName": "Lovelace",
    "email": "ada@example.com"
  }
}
```

Layout components (`panel`, `columns`, `tabs`, `fieldset`, `well`, `table`, `content`, `htmlelement`) have `input: false` and contribute no `data` key — their `components` flatten into the enclosing scope.

## Nesting rules

Data components (the ones documented in `references/form/data-components.md`) introduce nested data shapes under their own `key`:

| Component | Shape under `data[key]` |
| --- | --- |
| `container` | A nested object: `data.containerKey.childKey = value` — child components are namespaced under the container's key. |
| `datagrid` | An array of row objects: `data.gridKey = [ { childKey: value, ... }, ... ]` — each row mirrors the component schema. |
| `editgrid` | Same array-of-rows shape as `datagrid`. |
| `datamap` | A key-value object where each key is user-defined: `data.mapKey = { userKey1: value1, userKey2: value2 }`. |
| `form` | Either the nested form's full submission object (when `reference: false`) or a `{ _id }` reference (when `reference: true`). |
| `address` | A discriminated union — see "Address mode" below. |

For exact per-component value shapes (e.g., what a `file` component stores, what a `signature` stores, what a `select` stores when `multiple: true`), load `references/form/input-components.md` and `references/form/data-components.md`.

## Address mode (worked example)

The `address` component stores either an autocomplete result or a manually entered address, distinguished by a `mode` discriminator. If the address uses an autocomplete provider, then the value of the address component is the value provided by the provider (Google, Open Street Maps, etc). This is the canonical example of "component type dictates value shape" — useful as a model for reading any other component's nested data.

```json
{
  "data": {
    "shippingAddress": {
      "mode": "autocomplete",
      "address": { "place_id": "...", "formatted_address": "..." }
    }
  }
}
```

```json
{
  "data": {
    "shippingAddress": {
      "mode": "manual",
      "address": {
        "address1": "123 Main St",
        "address2": "",
        "city": "Chicago",
        "state": "IL",
        "country": "US",
        "zip": "60601"
      }
    }
  }
}
```

## Worked example: a multi-component submission

```json
{
  "data": {
    "firstName": "Ada",
    "billingAddress": {
      "mode": "manual",
      "address": {
        "address1": "1 Analytical Way",
        "city": "London",
        "country": "GB",
        "zip": "EC1A"
      }
    },
    "lineItems": [
      { "sku": "A1", "quantity": 2 },
      { "sku": "B2", "quantity": 1 }
    ],
    "preferences": {
      "newsletter": true,
      "categories": ["analytical", "engines"]
    }
  }
}
```

In this example `firstName` is a flat textfield, `billingAddress` is an `address` component, `lineItems` is a `datagrid` of `{ sku, quantity }` rows, and `preferences` is a `container` wrapping a `checkbox` and a `selectboxes`.

## Conditional values, calculated values, persistence

- A component with `persistent: false` does NOT appear under `data` even if the user entered a value.
- A component cleared by `clearOnHide` when its conditional is false has its value removed from `data` (rather than being stored as `null`).
- A component with `calculateValue` set has its `data[key]` populated by the calculation result on submit — the stored value may not match anything the user typed directly.
- Encrypted fields (`encrypted: true`) are stored encrypted at rest and returned in encrypted form unless the request decrypts them; the storage shape in `data` is still keyed by the component `key`.

## See also

- `references/form/form-definition.md` — the form envelope that defines the `components` array shaping `data`.
- `references/form/input-components.md` — per-input-component value shapes.
- `references/form/data-components.md` — per-data-component nesting shapes.
- `references/form/base-component.md` — `persistent`, `clearOnHide`, `calculateValue`, `encrypted` semantics that affect what lands in `data`.
- `submission-definition.md` — where `data` sits on the Submission envelope.
