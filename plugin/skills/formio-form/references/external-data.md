# External Data Sources and Cascading Selects

## Overview

Three patterns for getting non-Form.io data into a form:

1. A select whose options load from an external URL.
2. Fetching an external payload and setting it into the submission (load-and-set).
3. Cascading selects, where each select filters by its parent's value
   (make → model → year).

## Select with a URL data source

```json
{
  "type": "select",
  "key": "customer",
  "label": "Customer",
  "input": true,
  "dataSrc": "url",
  "data": { "url": "https://api.example.com/customers" },
  "valueProperty": "id",
  "template": "<span>{{ item.name }}</span>",
  "lazyLoad": true
}
```

- `dataSrc: "url"` — options come from an HTTP GET to `data.url`.
- `valueProperty` — which property of each item becomes the stored value; omit
  to store the whole item object.
- `template` — how each option renders.
- `lazyLoad` — defer the request until the select is first opened instead of
  on form render.
- `selectValues` — dot path into the response when the array is nested (e.g.
  a response of `{ "items": [...] }` needs `"selectValues": "items"`).

## Load external data and set the submission

Fetch from any API, then hand the renderer the data (full contract for
`setSubmission` in [javascript-api.md](./javascript-api.md)):

```js
const form = await Formio.createForm(el, formDefinition);

const response = await fetch('https://api.example.com/profile/42');
const profile = await response.json();
await form.setSubmission({
  data: { firstName: profile.firstName, lastName: profile.lastName },
});
```

Map API fields to component keys explicitly, as above — setting unknown keys
into `data` works but they are dropped on submit unless a component owns them.

## Cascading selects (make → model → year)

Each child select interpolates its parent's value into the request URL,
refreshes when the parent changes, and clears its own value on refresh:

```json
{
  "display": "form",
  "components": [
    {
      "type": "select",
      "key": "make",
      "label": "Make",
      "input": true,
      "dataSrc": "url",
      "data": { "url": "https://example.com/api/makes" }
    },
    {
      "type": "select",
      "key": "model",
      "label": "Model",
      "input": true,
      "dataSrc": "url",
      "data": { "url": "https://example.com/api/models?make={{ data.make }}" },
      "refreshOn": "make",
      "clearOnRefresh": true,
      "lazyLoad": true
    },
    {
      "type": "select",
      "key": "year",
      "label": "Year",
      "input": true,
      "dataSrc": "url",
      "data": { "url": "https://example.com/api/years?make={{ data.make }}&model={{ data.model }}" },
      "refreshOn": "model",
      "clearOnRefresh": true,
      "lazyLoad": true
    }
  ]
}
```

The moving parts:

- `{{ data.<key> }}` in `data.url` — interpolates the current submission value
  into the request.
- `refreshOn` — re-fetch options when the named field changes (`"data"` means
  any field).
- `clearOnRefresh` — wipe this select's value when it refreshes, so a changed
  make never leaves a stale model behind.
- `lazyLoad` — keeps children from firing requests before their parents have
  values.

Combine with [conditionals.md](./conditionals.md) to hide a child until its
parent has a value:

```json
{ "conditional": { "json": { "!!": { "var": "data.make" } } } }
```

## See also

- [javascript-api.md](./javascript-api.md) — `setSubmission`, `change` events.
- [conditionals.md](./conditionals.md) — gating children on parent values.
- [rendering.md](./rendering.md) — pre-filling from Form.io's own submissions.
