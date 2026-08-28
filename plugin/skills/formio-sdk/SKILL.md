---
name: formio-sdk
description: >-
  Source-derived reference for the Form.io JavaScript SDK (`@formio/js`), the Utilities (`@formio/js/utils`), and the `@formio/core`-only helpers — authored from the Form.io source code. Covers static methods (`setBaseUrl`, `setProjectUrl`, `setToken`, `currentUser`, `logout`), instance methods on `new Formio(url)` (forms, submissions, files), the VanillaJS rendering entry point (`Formio.createForm`), the plugin lifecycle, and the `Utils` surface (Evaluator, traversal, conditions, JSONLogic, mask/sanitize). Use when the user asks to call a `Formio.*` static method, work with a `new Formio(...)` instance, invoke a `Utils.*` helper, evaluate JSONLogic, register a plugin, traverse component trees, or decode the JWT. Not for: REST endpoint shapes (see formio-api); orchestrating an app build (see formio-application); planning Resource schemas (see formio-resource-planner); `@formio/angular` wrappers (see formio-angular); embed/render-a-form tasks (see formio-form — this stays the raw API reference).
---

# Form.io SDK Skills

Reference for `@formio/js`, `@formio/js/utils`, and the helpers exposed only by `@formio/core`. Covers SDK bootstrap, authentication, form / submission / project / role / file CRUD, plugin lifecycle, VanillaJS rendering, and the full `Utils` surface (Evaluator, traversal, conditions, logic actions, JSONLogic, mask, sanitize, date, DOM, i18n, fastCloneDeep, override, unwind).

## Preflight — the Form.io MCP server

**Check this when you reach your first Form.io tool call, not when this skill activates.** The check is whether `form_list`, `form_create`, `project_import`, `project_set`, `project_get` are callable by you. A Form.io-branded MCP server that does not expose them is not this server — an entry named for Form.io offering only connection or authentication tools does not satisfy this check, and "installed but not authenticated" is not a state this design has or that you may report. Either those tools are there or they are not.

**A missing server blocks that call, not the turn.** Reading this skill, answering a question from it, planning, and writing files to the working directory all need no server. Do everything that needs no server first and in full, then raise the gap when you actually reach the call that needs it. Opening with a blocked-on-setup message — or asking for a Project URL before there is anything to write to it — spends the user's turn on a step that was not due.

When you do reach that call and the tools are missing, stop there and load the `formio-mcp-setup` skill; it writes the MCP configuration this client reads, offers to capture the project configuration, and tells the user how to reload. This skill writes no MCP configuration itself, and **that skill is the only remedy you offer.** Do not invent one: no client menu, no slash command, no "authorize in the browser", no install or reload steps of your own. The setup skill owns every instruction the user receives, and an invented one sends them looking for a server entry that nothing ever wrote. If `formio-mcp-setup` is not installed either, tell the user:

> I have no Form.io tools, so the Form.io MCP server is not connected, and the `formio-mcp-setup` skill that would connect it is not installed either. Both ship in the Form.io skill library at https://github.com/formio/ai — its README carries the install route for every client, including the MCP server entry to add if you would rather configure it directly.

**Never pre-announce authentication.** Authentication is implicit: the first authenticated tool call opens the portal-login flow itself when no cached JWT is present. There is no authenticate-first step to ask the user for, and no unauthenticated state to diagnose before a call has actually failed.

Do **not** work around missing tools by making direct HTTP requests against a Form.io deployment, and do not write a throwaway script that makes them for you. This library documents the whole Form.io REST surface, which makes hand-rolling requests tempting and wrong — it bypasses the guardrails the tools enforce and can write to a live deployment unreviewed. Stop and report what is blocking instead.

That ban is on **build-time** work — the configuring you do in this session. It says nothing about the application you are building: an app is expected to call the Form.io REST API **at runtime**, to log its users in and to read and write their submissions, and [`formio-api`](../formio-api/SKILL.md)'s runtime-scope references document those endpoints for exactly that code.

**Available tools are not a configured project.** Every Form.io tool resolves which project it targets per working directory, so pass `cwd` — the user's current working directory — on every Form.io tool call; omitting it resolves against the MCP server's own directory, which is fixed at spawn and may be mapped to a different project. Before the first call that reads from or writes to a deployment, ask the server what this directory resolves to by calling the `project_get` tool with `cwd` set to the user's current working directory. Do not shell out for this: the connected server answers it directly, with the same resolver every other tool uses, so what it reports is what the next call targets.

What `project_get` returns IS the configuration. There is one value to think about — the **Project URL**, the full URL of the Form.io project this work reads and writes. The **Base URL** (the deployment hosting it) is normally DERIVED from that project URL rather than supplied, so it is not a second thing to ask for. The values may come from a committed `formio.json` tracked with the application's own source, from this directory's mapping, or from the environment — the report says which. Do not ask the user to confirm or re-supply either one.

