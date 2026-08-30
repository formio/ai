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

**Check this when you reach your first Form.io tool call, not when this skill activates.** The check is whether `form_list` is callable by you, under whatever name this client exposes it. If it is, proceed. If it is not, load the `formio-mcp-setup` skill and use it to help the user connect the server; that skill is the only remedy you offer, and this skill writes no MCP configuration itself.

**A missing server blocks that call, not the turn.** Reading this skill, answering a question from it, planning, and writing files to the working directory all need no server. Do everything that needs no server first and in full, then raise the gap when you actually reach the call that needs it. Opening with a blocked-on-setup message — or asking for a Project URL before there is anything to write to it — spends the user's turn on a step that was not due.

## Never work around missing tools

Do **not** work around missing tools by making direct HTTP requests against a Form.io deployment, and do not write a throwaway script that makes them for you. This library documents the whole Form.io REST surface, which makes hand-rolling requests tempting and wrong — it bypasses the guardrails the tools enforce and can write to a live deployment unreviewed. Stop and report what is blocking instead.

That ban is on **build-time** work — the configuring you do in this session. It says nothing about the application you are building: an app is expected to call the Form.io REST API **at runtime**, to log its users in and to read and write their submissions, and [`formio-api`](../formio-api/SKILL.md)'s runtime-scope references document those endpoints for exactly that code.

## Which project the tools target

**Available tools are not a configured project.** Every Form.io tool resolves which project it targets per working directory, so pass `cwd` — the user's current working directory — on every Form.io tool call; omitting it resolves against the MCP server's own directory, which is fixed at spawn and may be mapped to a different project. Before the first call that reads from or writes to a deployment, ask the server what this directory resolves to by calling the `project_get` tool with `cwd` set to the user's current working directory. Do not shell out for this: the connected server answers it directly, with the same resolver every other tool uses, so what it reports is what the next call targets. If `project_get` is not callable, the connected server predates it — load the `formio-mcp-setup` skill, which moves the pinned version forward.

What `project_get` returns IS the configuration. There is one value to think about — the **Project URL**, the full URL of the Form.io project this work reads and writes. The **Base URL** (the deployment hosting it) is normally DERIVED from that project URL rather than supplied, so it is not a second thing to ask for. The values may come from a committed `formio.json` tracked with the application's own source, from this directory's mapping, or from the environment — the report says which. Do not ask the user to confirm or re-supply either one.

Branch on the `status` it returns. On `ok`, proceed. On `not-configured` — nothing is recorded for this directory — relay that message's own instruction to the user, ask for the single value it names, record it with `project_set`, and call `project_get` again. On `base-url-unresolved` the project IS recorded and one named value is still missing — the Base URL, for a project URL that names no deployment of its own: relay that message the same way, ask the user for that one value, and do exactly what that message names — which record the deployment goes in decides what the fix IS, and the report names it rather than leaving you to compose one. For a project this directory's own mapping holds, that is a `project_set` call, and the report also carries it as a structured `remedy`. For a project a committed `formio.json` holds, it is an EDIT to that file — the report names the path and the key, there is no `remedy` field to act on, and this server never writes a committed file, so composing a `project_set` call there is refused. Then call `project_get` again. Do not re-ask the user for the Project URL there; the report already reported it, and the call it names carries it for you. If the call fails outright instead of returning a status, it could not answer at all (an unreadable `~/.formio/projects.json`, a `formio.json` that will not parse, a malformed URL): do NOT interview, because a `project_set` would fail for the same unreported reason and the loop would repeat with the cause never named — relay the error and stop until it is fixed. Before the first call that WRITES (`form_create`, `form_update`, `role_create`, `action_create`, `project_import`), state the resolved Project URL and Base URL in one line, so a wrong target is caught before anything is written to it.

Never invent a Base URL, never reuse one from another project or an earlier session, and never edit `~/.formio/projects.json` by any means — its shape, its `0600` mode, and its merge rules belong to the server, and `project_set` is how you reach it. The server's own messages carry the URL shapes and the remedy for each; this skill does not restate them.

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
