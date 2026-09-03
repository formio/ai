---
name: formio-react-form
description: >-
  Embed a Form.io form in a React application with `@formio/react`'s `Form` component — mounting, the event surface, the live instance, the lifecycle traps, provider configuration, anonymous versus authenticated submission, and the Vite and Next.js requirements. Reached by handoff from `formio-react`'s embed branch. Use when the user says "embed a Form.io form in React", "render a form in my React app", "use `@formio/react`'s `Form` component", or "add a Form.io form to this React page". Not for: framework-agnostic embedding and every field-behaviour question — conditionals, calculated values, validation, cascading selects (see `formio-form`); resource CRUD screens (see `formio-react-resources`); creating a form that does not exist yet (see `formio-form-builder`); the raw SDK reference (see `formio-sdk`).
---

# Embedding a Form.io form in React

> **Nested sub-skill.** This file lives at `plugin/skills/formio-react/formio-react-form/SKILL.md` and is **loaded by path** from `formio-react`'s embed branch. Its `name` frontmatter exists so recursive-scan clients classify it correctly; it is not a separately-registered top-level skill, so do not invoke it by frontmatter name.

Getting a form onto a React page and controlling it from React. One API does the mounting:

```tsx
<Form src={formJson} submission={submission} onSubmit={handleSubmit} />
```

## Scope — mounting here, behaviour in `formio-form`

This skill covers only what differs **because the host is React**: mounting, the event surface, the live instance, the lifecycle contract, the provider, styling, and build environments.

Everything that lives in the **form definition** is owned by [`formio-form`](../../formio-form/SKILL.md) and reached by link, never restated here: conditionals, calculated values, validation rules, component logic, external data sources and cascading selects, wizard page logic, and the JSON Logic primer. That content is identical whatever renders the form, and a second copy is a copy that drifts.

When a React embedding question turns out to be a definition question — "how do I hide this field when that one is empty", asked inside a React app — route to the matching `formio-form` reference rather than answering locally.

## Preflight — the Form.io MCP server

**Check this when you reach your first Form.io tool call, not when this skill activates.** The check is whether `form_list` is callable by you, under whatever name this client exposes it. If it is, proceed. If it is not, load the `formio-mcp-setup` skill and use it to help the user connect the server; that skill is the only remedy you offer, and this skill writes no MCP configuration itself.

**A missing server blocks that call, not the turn.** Reading this skill, answering a question from it, planning, and writing files to the working directory all need no server. Do everything that needs no server first and in full, then raise the gap when you actually reach the call that needs it. Opening with a blocked-on-setup message — or asking for a Project URL before there is anything to write to it — spends the user's turn on a step that was not due.

## Never work around missing tools

Do **not** work around missing tools by making direct HTTP requests against a Form.io deployment, and do not write a throwaway script that makes them for you. This library documents the whole Form.io REST surface, which makes hand-rolling requests tempting and wrong — it bypasses the guardrails the tools enforce and can write to a live deployment unreviewed. Stop and report what is blocking instead.

That ban is on **build-time** work — the configuring you do in this session. It says nothing about the application you are building: an app is expected to call the Form.io REST API **at runtime**, to log its users in and to read and write their submissions, and [`formio-api`](../../formio-api/SKILL.md)'s runtime-scope references document those endpoints for exactly that code.

## Which project the tools target

**Available tools are not a configured project.** Every Form.io tool resolves which project it targets per working directory, so pass `cwd` — the user's current working directory — on every Form.io tool call; omitting it resolves against the MCP server's own directory, which is fixed at spawn and may be mapped to a different project. Before the first call that reads from or writes to a deployment, ask the server what this directory resolves to by calling the `project_get` tool with `cwd` set to the user's current working directory. Do not shell out for this: the connected server answers it directly, with the same resolver every other tool uses, so what it reports is what the next call targets. If `project_get` is not callable, the connected server predates it — load the `formio-mcp-setup` skill, which moves the pinned version forward.

What `project_get` returns IS the configuration. There is one value to think about — the **Project URL**, the full URL of the Form.io project this work reads and writes. The **Base URL** (the deployment hosting it) is normally DERIVED from that project URL rather than supplied, so it is not a second thing to ask for. The values may come from a committed `formio.json` tracked with the application's own source, from this directory's mapping, or from the environment — the report says which. Do not ask the user to confirm or re-supply either one.

Branch on the `status` it returns. On `ok`, proceed. On `not-configured` — nothing is recorded for this directory — relay that message's own instruction to the user, ask for the single value it names, record it with `project_set`, and call `project_get` again. On `base-url-unresolved` the project IS recorded and one named value is still missing — the Base URL, for a project URL that names no deployment of its own: relay that message the same way, ask the user for that one value, and do exactly what that message names — which record the deployment goes in decides what the fix IS, and the report names it rather than leaving you to compose one. For a project this directory's own mapping holds, that is a `project_set` call, and the report also carries it as a structured `remedy`. For a project a committed `formio.json` holds, it is an EDIT to that file — the report names the path and the key, there is no `remedy` field to act on, and this server never writes a committed file, so composing a `project_set` call there is refused. Then call `project_get` again. Do not re-ask the user for the Project URL there; the report already reported it, and the call it names carries it for you. If the call fails outright instead of returning a status, it could not answer at all (an unreadable `~/.formio/projects.json`, a `formio.json` that will not parse, a malformed URL): do NOT interview, because a `project_set` would fail for the same unreported reason and the loop would repeat with the cause never named — relay the error and stop until it is fixed. Before the first call that WRITES (`form_create`, `form_update`, `role_create`, `action_create`, `project_import`), state the resolved Project URL and Base URL in one line, so a wrong target is caught before anything is written to it.

