---
name: formio-sdk
description: >-
  Source-derived reference for the Form.io JavaScript SDK (`@formio/js`), the Utilities (`@formio/js/utils`), and the `@formio/core`-only helpers — authored from the Form.io source code. Covers static methods (`setBaseUrl`, `setProjectUrl`, `setToken`, `currentUser`, `logout`), instance methods on `new Formio(url)` (forms, submissions, files), the VanillaJS rendering entry point (`Formio.createForm`), the plugin lifecycle, and the `Utils` surface (Evaluator, traversal, conditions, JSONLogic, mask/sanitize). Use when the user asks to call a `Formio.*` static method, work with a `new Formio(...)` instance, invoke a `Utils.*` helper, evaluate JSONLogic, register a plugin, traverse component trees, or decode the JWT. Not for: REST endpoint shapes (see formio-api); orchestrating an app build (see formio-application); planning Resource schemas (see formio-resource-planner); `@formio/angular` wrappers (see formio-angular); embed/render-a-form tasks (see formio-form — this stays the raw API reference).
---

# Form.io SDK Skills

Reference for `@formio/js`, `@formio/js/utils`, and the helpers exposed only by `@formio/core`. Covers SDK bootstrap, authentication, form / submission / project / role / file CRUD, plugin lifecycle, VanillaJS rendering, and the full `Utils` surface (Evaluator, traversal, conditions, logic actions, JSONLogic, mask, sanitize, date, DOM, i18n, fastCloneDeep, override, unwind).

## Preflight — the Form.io MCP server

Before your first Form.io tool call, check that the Form.io MCP tools are available to you — `form_list`, `form_create`, `project_import`, `project_set`.

**If they are missing, stop and connect the server before doing anything else.** Load the `formio-mcp-setup` skill and follow it; it writes the MCP configuration for every client and tells the user how to reload. If that skill is not installed either, tell the user:

> I have no Form.io tools, so the Form.io MCP server isn't connected. Run `npx skills add formio/ai` to get the setup skill, or add the server to your agent's MCP configuration as `npx -y @formio/mcp@0.10.0`.

Do **not** work around missing tools by making direct HTTP requests against a Form.io deployment, and do not write a throwaway script that makes them for you. This library documents the whole Form.io REST surface, which makes hand-rolling requests tempting and wrong — it bypasses the guardrails the tools enforce and can write to a live deployment unreviewed. Stop and report what is blocking instead.

That ban is on **build-time** work — the configuring you do in this session. It says nothing about the application you are building: an app is expected to call the Form.io REST API **at runtime**, to log its users in and to read and write their submissions, and [`formio-api`](../formio-api/SKILL.md)'s runtime-scope references document those endpoints for exactly that code.

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

### Hosted (self-deployed Form.io)

```ts
import { Formio } from '@formio/js';

Formio.setBaseUrl('https://forms.mysite.com');
Formio.setProjectUrl('https://forms.mysite.com/myproject');
```

- `baseUrl` is the deployment root — often a subdomain of the customer's own domain, e.g. `https://forms.mysite.com`. It never carries a path.
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

- **`baseUrl` / `base_url` → platform deployment endpoint → `FORMIO_BASE_URL`**
- **`projectUrl` / `project_url` → project endpoint → `FORMIO_PROJECT_URL`**

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