Branch on the `status` it returns. On `ok`, proceed. On `not-configured` — nothing is recorded for this directory — relay that message's own instruction to the user, ask for the single value it names, record it with `project_set`, and call `project_get` again. On `base-url-unresolved` the project IS recorded and one named value is still missing — the Base URL, for a project URL that names no deployment of its own: relay that message the same way, ask the user for that one value, and do exactly what that message names — which record the deployment goes in decides what the fix IS, and the report names it rather than leaving you to compose one. For a project this directory's own mapping holds, that is a `project_set` call, and the report also carries it as a structured `remedy`. For a project a committed `formio.json` holds, it is an EDIT to that file — the report names the path and the key, there is no `remedy` field to act on, and this server never writes a committed file, so composing a `project_set` call there is refused. Then call `project_get` again. Do not re-ask the user for the Project URL there; the report already reported it, and the call it names carries it for you. If the call fails outright instead of returning a status, it could not answer at all (an unreadable `~/.formio/projects.json`, a `formio.json` that will not parse, a malformed URL): do NOT interview, because a `project_set` would fail for the same unreported reason and the loop would repeat with the cause never named — relay the error and stop until it is fixed. Before the first call that WRITES (`form_create`, `form_update`, `role_create`, `action_create`, `project_import`), state the resolved Project URL and Base URL in one line, so a wrong target is caught before anything is written to it.

Never invent a Base URL, never reuse one from another project or an earlier session, and never edit `~/.formio/projects.json` by any means — its shape, its `0600` mode, and its merge rules belong to the server, and `project_set` is how you reach it. The server's own messages carry the URL shapes and the remedy for each; this skill does not restate them.

## Imports

Prefer the renderer-extended SDK first; fall back to `@formio/core` only when a surface is not re-exported by `@formio/js` or `@formio/js/utils`:

```ts
// Preferred — covers the SDK, rendering, plugins, forms, submissions, projects,
// roles, files, and the bulk of the Utils surface.
import { Formio } from '@formio/js';
import { Utils } from '@formio/js/utils';

// Acceptable fallbacks — only when @formio/js does not expose the surface.
// Confirmed-needed today: jsonLogic, dom, I18n, override, unwind, the
// runtime logic processor (logicProcessSync), and the canonical DefaultEvaluator
// base class.
import { jsonLogic, dom, I18n, override, unwind, sanitize } from '@formio/core';
import { logicProcessSync, logicProcessInfo } from '@formio/core/process';
```

Never use `@formio/js/lib/...` deep imports or `<script>` CDN-bundle tags (the skill is ESM-only). The renderer extends the core SDK; consumers should reach `@formio/core` only for surfaces missing from `@formio/js`.

## URL Configuration

Configure the base URL and project URL exactly once at application bootstrap, **before** any `new Formio(...)` call or `Formio.createForm(...)`. Two deployment archetypes:

**Where these two values come from.** The hosts below are illustrations — never ship one. Take both URLs from whichever of the two paths applies, per [`project-urls.md`](../formio-mcp-setup/references/project-urls.md). **If the Form.io MCP tools are callable by you**, call `project_get` with `cwd` set to the user's current working directory and use exactly what it reports: its `projectUrl` for `setProjectUrl`, its `baseUrl` for `setBaseUrl`; if it reports a value missing, relay its instruction, persist the answer with `project_set`, and call it again. **If they are not, ask the user** — for the Project URL first and alone, deriving the Base URL from it, and asking for the Base URL only in the one shape where it cannot be derived. Do not install the MCP server to obtain these two values: writing them into an application reaches no deployment. Either way, do not hardcode an example host, do not derive either URL from the other, and do not carry a value over from another project or an earlier session — a wrong value here ships an application pointed at a deployment nobody is managing.

### Hosted (self-deployed Form.io)

```ts
import { Formio } from '@formio/js';

Formio.setBaseUrl('https://forms.mysite.com');
Formio.setProjectUrl('https://forms.mysite.com/myproject');
```

- `baseUrl` is the deployment root — often a subdomain of the customer's own domain, e.g. `https://forms.mysite.com`. It MAY carry a path of its own when the deployment is mounted at a sub-path (`https://forms.mysite.com/one` serving a project at `https://forms.mysite.com/one/two`), so take it from `project_get` rather than assuming a bare origin.
- `projectUrl` follows whichever routing that deployment uses: **sub-directories** (`https://forms.mysite.com/myproject`, shown above) or **sub-domains** (`https://myproject.mysite.com` — a sibling subdomain of the same parent domain, NOT a path under `baseUrl`). This is the distinction `Formio.setPathType('Subdirectories' | 'Subdomains')` names; setting `projectUrl` explicitly is preferred over manipulating `pathType`.

### SaaS (`portal.form.io`)

```ts
import { Formio } from '@formio/js';

Formio.setBaseUrl('https://api.form.io');
Formio.setProjectUrl('https://myproject.form.io');
```

