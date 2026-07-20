---
name: formio-form
description: >-
  Embed and render Form.io forms in any web application with the Vanilla JS renderer `@formio/js` — render by URL or JSON, pre-fill with submissions, JavaScript control, renderer options, conditional fields, calculated values, JSON Logic validation, cascading selects, and conditional wizard pages. The library's default "embed a form" entry point. Use when the user asks to "embed a form", "render a form", "add this form to my page/site/app", "pre-fill a form", "show or hide a field based on another field", "calculate a field value", or "add custom validation to a field" — field behavior inside ANY framework's rendered form stays here. Not for: scaffolding or configuring an Angular app with `@formio/angular` (see `formio-angular`); building an app around data (see `formio-application`); designing the data model (see `formio-resource-planner`); REST endpoints (see `formio-api`); the raw SDK/Utils API reference (see `formio-sdk`); creating a NEW form — embed-only skill (see `formio-form-builder`).
---

# Embedding Form.io Forms (Vanilla JS renderer)

Task guide for putting a Form.io form on a page and wiring its behavior with the `@formio/js` renderer. Everything routes through one API:

```js
const form = await Formio.createForm(element, srcOrJson, options);
```

## How to navigate this skill

Read the reference that matches the task; each is self-contained and states which behaviors compose with which.

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

This skill embeds forms that already exist. If the embed request reveals the form is not in the user's project yet (`form_get` misses, or the user is describing a form from scratch — "embed a multi-step intake wizard on my page"), route to `formio-form-builder` first: it determines the form type (webform vs wizard vs PDF form), authors the definition, and saves it. When it finishes, embedding resumes here with the saved form URL.

## URL terminology

- `baseUrl` refers only to `FORMIO_BASE_URL` — the API host (`https://api.form.io` on SaaS, your server root when self-hosted).
- `projectUrl` refers only to `FORMIO_PROJECT_URL` — the project endpoint (`https://<project>.form.io` on SaaS, `https://<host>/<project>` when self-hosted).

Form URLs passed to `Formio.createForm` live under the project URL: `{FORMIO_PROJECT_URL}/{formPath}`. See [references/setup.md](./references/setup.md) for configuring both.

## MCP Tool Preference

When an embed task requires reading or changing the form definition itself, prefer the MCP server's first-party tools over ad-hoc HTTP requests:

- `form_get` / `form_list` — fetch the form JSON you are about to render or inspect its components.
- `form_update` / `form_create` — persist component changes (conditionals, `calculateValue`, `validate.json`, `logic`) back to the project. The server authenticates implicitly via its browser-based portal-login flow: the first authenticated tool call triggers it on a cache miss, captures a portal JWT, and attaches it to every request as the `x-jwt-token` header via `formioFetch`. There is no explicit authenticate tool. Do not use PKCE or API keys.
