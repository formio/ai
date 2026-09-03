---
name: formio-form
description: >-
  Embed and render Form.io forms in any web application with the Vanilla JS renderer `@formio/js` — render by URL or JSON, pre-fill with submissions, JavaScript control, renderer options, conditional fields, calculated values, JSON Logic validation, cascading selects, and conditional wizard pages. The library's default "embed a form" entry point. Use when the user asks to "embed a form", "render a form", "add this form to my page/site/app", "pre-fill a form", "show or hide a field based on another field", "calculate a field value", or "add custom validation to a field" — field behavior inside ANY framework's rendered form stays here. Not for: Angular app builds (see `formio-angular`); React-named embedding (see `formio-react`); building an app around data (see `formio-application`); designing the data model (see `formio-resource-planner`); REST endpoints (see `formio-api`); the raw SDK/Utils API reference (see `formio-sdk`); creating a NEW form — embed-only skill (see `formio-form-builder`).
---

# Embedding Form.io Forms (Vanilla JS renderer)

Task guide for putting a Form.io form on a page and wiring its behavior with the `@formio/js` renderer. Everything routes through one API:

```js
const form = await Formio.createForm(element, srcOrJson, options);
```

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

## Check the host before writing mounting code

This skill's mounting guidance — `Formio.createForm` against a DOM element — is the wrong shape inside a component framework that ships its own renderer wrapper. A request that names a framework never reaches here; it routes to that framework's skill directly. The request that does reach here is the one that names none: "embed this form in my app", from inside a framework workspace.

So before writing mounting code, notice what the host is. When `package.json` lists `react`, hand off to `formio-react`'s embed branch and say in one line why you routed there — `@formio/react`'s `Form` component owns the instance lifecycle that hand-rolling `Formio.createForm` in a `useEffect` would have to re-implement.

This is one step, deliberately **not a framework dispatch table** with per-framework branch documents: the routing table lives in the framework skills' own descriptions.

**The check covers the mounting half only.** A question about a form definition — a conditional, a calculated value, a validation rule, a cascading select, wizard page logic — is answered here whatever the host, because the answer is identical in every framework.

**When the host is Angular** — detected from the workspace or named in the request — note that `@formio/angular` ships its own renderer component and that no Angular embedding skill exists yet, then continue with the guidance below. Angular-named embedding stays here for that reason: `formio-angular` claims application builds, not single-form embeds. It does work inside an Angular application; it is simply not the recommended Angular approach.

**Keep it cheap.** When the host is not detectable from the workspace, proceed with this skill's own guidance rather than asking. This is a check, not an interview.

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

- `baseUrl` refers only to the **Base URL** — the deployment hosting the project.
- `projectUrl` refers only to the **Project URL** — the project this work reads and writes, and the one value anyone supplies.

Both are values `project_get` reports, not variables to read: nothing looks them up in the environment. Neither is composed from the other, and the shapes each one takes on each kind of deployment are in [`project-urls.md`](../formio-mcp-setup/references/project-urls.md) rather than here — one copy, so the two cannot drift apart.

Form URLs passed to `Formio.createForm` live under the project URL: `{projectUrl}/{formPath}`. See [references/setup.md](./references/setup.md) for configuring both.

## MCP Tool Preference

When an embed task requires reading or changing the form definition itself, prefer the MCP server's first-party tools over ad-hoc HTTP requests:

- `form_get` / `form_list` — fetch the form JSON you are about to render or inspect its components.
- `form_update` / `form_create` — persist component changes (conditionals, `calculateValue`, `validate.json`, `logic`) back to the project. The server authenticates implicitly via its browser-based portal-login flow: the first authenticated tool call triggers it on a cache miss, captures a portal JWT, and attaches it to every request as the `x-jwt-token` header via `formioFetch`. There is no explicit authenticate tool. Do not use PKCE or API keys.
