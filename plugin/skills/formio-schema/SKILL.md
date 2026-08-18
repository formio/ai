---
name: formio-schema
description: >-
  Form.io JSON schema reference covering the document shapes for projects, forms (and resources), and submissions. Use whenever constructing, editing, or interpreting Form.io JSON — form definitions returned by `form_get` / `form_create` / `form_update`; submission bodies (decoding `data`, row-level `access`, draft state, `metadata`); and project documents (settings, integrations, auth providers (OAuth/LDAP/SAML), stages, tenants, and template envelopes for `project_import` / `project_export`). Trigger for schema-level questions about form components, wizards, resources, submissions, project templates, conditional logic, validation rules, or any component `type` (textfield, select, datagrid, panel) when the work involves Form.io JSON. Not for: calling Form.io REST endpoints (see `formio-api`); configuring server-side actions on a form (see `formio-actions`); planning a new app's resource model from scratch (see `formio-resource-planner`); orchestrating an entire app build (see `formio-application`).

license: MIT
---

# Form.io JSON Schema

This skill describes the JSON schemas for the three Form.io document types whose shape is non-trivial — projects, forms (and resources), and submissions. Action configs live in the `formio-actions` skill; role objects are simple enough to use directly from the `formio-api` reference. Use this skill to construct new JSON payloads, interpret existing ones, or modify them via the MCP server tools.

Detail is split across reference files under `references/<domain>/`. Read only the files you need for the task at hand — the overview below is usually enough to orient yourself; load a reference file when you need a specific property list.

## Preflight — the Form.io MCP server

Before your first Form.io tool call, check that the Form.io MCP tools are available to you — `form_list`, `form_create`, `project_import`, `project_set`.

**If they are missing, stop and connect the server before doing anything else.** Load the `formio-mcp-setup` skill and follow it; it writes the MCP configuration for every client and tells the user how to reload. If that skill is not installed either, tell the user:

> I have no Form.io tools, so the Form.io MCP server isn't connected. Run `npx skills add formio/ai` to get the setup skill, or add the server to your agent's MCP configuration as `npx -y @formio/mcp@0.10.0`.

Do **not** work around missing tools by making direct HTTP requests against a Form.io deployment, and do not write a throwaway script that makes them for you. This library documents the whole Form.io REST surface, which makes hand-rolling requests tempting and wrong — it bypasses the guardrails the tools enforce and can write to a live deployment unreviewed. Stop and report what is blocking instead.

That ban is on **build-time** work — the configuring you do in this session. It says nothing about the application you are building: an app is expected to call the Form.io REST API **at runtime**, to log its users in and to read and write their submissions, and [`formio-api`](../formio-api/SKILL.md)'s runtime-scope references document those endpoints for exactly that code.

## When to load which reference

References are partitioned by schema domain. Pick a domain first, then pick a reference inside that domain. Adding a new schema domain is purely additive — new subdirectory under `references/`, new row in the appropriate table below.

### Form definitions

| Working on… | Load |
| --- | --- |
| Top-level form properties (`title`, `path`, `display`, `access`, `settings`, etc.) | `references/form/form-definition.md` |
| Properties shared by all components (`key`, `label`, `validate`, `conditional`, `logic`, etc.) | `references/form/base-component.md` |
| A specific input field (textfield, number, select, checkbox, file, signature, button, …) | `references/form/input-components.md` |
| Visual layout containers (panel, columns, tabs, table, fieldset, well, content) | `references/form/layout-components.md` |
| Nested or repeatable data (container, datagrid, editgrid, datamap, nested form, address) | `references/form/data-components.md` |

### Submissions

| Working on… | Load |
| --- | --- |
| Top-level submission envelope (`_id`, `form`, `owner`, `roles`, `state`, `metadata`, etc.) | `references/submission/submission-definition.md` |
| Lifecycle state — `draft` vs `submitted`, when each is written | `references/submission/submission-state.md` |
| The `metadata` bag (timezone, browser, headers, extension keys) | `references/submission/submission-metadata.md` |
| Row-level `access` overrides and every `AccessType` value | `references/submission/submission-access.md` |
| Decoding the `data` envelope — key paths, nesting, address discriminated union | `references/submission/submission-data.md` |

### Projects

| Working on… | Load |
| --- | --- |
| Top-level project envelope (`title`, `name`, `owner`, `access`, settings, etc.) | `references/project/project-definition.md` |
| `type` (`project`/`stage`/`tenant`) and `framework` discriminators; Stage / Tenant patterns | `references/project/project-type-and-framework.md` |
| `ProjectSettings` keys, integrations, authorization providers, encryption-at-rest contract | `references/project/project-settings.md` |
| Project-level `access` array, `ProjectRole`, `ProjectFormAccess`, `ProjectAccessInfo` | `references/project/project-access.md` |

For action configs, see the dedicated `formio-actions` skill. For role objects, see `formio-api`'s `project-roles` reference directly — role JSON is shallow enough that a separate domain is not warranted.

You can load multiple references in parallel if a task spans categories (e.g., a wizard with data grids and a signature field touches every form reference).

## Top-level shape (form domain)

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

For the full list of form-level properties including `access`, `submissionAccess`, `settings`, `revisions`, and `controller`, see `references/form/form-definition.md`.

## Components at a glance

Every component has at minimum:

```json
{ "type": "textfield", "key": "firstName", "input": true, "label": "First Name" }
```

- `type` — which kind of component (see catalog below).
- `key` — unique identifier within the form; becomes the submission data path.
- `input` — `true` for data-collecting fields, `false` for layout-only components.
- `label` — displayed above the field.

All other shared properties (validation, conditional display, calculated values, access, logic, etc.) live in `references/form/base-component.md`.

### Component catalog

Components fall into three categories. Pick a category, load its reference for full property tables.

**Input components** (`references/form/input-components.md`) — collect user data:

| `type` | Purpose |
| --- | --- |
| `textfield` | Single-line text |
| `textarea` | Multi-line text, optional WYSIWYG |
| `number` | Numeric input |
| `password` | Masked text |
| `email` | Email with optional Kickbox verification |
| `phoneNumber` | Phone input |
| `url` | URL input |
| `datetime` | Date and/or time picker |
| `day` | Separate day/month/year fields |
| `time` | Time-only input |
| `checkbox` | Single boolean |
| `radio` | Single-select radio group |
| `selectboxes` | Multi-select checkbox group |
| `select` | Dropdown (values can be static, fetched from a URL, or loaded from a Form.io resource, or from custom JS) |
| `resource` | Select referencing a Form.io resource |
| `hidden` | Stored data without UI |
| `button` | Submit / reset / event / OAuth / URL action |
| `signature` | Signature pad |
| `file` | File upload |
| `tags` | Tag input |
| `survey` | Matrix-style survey grid |

**Layout components** (`references/form/layout-components.md`) — structure the form visually, set `input: false`:

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

**Data components** (`references/form/data-components.md`) — manage nested or repeatable data:

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
- **Conditional visibility.** Three formats exist: simple, JSON Logic, and legacy. An advanced conditional can also be written with custom JS. See `references/form/base-component.md` for syntax.
- **Avoid `calculateValue` without `allowCalculateOverride`** unless the field should truly be read-only-by-computation — users cannot edit a calculated field by default.
