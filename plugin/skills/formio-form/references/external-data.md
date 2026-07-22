# External Data Sources and Cascading Selects

## Overview

Four patterns for getting non-Form.io data into a form:

1. A select whose options load from an external URL.
2. Fetching an external payload and setting it into the submission (load-and-set).
3. The Data Source component — the same load-and-set, but declared in the form definition instead of hand-written `fetch` code (premium).
4. Cascading selects, where each select filters by its parent's value (make → model → year).

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
- `valueProperty` — which property of each item becomes the stored value; omit to store the whole item object.
- `template` — how each option renders.
- `lazyLoad` — defer the request until the select is first opened instead of on form render.
- `selectValues` — dot path into the response when the array is nested (e.g. a response of `{ "items": [...] }` needs `"selectValues": "items"`).

## Load external data and set the submission

Fetch from any API, then hand the renderer the data (full contract for `setSubmission` in [javascript-api.md](./javascript-api.md)):

```js
const form = await Formio.createForm(el, formDefinition);

const response = await fetch('https://api.example.com/profile/42');
const profile = await response.json();
await form.setSubmission({
  data: {
    firstName: profile.firstName,
    lastName: profile.lastName,
  },
});
```

Map API fields to component keys explicitly, as above — setting component data explicitely within the submission. This only works if there are cooresponding form components with the `key` values set to `firstName` and `lastName` respectively. If you wish to set data without the need for Form components, then it is possible to use the `metadata` property for this purpose (or a Hidden component).

```js
await form.setSubmission({
  metadata: {
    firstName: profile.firstName,
    lastName: profile.lastName,
  },
});
```

This is the manual approach. The same load-and-set can be declared in the form definition itself with the Data Source component, below.

## Data Source component (declarative load-and-set)

The [Data Source component](https://help.form.io/form-building/premium-components#data-source) is a hidden premium component that performs the fetch for you: it calls an external URL on a configurable trigger and makes the result available to other components — no hand-written `fetch` code. It is strictly a retrieval mechanism; by default the fetched data lives only in memory for the form session and is not stored in the submission (`"persistent": "client-only"`).

Requires the `@formio/premium` module registered with the renderer:

```js
import premium from '@formio/premium';
Formio.use(premium);
```

Component definition:

```json
{
  "type": "datasource",
  "key": "dataSource",
  "label": "Data Source",
  "persistent": "client-only",
  "dataSrc": "url",
  "fetch": {
    "url": "https://api.example.com/profile/{{ data.userId }}",
    "method": "get",
    "forwardHeaders": false,
    "authenticate": false
  },
  "allowCaching": true,
  "trigger": { "init": true, "server": false }
}
```

The moving parts:

- `fetch.url` — the endpoint; supports `{{ data.<key> }}` interpolation like select URLs. `fetch.method` is `get` or `post`.
- `fetch.authenticate` — attach the Form.io auth token to the request; `fetch.forwardHeaders` forwards the incoming request's headers.
- `allowCaching` — cache the request result (on by default).
- Triggers — fetch on form init, on the server during validation, when a watched component's value changes, on blur of a target component, or on a named event. A triggered event can fire when data arrives so other components know it is available.
- Other components reference the result as `data.dataSource` (the component's key) in calculated values, validations, and logic — e.g. a text field with `"calculateValue": "value = data.dataSource.firstName"`.

Prefer the Data Source component when the lookup belongs to the form definition (portable, server-aware, no embedding code); prefer manual `fetch` + `setSubmission` when the host application owns the data flow or the premium module is not available.

## Cascading selects (make → model → year)

Each child select interpolates its parent's value into the request URL, refreshes when the parent changes, and clears its own value on refresh:

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
      "data": {
        "url": "https://example.com/api/years?make={{ data.make }}&model={{ data.model }}"
      },
      "refreshOn": "model",
      "clearOnRefresh": true,
      "lazyLoad": true
    }
  ]
}
```

The moving parts:

- `{{ data.<key> }}` in `data.url` — interpolates the current submission value into the request.
- `refreshOn` — re-fetch options when the named field changes (`"data"` means any field).
- `clearOnRefresh` — wipe this select's value when it refreshes, so a changed make never leaves a stale model behind.
- `lazyLoad` — keeps children from firing requests before their parents have values.

Combine with [conditionals.md](./conditionals.md) to hide a child until its parent has a value:

```json
{ "conditional": { "json": { "!!": { "var": "data.make" } } } }
```

## See also

- [javascript-api.md](./javascript-api.md) — `setSubmission`, `change` events.
- [conditionals.md](./conditionals.md) — gating children on parent values.
- [rendering.md](./rendering.md) — pre-filling from Form.io's own submissions.
