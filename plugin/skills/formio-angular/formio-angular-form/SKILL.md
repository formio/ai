---
name: formio-angular-form
description: >-
  Embed a Form.io form in an Angular application with `@formio/angular`'s `<formio>` component — mounting, the event surface, the live `Webform` instance, change detection under zone.js and zoneless, project URLs, styling, the server-rendering limit, and when to drop to the renderer directly. Reached by handoff from `formio-angular`'s embed branch. Use when the user says "embed a Form.io form in Angular", "render a form in my Angular app", "add a `<formio>` component to this page", or "control an embedded Form.io form from Angular". Not for: framework-agnostic embedding and every field-behaviour question — conditionals, calculated values, validation, cascading selects (see `formio-form`); resource CRUD screens (see `formio-angular-resources`); creating a form that does not exist yet (see `formio-form-builder`); the raw SDK reference (see `formio-sdk`).
---

# Embedding a Form.io form in Angular

> **Nested sub-skill.** `plugin/skills/formio-angular/formio-angular-form/SKILL.md` sits inside the `formio-angular` skill folder, beside `formio-angular-resources`. The `name: formio-angular-form` frontmatter is there so recursive-scan clients classify the file; it is not a separately-registered top-level skill. The `formio-angular` parent reaches this document the same way it reaches `SETUP.md` and `AUTH.md` — it is **loaded by path**. Never invoke it by frontmatter name; open the file.

## One component

`FormioComponent` from `@formio/angular`, as the element `<formio>`:

```html
<formio [src]="formUrl" (submit)="onSubmit($event)"></formio>
```

That is the whole entry point. It fetches the definition, renders it, saves the submission, places server errors on the fields that caused them, and shows its own alert and loading chrome. Its inputs are reactive, so a parent can change the form, the submission, or the language after the first render.

There is no component decision to make on arrival. When `<formio>` is genuinely the wrong tool — a form mounted outside Angular's tree, a page that must not carry `@formio/angular` at all — the second path is the renderer itself, and [references/renderer-directly.md](./references/renderer-directly.md) is where that goes. It is a different job, not a different component.

## Before you write a template — two things the workspace may not have

This branch runs none of the application phases, so nothing upstream has prepared the workspace. Establish both of these first; each is cheap, and skipping either produces a failure whose message points somewhere else.

### 1. The packages

Read `<working directory>/package.json`. `@formio/angular` and `@formio/js` must both be dependencies. When either is missing, the template you are about to write does not compile, and the error is a module-resolution error that says nothing about the form.

Resolve the versions from the npm registry — the same registry the install resolves against — and install both in one command:

```bash
npm view @formio/angular version
npm view @formio/js version
```

**Use the workspace's own package manager, and never introduce a second lockfile.** Read `packageManager` in `package.json` first, then look for a lockfile: `yarn.lock` → Yarn, `pnpm-lock.yaml` → pnpm, `bun.lock` / `bun.lockb` → Bun, `package-lock.json` → npm. `packageManager` wins over any lockfile; when more than one lockfile is present the first hit in that order wins, because `package-lock.json` is the one a stray `npm install` leaves behind in a workspace belonging to another tool. Running `npm install` in a Yarn or pnpm workspace writes a competing lockfile and a parallel `node_modules`, and the user's own commands keep resolving against the tree you did not build — nothing warns you, and the app you tested is not the app they run. This branch is the one where the workspace is always somebody else's, so the rule matters here more than anywhere.

Installing into a user's workspace is a change to their dependency tree: show the command and the resolved versions and get approval before running it.

A Bootstrap 5 stylesheet is the other prerequisite, and it belongs to [references/styling.md](./references/styling.md) rather than here, because whether the workspace already has one is a styling question.

### 2. Which form

A form URL is this branch's only real input, and a request rarely carries one. Do not invent a placeholder and do not proceed on a guessed path — a wrong form path fails at runtime as a 404 the user reads as a broken embed.

