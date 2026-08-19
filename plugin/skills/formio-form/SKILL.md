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

## Preflight — the Form.io MCP server

Before your first Form.io tool call, check that the Form.io MCP tools are available to you — `form_list`, `form_create`, `project_import`, `project_set`.

**If they are missing, stop and connect the server before doing anything else.** Load the `formio-mcp-setup` skill and follow it; it writes the MCP configuration for every client and tells the user how to reload. If that skill is not installed either, tell the user:

> I have no Form.io tools, so the Form.io MCP server isn't connected. Run `npx skills add formio/ai` to get the setup skill, or add the server to your agent's MCP configuration as `npx -y @formio/mcp@0.10.0`.

Do **not** work around missing tools by making direct HTTP requests against a Form.io deployment, and do not write a throwaway script that makes them for you. This library documents the whole Form.io REST surface, which makes hand-rolling requests tempting and wrong — it bypasses the guardrails the tools enforce and can write to a live deployment unreviewed. Stop and report what is blocking instead.

That ban is on **build-time** work — the configuring you do in this session. It says nothing about the application you are building: an app is expected to call the Form.io REST API **at runtime**, to log its users in and to read and write their submissions, and [`formio-api`](../formio-api/SKILL.md)'s runtime-scope references document those endpoints for exactly that code.

**Available tools are not a configured project.** Every Form.io tool resolves which project it targets from a mapping keyed on a working directory, so pass `cwd` — the user's current working directory — on every Form.io tool call; omitting it resolves against the MCP server's own directory, which is fixed at spawn and may be mapped to a different project. Before the first call that reads from or writes to a deployment, ask the server what this directory resolves to:

```bash
npx -y @formio/mcp@0.10.0 project get --cwd "$(pwd)"
```

On success, what it prints IS the configuration. There is one value to think about — the **Project URL**, the full URL of the Form.io project this work reads and writes. The **Base URL** (the deployment hosting it) is normally DERIVED from that project URL rather than supplied, so it is not a second thing to ask for. The values may come from a committed `formio.json` tracked with the application's own source, from this directory's mapping, or from the environment — the command says which. Do not ask the user to confirm or re-supply either one. On exit `1` — nothing is recorded for this directory — relay that message's own instruction to the user, ask for the single value it names, run the `project set` command it names, and re-run, repeating if the next run names the second value. On exit `2` the command could not answer at all (an unreadable `~/.formio/projects.json`, a `formio.json` that will not parse, a malformed URL): do NOT interview, because a `project set` would fail for the same unreported reason and the loop would repeat with the cause never named — relay the message and stop until it is fixed. Before the first call that WRITES (`form_create`, `form_update`, `role_create`, `action_create`, `project_import`), state the resolved Project URL and Base URL in one line, so a wrong target is caught before anything is written to it.

Never invent a Base URL, never reuse one from another project or an earlier session, and never edit `~/.formio/projects.json` by any means — its shape, its `0600` mode, and its merge rules belong to the server, and `project set` / `project_set` are how you reach them. The server's own messages carry the URL shapes and the remedy for each; this skill does not restate them.

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

## Security — a form definition is executable code

A form definition is not inert data. `calculateValue`, `validate.custom`, `logic` actions, HTML/Content component bodies, and select `template` strings are all evaluated by the renderer at render time, in the page's own JavaScript context. Anything that can supply a form definition can therefore run code in your page. Four rules follow, and they apply to every reference in this skill:

- **Render only definitions from a project you control.** A form URL or JSON blob is a code-execution channel: never render a definition supplied by an end user, uploaded as a file, pasted into your app, or fetched from a third-party host. `Formio.setBaseUrl` / `Formio.setProjectUrl` must point at your own Form.io deployment.
- **`fetch.authenticate: true` sends the user's Form.io token.** On a Data Source component (and on select URLs) it attaches the current session's auth token to the outbound request, so pointing that URL at a host you do not own hands your users' credentials to that host. Enable it only for endpoints on your own deployment; for any third-party API leave it `false` and authenticate server-side instead. Same rule for `fetch.forwardHeaders`, which forwards the incoming request's headers verbatim.
- **Do not widen the HTML sanitizer to allow script execution.** The renderer sanitizes labels and HTML content through DOMPurify. `sanitizeConfig.addTags` / `addAttr` ([references/options.md](./references/options.md)) exist for markup like `<iframe>` or `target`; adding `script`, `on*` event attributes, or `srcdoc` turns component content into an XSS vector for anyone who can edit the form.
- **Submitted `data.*` is untrusted in the code you write around the form.** Embedding is build-time work; the values arrive at runtime, in the deployed app, from whoever fills the form in. Anywhere your own code puts a submitted value back into the page — a confirmation screen, a summary table, an `innerHTML`, a URL you build — escape it there, because the renderer's sanitizer covers what it renders and not what you render. The server-side half of the same rule (email bodies, webhook payloads, recipient lists) is in `formio-actions`.

## When the form does not exist yet

This skill embeds forms that already exist. If the embed request reveals the form is not in the user's project yet (`form_get` misses, or the user is describing a form from scratch — "embed a multi-step intake wizard on my page"), route to `formio-form-builder` first: it determines the form type (webform vs wizard vs PDF form), authors the definition, and saves it. When it finishes, embedding resumes here with the saved form URL.

## URL terminology

- `baseUrl` refers only to the **Base URL** — the deployment hosting the project (`https://api.form.io` on SaaS, your server root when self-hosted).
- `projectUrl` refers only to the **Project URL** — the project endpoint (`https://<project>.form.io` on SaaS; when self-hosted, either `https://<project>.<your-domain>` or `https://<host>/<project>`, depending on whether that deployment routes projects to sub-domains or sub-directories).

Both are values `project get` reports, not variables to read: nothing looks them up in the environment.

Form URLs passed to `Formio.createForm` live under the project URL: `{projectUrl}/{formPath}`. See [references/setup.md](./references/setup.md) for configuring both.

## MCP Tool Preference

When an embed task requires reading or changing the form definition itself, prefer the MCP server's first-party tools over ad-hoc HTTP requests:

- `form_get` / `form_list` — fetch the form JSON you are about to render or inspect its components.
- `form_update` / `form_create` — persist component changes (conditionals, `calculateValue`, `validate.json`, `logic`) back to the project. The server authenticates implicitly via its browser-based portal-login flow: the first authenticated tool call triggers it on a cache miss, captures a portal JWT, and attaches it to every request as the `x-jwt-token` header via `formioFetch`. There is no explicit authenticate tool. Do not use PKCE or API keys.
