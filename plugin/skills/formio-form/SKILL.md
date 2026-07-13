---
name: formio-form
description: >-
  Embed and render Form.io forms in any web application with the Vanilla JS
  renderer `@formio/js` — rendering a form by URL or by JSON definition,
  pre-filling forms with submissions, controlling the form instance from
  JavaScript (events and methods), renderer options, conditional fields,
  calculated values, custom validation with JSON Logic, external data sources
  with cascading selects, and conditional or custom wizards. This is the
  library's default "embed a form" entry point when no UI framework is named.
  Use when the user asks to "embed a form", "render a form", "add this form to
  my page", "add a form to my site/app", "pre-fill a form", "show or hide a
  field based on another field", "calculate a field value", "add custom
  validation to a field", "make one select depend on another", or "build a
  conditional wizard" — without naming a framework. Not for: requests that
  explicitly name Angular or `@formio/angular` (see `formio-angular`); building
  a whole app, portal, or tracker around data (see `formio-application`);
  designing the data model, resources, or permissions (see
  `formio-resource-planner`); Form.io REST endpoint lookups (see `formio-api`);
  the raw SDK/Utils API reference beyond embedding (see `formio-sdk`); creating
  a NEW form that does not exist yet — "build a form", "create a survey" —
  this skill stays embed-only (see `formio-form-builder`).
---

# Embedding Form.io Forms (Vanilla JS renderer)

Task guide for putting a Form.io form on a page and wiring its behavior with
the `@formio/js` renderer. Everything routes through one API:

```js
const form = await Formio.createForm(element, srcOrJson, options);
```

## How to navigate this skill

Read the reference that matches the task; each is self-contained and states
which behaviors compose with which.

| Task | Reference |
| --- | --- |
| Page prerequisites — CDN/ESM includes, target `<div>`, Hosted vs SaaS URLs | [references/setup.md](./references/setup.md) |
| Render a form by URL, by JSON, or with a submission (pre-fill) | [references/rendering.md](./references/rendering.md) |
| Control the form from JavaScript — events, submission data, components | [references/javascript-api.md](./references/javascript-api.md) |
| Renderer options (`readOnly`, `noAlerts`, `hooks`, `i18n`, `sanitizeConfig`, …) | [references/options.md](./references/options.md) |
| JSON Logic primer — operations and `var` resolution (`data`, `row`, `input`) | [references/json-logic.md](./references/json-logic.md) |
| Show/hide components conditionally (simple and JSON Logic) | [references/conditionals.md](./references/conditionals.md) |
| Compute a field from other fields (`calculateValue`) | [references/calculated-values.md](./references/calculated-values.md) |
| Custom validation rules (`validate.json`) | [references/validation.md](./references/validation.md) |
| Advanced field logic (`logic` triggers and actions) | [references/field-logic.md](./references/field-logic.md) |
| External data sources and cascading selects (make → model → year) | [references/external-data.md](./references/external-data.md) |
| Wizards — conditional pages, custom navigation | [references/wizards.md](./references/wizards.md) |

## When the form does not exist yet

This skill embeds forms that already exist. If the embed request reveals the
form is not in the user's project yet (`form_get` misses, or the user is
describing a form from scratch — "embed a multi-step intake wizard on my
page"), route to `formio-form-builder` first: it determines the form type
(webform vs wizard vs PDF form), authors the definition, and saves it. When
it finishes, embedding resumes here with the saved form URL.

## URL terminology

- `baseUrl` refers only to `FORMIO_BASE_URL` — the API host (`https://api.form.io` on SaaS, your server root when self-hosted).
- `projectUrl` refers only to `FORMIO_PROJECT_URL` — the project endpoint (`https://<project>.form.io` on SaaS, `https://<host>/<project>` when self-hosted).

Form URLs passed to `Formio.createForm` live under the project URL:
`{FORMIO_PROJECT_URL}/{formPath}`. See
[references/setup.md](./references/setup.md) for configuring both.

## MCP Tool Preference

When an embed task requires reading or changing the form definition itself,
prefer the MCP server's first-party tools over ad-hoc HTTP requests:

- `form_get` / `form_list` — fetch the form JSON you are about to render or
  inspect its components.
- `form_update` / `form_create` — persist component changes (conditionals,
  `calculateValue`, `validate.json`, `logic`) back to the project.
- `authenticate` — obtain credentials when a tool call returns an auth error.

Authentication uses the MCP server's browser-based portal-login flow: it
captures a portal JWT and attaches it to every request as the `x-jwt-token`
header via `formioFetch`. Do not use PKCE or API keys.