- `baseUrl` is always `https://api.form.io` for the public SaaS.
- `projectUrl` is the subdomain-style project endpoint.

Rule of thumb: if your portal lives at `portal.form.io`, you are on SaaS. Otherwise you are on Hosted. Both archetypes are first-class — every example in the references below shows both variants.

Terminology:

- **`baseUrl` / `base_url` → the platform deployment endpoint — the **Base URL** `project_get` reports**
- **`projectUrl` / `project_url` → the project endpoint — the **Project URL** `project_get` reports**

## Authentication

Every authenticated request through the SDK carries a JWT in the `x-jwt-token` header. The MCP server in this repo uses a browser-based portal-login flow to obtain the JWT and attaches `x-jwt-token` automatically via `formioFetch`. External SDK consumers can call `Formio.login(...)` or `Formio.ssoInit('saml' | 'okta', ...)` to obtain a token, then `Formio.setToken(token)` to install it. Do not use any other authentication mechanism (no `x-token`, no API keys).

## MCP Tool Preference

When the operation overlaps an MCP tool, prefer the MCP tool over a direct SDK call from inside this workspace:

| Operation | Prefer MCP tool | SDK fallback |
| --- | --- | --- |
| Create / update / load / list forms | `form_create`, `form_update`, `form_get`, `form_list` | `new Formio(formUrl).saveForm()` / `loadForm()` / `loadForms()` |
| Manage roles | `role_create`, `role_update`, `role_list` | `new Formio(roleUrl).saveRole()` / `loadRoles()` |
| Manage actions | `action_create`, `action_update`, `action_get`, `action_list`, `action_delete` | `new Formio(actionUrl).saveAction()` / `loadActions()` |
| Project export / import | `project_export`, `project_import` | `new Formio(projectUrl).loadProject()` + manual round-trip |
| Authenticate | MCP authentication mechanism (portal-login flow) | `Formio.login(email, password)` |

Reach for the SDK directly when you are authoring code that runs in a consumer application (browser, Node script, plugin) — the MCP tools cover orchestration from inside this repo, not runtime.

## Navigation

| Intent | Reference |
| --- | --- |
| Bootstrap a consumer: `setBaseUrl`, `setProjectUrl`, `setToken`, library lazy-load, Hosted vs SaaS | [setup.md](./references/setup.md) |
| Log in / out a user, fetch current user, SSO (SAML/Okta), OAuth bearer swap, JWT handling | [auth.md](./references/auth.md) |
| Form CRUD via `new Formio(formUrl).loadForm()` / `saveForm()` / `deleteForm()` / `loadForms()` | [forms.md](./references/forms.md) |
| Submission CRUD, querying, patching, `availableActions`, download URLs | [submissions.md](./references/submissions.md) |
| Project CRUD, project roles, access info | [projects.md](./references/projects.md) |
| Role CRUD on a project | [roles.md](./references/roles.md) |
| Upload, download, delete files via storage providers | [files.md](./references/files.md) |
| Register / deregister plugins, lifecycle hooks (`preRequest`, `request`, `wrapRequestPromise`, …) | [plugins.md](./references/plugins.md) |
| Render a form in a VanillaJS / non-framework (Angular, React, etc) consumer via `Formio.createForm` — events, prefill, wizard, PDF, read-only | [rendering.md](./references/rendering.md) |
| Evaluate templates and expressions: `Utils.Evaluator`, `interpolate`, `evaluate`, `noeval` | [utils-evaluator.md](./references/utils-evaluator.md) |
| Traverse and search component trees: `eachComponent`, `eachComponentData`, `getComponent`, `findComponent`, `flattenComponents` | [utils-form-traversal.md](./references/utils-form-traversal.md) |
| Evaluate conditional logic: simple / JSON / legacy / custom conditionals | [utils-conditions.md](./references/utils-conditions.md) |
| Run logic actions and triggers (`checkTrigger`) | [utils-logic.md](./references/utils-logic.md) |
| JSONLogic operators and Form.io custom operators | [utils-jsonlogic.md](./references/utils-jsonlogic.md) |
| Input masks, HTML sanitization, DOM helpers | [utils-mask-sanitize.md](./references/utils-mask-sanitize.md) |
| Misc: date helpers, i18n, `unwind`, `fastCloneDeep`, `override` | [utils-misc.md](./references/utils-misc.md) |

## How to use this skill

1. Identify the intent (configure URLs, render a form, query submissions, evaluate a condition, …).
2. Open the matching reference in the table above. Every reference shows its own `## URL Configuration` block in both Hosted and SaaS forms (SDK references) and uses the canonical imports.
3. Copy the example, swap the URLs for your deployment, and run.

Sourced from `packages/core/src/sdk/Formio.ts`, `packages/core/src/sdk/Plugins.ts`, `packages/formio.js/src/Formio.js`, and `packages/core/src/utils/*` + `packages/formio.js/src/utils/*` in the Form.io source code.