When the request names a form URL, use it. When it names a form loosely ("the contact form", "our intake form") or not at all, call `form_list` and offer what the project actually holds, then confirm the choice in one round. When `form_list` returns nothing that matches what the user described, the form probably does not exist yet — see "When the form does not exist yet" below.

Do this before writing a template, not after: it is also the moment the form's `display` (webform, wizard, PDF) becomes known, which decides whether [references/mounting.md](./references/mounting.md)'s wizard section applies.

## Scope — mounting here, behaviour in `formio-form`

What belongs here is the Angular seam and nothing else. The bindings that mount a form; outputs, and the `Webform` instance behind them; who saves the submission; keeping the view in step with a renderer Angular cannot see; where the project URLs come from; which stylesheets are already on the page; and the one thing a server-rendered build cannot do.

Everything that lives in the **form definition** is owned by [`formio-form`](../../formio-form/SKILL.md) and reached by link, never restated here: conditionals, calculated values, validation rules, component logic, external data sources and cascading selects, wizard page logic, and the JSON Logic primer. That content is identical whatever renders the form, and a second copy is a copy that drifts.

A question that arrives wearing Angular clothes is often not an Angular question at all. "How do I hide this field when that one is empty" has the same answer in an `<formio>` element as it does in a bare `<div>`, and that answer is in `formio-form`. Send the reader there instead of composing a local one.

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

| If you need to | Open |
| --- | --- |
| Put a form on the page: `[src]` against `[form]`, who posts the submission, pre-fill, option channels, wizard flow | [references/mounting.md](./references/mounting.md) |
| Wire outputs, or hold the live renderer instance and call it | [references/control.md](./references/control.md) |
| Know what the component does for you, what it leaves to you, and why | [references/lifecycle.md](./references/lifecycle.md) |
| Stop the view going stale — `zone.js` and zoneless | [references/change-detection.md](./references/change-detection.md) |
| Settle project URLs, `FormioAppConfig`, and who submits | [references/config.md](./references/config.md) |
| Survive a server-rendered build, and know what ships | [references/environments.md](./references/environments.md) |
| Get the stylesheets right | [references/styling.md](./references/styling.md) |
| Leave `<formio>` and mount the renderer yourself | [references/renderer-directly.md](./references/renderer-directly.md) |

## Custom components

Authoring one is renderer work. The class extends a `@formio/js` component class and knows nothing about Angular — no `@Component`, no base class this library provides, nothing to inject. Written once, it renders identically wherever the renderer runs. The component-class API is out of scope here; [`formio-sdk`](../../formio-sdk/SKILL.md) and the renderer's own documentation cover it.

The Angular question is only where the registration call lives. Put `Formio.use(...)` at **module scope** in a file the entry point imports, so it has run before the first form is built:

```ts
// src/app/formio-components.ts — imported once from main.ts
import { Formio } from '@formio/angular';
import { RatingComponent } from './components/rating';

Formio.use({ components: { rating: RatingComponent } });
```

Not in a constructor, not in `ngOnInit`, not in an `APP_INITIALIZER` or a factory provider: each of those runs again, and registration is not idempotent in a useful way. Import that file from exactly one place. That is the entire setup.

`Formio` re-exported from `@formio/angular` is the same object as `Formio` from `@formio/js`, so a component registered through either is registered for both — and for any other host that loads the same module.

## If the codebase mounts a form some other way

`@formio/angular`'s `<formio>` is the component this library builds against. If the user names a different entry point or a different component, say that this skill targets `<formio>` and ask before switching — do not substitute one on your own judgement.

If the codebase already mounts a `<formio>` that is not this component, or mounts the renderer by hand, **leave it working.** It is not broken, and a rewrite nobody asked for is a change to review for no behavioural gain. Two things are worth checking when you touch such a file: that something destroys the instance in `ngOnDestroy`, and that anything the view derives from a renderer callback is published to Angular. Those are the two gaps that bite, and [references/lifecycle.md](./references/lifecycle.md) and [references/change-detection.md](./references/change-detection.md) cover both. Converting it is a task to raise with the user on its own, never a side errand inside another one.

