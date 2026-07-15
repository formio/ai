# Data Components Reference

Data components manage nested or repeatable data structures. Unlike plain layout components, these change how submission data is shaped — children are namespaced under the component's `key`.

All data components extend `BaseComponent` (see `base-component.md`).

## Container (`type: "container"`)

Groups child fields under a single data key as a nested object (no effect on the UI). Submission shape becomes `{ [key]: { child1: ..., child2: ... } }`.

| Property     | Type          | Description                                                                    |
| ------------ | ------------- | ------------------------------------------------------------------------------ |
| `components` | `Component[]` | Child components. Data is stored as `{ [key]: { child1: ..., child2: ... } }`. |

## DataGrid (`type: "datagrid"`)

Repeatable row-based table. Each row contains the same set of fields. Submission shape: `{ [key]: [ { ... }, { ... } ] }`.

| Property                    | Type          | Description                       |
| --------------------------- | ------------- | --------------------------------- |
| `components`                | `Component[]` | Components in each row (columns). |
| `disableAddingRemovingRows` | `boolean`     | Lock the number of rows.          |

## EditGrid (`type: "editgrid"`)

Repeatable list with inline or modal editing. Similar data shape to DataGrid but with per-row edit/save semantics — good when each entry is substantial and a full grid would be cramped.

| Property        | Type          | Description                                              |
| --------------- | ------------- | -------------------------------------------------------- |
| `components`    | `Component[]` | Components in each entry.                                |
| `modal`         | `boolean`     | Edit entries in a modal dialog.                          |
| `inlineEdit`    | `boolean`     | Edit entries inline without saving row by row.           |
| `openWhenEmpty` | `boolean`     | Auto-open editor when no entries exist.                  |
| `removeRow`     | `string`      | Custom remove button text.                               |
| `templates`     | `object`      | Custom Handlebars templates for header, row, and footer. |

## DataMap (`type: "datamap"`)

Key-value pair editor. Extends DataGrid. Submission shape: `{ [key]: { userKey1: value1, userKey2: value2 } }`.

| Property         | Type            | Description                                |
| ---------------- | --------------- | ------------------------------------------ |
| `valueComponent` | `BaseComponent` | Component definition for the value column. |
| `keyBeforeValue` | `boolean`       | Show key column before value column.       |

## Form (`type: "form"`)

Embeds another form (a **Nested Form**). Either references it (just the submission ID) or inlines its data.

| Property    | Type      | Description                                                    |
| ----------- | --------- | -------------------------------------------------------------- |
| `src`       | `string`  | URL of the embedded form.                                      |
| `form`      | `string`  | Form ID to embed.                                              |
| `path`      | `string`  | Form path to embed.                                            |
| `reference` | `boolean` | Store as a reference instead of embedding the submission data. |

**Default `reference: false` — common gotcha.** In most cases a Nested Form is
meant to serve as a nested form *interface* — the child form's fields render
inside the parent, and the child data is saved inline as part of the parent's
submission. That behavior requires `reference: false`. Leaving `reference`
at its default (`true`, "Save as Reference") makes the child data submit as a
*separate* submission against the child form, with the parent storing only a
`{ _id }` pointer — surprising anyone who expected one combined submission.
Set `reference: false` on every Nested Form component (including nested
wizards) unless the user explicitly wants child submissions stored separately
under the child form (e.g., a shared child record referenced by many parents).
See `references/submission/submission-data.md` for the two resulting data
shapes.

## Address (`type: "address"`)

Address autocomplete with manual mode fallback. Extends Container — child fields hold the parsed address parts. Provider may require configuration in project settings.

| Property                  | Type      | Description                                         |
| ------------------------- | --------- | --------------------------------------------------- |
| `provider`                | `string`  | Address provider (e.g., `"google"`, `"nominatim"`). |
| `providerOptions`         | `object`  | Provider-specific configuration.                    |
| `enableManualMode`        | `boolean` | Allow switching to manual address entry.            |
| `switchToManualModeLabel` | `string`  | Label for the manual mode toggle.                   |

## DataSource (`type: "datasource"`)

Fetches external data when the form loads. No UI is rendered; the fetched data is available to other components via `refreshOn` / `redrawOn` / calculated values.

| Property             | Type      | Description                          |
| -------------------- | --------- | ------------------------------------ |
| `fetch.url`          | `string`  | URL to fetch data from.              |
| `fetch.method`       | `string`  | HTTP method.                         |
| `fetch.headers`      | `array`   | Request headers: `[{ key, value }]`. |
| `fetch.authenticate` | `boolean` | Include Form.io auth token.          |

## Recaptcha (`type: "recaptcha"`)

Google reCAPTCHA verification. Base properties only — configure site key in project settings.
