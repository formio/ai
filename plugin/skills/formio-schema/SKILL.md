---
name: formio-schema
description: Form.io form JSON schema reference. Use this skill whenever constructing, editing, or interpreting a Form.io form definition — including forms returned by MCP tools like `form_list`, `form_get`, `form_create`, and `form_update`, or when the user mentions form components, wizards, resources, submissions, conditional logic, validation rules, or any `type: "..."` component (textfield, select, datagrid, panel, etc.). Trigger even when the user does not explicitly say "Form.io" if the context involves JSON form schemas with `components` arrays, `key`/`input`/`type` fields, or form builder concepts.
license: MIT
---

# Form.io Form Schema

This skill describes the JSON schema used by [Form.io](https://form.io) forms. Use it to construct new form definitions, interpret existing ones, or modify forms via the MCP server tools.

Detail is split across reference files. Read only the ones you need for the task at hand — the overview below is usually enough to orient yourself; load a reference file when you need a specific property list.

## When to load which reference

Load the reference file that matches what you're working on:

| Working on…                                                                                    | Load                              |
| ---------------------------------------------------------------------------------------------- | --------------------------------- |
| Top-level form properties (`title`, `path`, `display`, `access`, `settings`, etc.)             | `references/form-definition.md`   |
| Properties shared by all components (`key`, `label`, `validate`, `conditional`, `logic`, etc.) | `references/base-component.md`    |
| A specific input field (textfield, number, select, checkbox, file, signature, button, …)       | `references/input-components.md`  |
| Visual layout containers (panel, columns, tabs, table, fieldset, well, content)                | `references/layout-components.md` |
| Nested or repeatable data (container, datagrid, editgrid, datamap, nested form, address)       | `references/data-components.md`   |

You can load multiple references in parallel if a task spans categories (e.g., a wizard with data grids and a signature field touches all the component references plus the form definition).

## Top-level shape

A form is a JSON object. The only required property is `components`; everything else is optional but commonly set:

```json
{
  "title": "User Registration",
  "name": "userRegister",
  "path": "user/register",
  "type": "form",
  "display": "form",
  "components": [
    /* ... */
  ]
}
```

- `type`: `"form"` (collects submissions) or `"resource"` (reusable data model referenced by other forms).
- `display`: `"form"` (single page), `"wizard"` (each top-level `panel` becomes a page/step), or `"pdf"`.
- `components`: ordered array of component objects — the body of the form.

For the full list of form-level properties including `access`, `submissionAccess`, `settings`, `revisions`, and `controller`, see `references/form-definition.md`.

## Components at a glance

Every component has at minimum:

```json
{ "type": "textfield", "key": "firstName", "input": true, "label": "First Name" }
```

- `type` — which kind of component (see catalog below).
- `key` — unique identifier within the form; becomes the submission data path.
- `input` — `true` for data-collecting fields, `false` for layout-only components.
- `label` — displayed above the field.

All other shared properties (validation, conditional display, calculated values, access, logic, etc.) live in `references/base-component.md`.

### Component catalog

Components fall into three categories. Pick a category, load its reference for full property tables.

**Input components** (`references/input-components.md`) — collect user data:

| `type`        | Purpose                                                                                                   |
| ------------- | --------------------------------------------------------------------------------------------------------- |
| `textfield`   | Single-line text                                                                                          |
| `textarea`    | Multi-line text, optional WYSIWYG                                                                         |
| `number`      | Numeric input                                                                                             |
| `password`    | Masked text                                                                                               |
| `email`       | Email with optional Kickbox verification                                                                  |
| `phoneNumber` | Phone input                                                                                               |
| `url`         | URL input                                                                                                 |
| `datetime`    | Date and/or time picker                                                                                   |
| `day`         | Separate day/month/year fields                                                                            |
| `time`        | Time-only input                                                                                           |
| `checkbox`    | Single boolean                                                                                            |
| `radio`       | Single-select radio group                                                                                 |
| `selectboxes` | Multi-select checkbox group                                                                               |
| `select`      | Dropdown (values can be static, fetched from a URL, or loaded from a Form.io resource, or from custom JS) |
| `resource`    | Select referencing a Form.io resource                                                                     |
| `hidden`      | Stored data without UI                                                                                    |
| `button`      | Submit / reset / event / OAuth / URL action                                                               |
| `signature`   | Signature pad                                                                                             |
| `file`        | File upload                                                                                               |
| `tags`        | Tag input                                                                                                 |
| `survey`      | Matrix-style survey grid                                                                                  |

**Layout components** (`references/layout-components.md`) — structure the form visually, set `input: false`:

| `type`        | Purpose                                      |
| ------------- | -------------------------------------------- |
| `panel`       | Collapsible section; also a wizard page/step |
| `columns`     | Multi-column row                             |
| `table`       | HTML table of components                     |
| `tabs`        | Tabbed sections                              |
| `fieldset`    | Legend-labeled group                         |
| `well`        | Styled container                             |
| `content`     | Static HTML block                            |
| `htmlelement` | Custom HTML tag                              |

**Data components** (`references/data-components.md`) — manage nested or repeatable data:

| `type`       | Purpose                                                            |
| ------------ | ------------------------------------------------------------------ |
| `container`  | Groups children under a nested object                              |
| `datagrid`   | Repeatable row-based table                                         |
| `editgrid`   | Repeatable list with inline/modal editing                          |
| `datamap`    | Key-value pair editor                                              |
| `form`       | Embeds another form                                                |
| `address`    | Address autocomplete with manual fallback                          |
| `datasource` | Fetches external data that can be used by other components (no UI) |
| `recaptcha`  | Google reCAPTCHA                                                   |

## Tips for writing forms

- **Keys must be unique within a form.** Nested components (inside a `container`, `datagrid`, etc.) namespace their keys under the parent.
- **Wizards are built from panels.** Set `display: "wizard"` on the form; each top-level `panel` component becomes one step.
- **Resources vs forms.** Use `type: "resource"` for reusable data objects that can be referenced by `select` components with `dataSrc: "resource"`. Use `type: "form"` for anything that collects submissions.
- **Conditional visibility.** Three formats exist: simple, JSON Logic, and legacy. An advanced conditional can also be written with custom JS. See `references/base-component.md` for syntax.
- **Avoid `calculateValue` without `allowCalculateOverride`** unless the field should truly be read-only-by-computation — users cannot edit a calculated field by default.