Never invent a Base URL, never reuse one from another project or an earlier session, and never edit `~/.formio/projects.json` by any means — its shape, its `0600` mode, and its merge rules belong to the server, and `project_set` is how you reach it. The server's own messages carry the URL shapes and the remedy for each; this skill does not restate them.

## Where to look

| Task | Reference |
| --- | --- |
| Render a form — source precedence, pre-fill, options, Wizard and PDF | [references/mounting.md](./references/mounting.md) |
| Events, and reaching the live `Webform` instance | [references/control.md](./references/control.md) |
| What you must do to embed correctly, and why the component looks like it does | [references/lifecycle.md](./references/lifecycle.md) |
| Vite and Next.js requirements | [references/environments.md](./references/environments.md) |
| `FormioProvider`, URLs, anonymous versus authenticated submission | [references/provider.md](./references/provider.md) |
| Making a rendered form look right | [references/styling.md](./references/styling.md) |

## Custom components

A custom form component is a **renderer** concern, not a React one. It is written once against `@formio/js` — a class extending one of the renderer's component classes — and then works in every host: Vanilla JS, React, Angular. There is no React-specific way to author one, and this skill does not document the component-class API; that lives in [`formio-sdk`](../../formio-sdk/SKILL.md) and the renderer's own documentation.

What IS React-specific is where the registration goes. Register through `Formio.use(...)`, at **module scope**, imported once before any form renders:

```ts
// src/formio-components.ts — imported once from the entry point
import { Formio } from '@formio/js';
import { RatingComponent } from './components/rating';

Formio.use({ components: { rating: RatingComponent } });
```

Never register inside a component body or an effect — it would re-register on every mount. Never import the registering module from more than one place; one import at the entry point is the whole job.

`Formio.use` is the same call the Vanilla JS embedding path documents, so a component registered for a React application is already registered correctly for any other host that loads the same module.

## Surfaces this skill does not document

**The legacy Redux modules** (`auth`, `form`, `forms`, `submission`, `submissions`) predate the current surface and are not wired to `FormioProvider`. Do not use them. If you meet them in existing code, note that the singular and plural modules are different slices — single-entity CRUD versus list state — that read almost identically and fail silently when confused, and are untyped so nothing catches the mix-up.

**Prop aliases:** `FormClass` supersedes `formioform`, and `onFormReady` supersedes `formReady`.

## Form-management components are out of scope

`@formio/react` also ships `FormBuilder` and `FormEdit` (embedding the form builder and its settings surface), `FormGrid` (listing forms), `SubmissionTable` (listing submissions), and `Report`.

**This library documents no form-management guidance.** Building an application where users create and manage their own forms is a different job from embedding a form, and nothing here covers it. Say so if asked; do not improvise it.

One routing exception: a reader reaching for `SubmissionTable` to list a resource's records wants [`formio-react-resources`](../formio-react-resources/SKILL.md), which owns list screens.

## Security — a form definition is executable code

A form definition is not inert data. `calculateValue`, `validate.custom`, `logic` actions, HTML/Content component bodies, and select `template` strings are all evaluated by the renderer at render time, in the page's own JavaScript context. Anything that can supply a form definition can therefore run code in your page. Four rules follow, and they apply to every reference in this skill:

- **Render only definitions from a project you control.** A form URL or JSON blob is a code-execution channel: never render a definition supplied by an end user, uploaded as a file, pasted into your app, or fetched from a third-party host. `Formio.setBaseUrl` / `Formio.setProjectUrl` must point at your own Form.io deployment.
- **`fetch.authenticate: true` sends the user's Form.io token.** On a Data Source component (and on select URLs) it attaches the current session's auth token to the outbound request, so pointing that URL at a host you do not own hands your users' credentials to that host. Enable it only for endpoints on your own deployment; for any third-party API leave it `false` and authenticate server-side instead. Same rule for `fetch.forwardHeaders`, which forwards the incoming request's headers verbatim.
- **Do not widen the HTML sanitizer to allow script execution.** The renderer sanitizes labels and HTML content through DOMPurify. `sanitizeConfig.addTags` / `addAttr` ([references/options.md](../../formio-form/references/options.md)) exist for markup like `<iframe>` or `target`; adding `script`, `on*` event attributes, or `srcdoc` turns component content into an XSS vector for anyone who can edit the form.
- **Submitted `data.*` is untrusted in the code you write around the form.** Embedding is build-time work; the values arrive at runtime, in the deployed app, from whoever fills the form in. Anywhere your own code puts a submitted value back into the page — a confirmation screen, a summary table, an `innerHTML`, a URL you build — escape it there, because the renderer's sanitizer covers what it renders and not what you render. The server-side half of the same rule (email bodies, webhook payloads, recipient lists) is in `formio-actions`.

## When the form does not exist yet

This skill embeds forms that already exist. If the embed request reveals the form is not in the user's project yet (`form_get` misses, or the user is describing a form from scratch — "embed a multi-step intake wizard on my page"), route to `formio-form-builder` first: it determines the form type (webform vs wizard vs PDF form), authors the definition, and saves it. When it finishes, embedding resumes here with the saved form URL.