## Surfaces this skill does not document

`@formio/angular` ships far more than a renderer component, across six entry points. Embedding uses one of them; the rest are out of scope here:

- **The form builder** — `<form-builder>`.
- **`@formio/angular/manager`** — the form-management application (`FormManagerModule`).
- **`@formio/angular/grid`** — `FormioGrid`, the paginated form and submission tables.
- **`@formio/angular/resource`** — `FormioResource`, the CRUD module.
- **`@formio/angular/auth`** — the login, registration, and reset-password surface.
- **`<formio-report>`** — the reporting renderer.

**This library documents no form-management guidance.** Building an application where users create and manage their own forms is a different job from embedding a form, and nothing here covers it. Say so if asked; do not improvise it.

Two routing exceptions. A reader reaching for `FormioGrid` or `FormioResource` to list and edit a resource's records wants [`formio-angular-resources`](../formio-angular-resources/SKILL.md), which owns those screens. A reader reaching for `@formio/angular/auth` to add a login screen wants `formio-angular`'s AUTH phase.

## Security — a form definition is executable code

A form definition is not inert data. `calculateValue`, `validate.custom`, `logic` actions, HTML/Content component bodies, and select `template` strings are all evaluated by the renderer at render time, in the page's own JavaScript context. Anything that can supply a form definition can therefore run code in your page. Four rules follow, and they apply to every reference in this skill:

- **Render only definitions from a project you control.** A form URL or JSON blob is a code-execution channel: never render a definition supplied by an end user, uploaded as a file, pasted into your app, or fetched from a third-party host. `Formio.setBaseUrl` / `Formio.setProjectUrl` must point at your own Form.io deployment.
- **`fetch.authenticate: true` sends the user's Form.io token.** On a Data Source component (and on select URLs) it attaches the current session's auth token to the outbound request, so pointing that URL at a host you do not own hands your users' credentials to that host. Enable it only for endpoints on your own deployment; for any third-party API leave it `false` and authenticate server-side instead. Same rule for `fetch.forwardHeaders`, which forwards the incoming request's headers verbatim.
- **Do not widen the HTML sanitizer to allow script execution.** The renderer sanitizes labels and HTML content through DOMPurify. `sanitizeConfig.addTags` / `addAttr` ([references/options.md](../../formio-form/references/options.md)) exist for markup like `<iframe>` or `target`; adding `script`, `on*` event attributes, or `srcdoc` turns component content into an XSS vector for anyone who can edit the form.
- **Submitted `data.*` is untrusted in the code you write around the form.** Embedding is build-time work; the values arrive at runtime, in the deployed app, from whoever fills the form in. Anywhere your own code puts a submitted value back into the page — a confirmation screen, a summary table, an `innerHTML`, a URL you build — escape it there, because the renderer's sanitizer covers what it renders and not what you render. The server-side half of the same rule (email bodies, webhook payloads, recipient lists) is in `formio-actions`.

## When the form does not exist yet

This skill embeds forms that already exist. If the embed request reveals the form is not in the user's project yet (`form_get` misses, or the user is describing a form from scratch — "embed a multi-step intake wizard on my page"), route to `formio-form-builder` first: it determines the form type (webform vs wizard vs PDF form), authors the definition, and saves it. When it finishes, embedding resumes here with the saved form URL.

## When the request is bigger than one form

An embed request that turns out to want list, create, and edit screens over a resource is an application request. Say why the branch is changing and re-dispatch through `formio-angular`: its five gated phases stand up the workspace, configuration, and auth surface, and [`formio-angular-resources`](../formio-angular-resources/SKILL.md) generates the CRUD modules. Do not grow a single embed into a CRUD application in place.
