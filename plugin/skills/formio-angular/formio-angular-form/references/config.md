# URLs, configuration, and who is submitting

> **`FormioAppConfig` renames both URLs.** `appUrl` is the **Project URL** — the project this application reads and writes, and the one value anyone supplies. `apiUrl` is the **Base URL** — the deployment hosting it, which is normally derived from the Project URL rather than supplied. Take both from `project_get` (called with `cwd` set to the workspace root) when the Form.io MCP tools are callable by you, and otherwise ask the user for them — see [`project-urls.md`](../../../formio-mcp-setup/references/project-urls.md). Never compose, derive, or hand-type either one yourself.

The shapes each URL takes on each kind of deployment are in that one canonical document, so nothing here restates them. Never hardcode a value from an example host, never build one by appending a project name to a deployment URL, and never carry one over from another project or an earlier session.

## The cheapest embed configures nothing

A single form on a page needs no provider at all. Bind an absolute form URL and stop:

```html
<formio [src]="formUrl"></formio>
```

The renderer derives the project and deployment it needs from that URL. The component logs `You must provide an AppConfig within your application!` to the console when no config is provided — a warning, not an error, and the form renders. Reach for the configuration below when something else in the application needs it: a second form referenced by path rather than by absolute URL, resource-backed selects, file uploads, or authentication state.

## Providing it

`formio-angular`'s CONFIG phase already generates this for an application build, and an embed added to an existing application inherits it. The shape is a plain object provided under the class as a token:

```ts
// src/app/config.ts
import { FormioAppConfig } from '@formio/angular';

export const AppConfig: FormioAppConfig = {
  appUrl: '{projectUrl}',
  apiUrl: '{baseUrl}',
};
```

```ts
// providers
{ provide: FormioAppConfig, useValue: AppConfig }
```

`FormioModule`'s constructor calls `Formio.setBaseUrl` and `Formio.setProjectUrl` from it at bootstrap, so `useValue` is enough — the class's own constructor never runs, and no `forRoot` wiring is required.

## It sets the SDK URLs globally, on every `<formio>` construction

The component's constructor *also* calls `Formio.setBaseUrl(config.apiUrl)` and `Formio.setProjectUrl(config.appUrl)`. Not once at bootstrap — every time a `<formio>` element is created.

`Formio.setBaseUrl` / `setProjectUrl` are **global** SDK state. In an application that talks to one project this is harmless duplication and you can stop reading. In an application that talks to more than one — a multi-tenant portal, a stage switcher, a page showing forms from two projects — creating a `<formio>` clobbers whatever scoping the rest of the application had established, and the next SDK call goes to the wrong project. The symptom is a form that loads correctly and a resource select that returns somebody else's records.

**The remedy is to provide no `FormioAppConfig` at all,** and scope every call explicitly instead:

- Pass **absolute** form URLs to `[src]` (or bind `[form]` with the definition you loaded, plus `[url]`), so nothing depends on the global project URL.
- Use `new Formio(projectUrl)` for SDK work, which is scoped to that instance rather than to the global.

The cost is the console warning above, once per `<formio>` construction. Noisy, and worth it — a wrong project is silent, and noise is the better failure. If the noise is genuinely unacceptable on a hot path, [renderer-directly.md](./renderer-directly.md) touches no global URLs, and that is one of the three cases it exists for.

An application that uses `FormioResource` needs `FormioAppConfig`, so a multi-project application built on the CRUD module has this constraint whatever it does about embedding.

## Anonymous submission — the common case

Most embedded forms are public: a contact form, an intake form, a survey. Nobody logs in.

**No token is attached, and that is fine.** Whether the submission succeeds is decided **server-side** by the form's submission access: the Anonymous role needs create permission on that form. Configure the URLs if the application needs them, but generate no login flow and no token wiring.

**A 401 on submit from a public form is an access-configuration problem, not a client one.** Do not reach for "authenticate the visitor" as the fix; that cannot be right for a form meant for the public. The remedy is the form's submission access, which belongs to [`formio-api`](../../../formio-api/SKILL.md) and the planner's access model.

## Authenticated submission

Once a user is logged in, the SDK attaches the session token automatically — an embedded form inherits it with no extra wiring. Submissions then carry an owner, which is what makes per-user access rules work.

Embedding does **not** require a logged-in user, and this skill generates no login flow for an embed request. Authentication surfaces are application scope: `formio-angular`'s AUTH phase owns them, and `@formio/angular/auth` is the module it wires.
