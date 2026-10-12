# `FormioProvider`, URLs, and who is submitting

## The provider

```tsx
import { FormioProvider } from '@formio/react';

<FormioProvider projectUrl={projectUrl} baseUrl={baseUrl}>
  <App />
</FormioProvider>
```

It sets the SDK's URLs and exposes authentication state — the token, whether a user is authenticated, and logout — through `useFormioContext()`.

**`useFormioContext` throws outside a provider.** That is deliberate: a component reading Form.io context without one is a wiring mistake, not a case to degrade quietly.

You *can* embed without a provider by configuring the SDK directly (`Formio.setProjectUrl` / `Formio.setBaseUrl`). Prefer the provider anyway — the auth state is what the rest of an application usually needs, and it keeps configuration in one place.

## Where the URLs come from

- **`projectUrl`** — the **Project URL**, the project this application reads and writes.
- **`baseUrl`** — the **Base URL**, the deployment hosting it.

Take both from the `project_get` MCP tool, called with `cwd` set to the workspace root, when the Form.io tools are callable — and from the user when they are not. Never hardcode a value from an example host, never build one by appending a project name to a deployment URL, and never carry one over from another project.

The shapes each URL takes on each kind of deployment are in [`project-urls.md`](../../../formio-mcp-setup/references/project-urls.md) — one canonical copy, so this document does not restate them.

## Anonymous submission — the common case

Most embedded forms are public: a contact form, an intake form, a survey. Nobody logs in.

**No token is attached, and that is fine.** Whether the submission succeeds is decided **server-side** by the form's submission access: the Anonymous role needs create permission on that form. Mount the provider anyway — it is what sets the SDK's URLs — but generate no login flow and no token wiring.

**A 401 on submit from a public form is an access-configuration problem, not a client one.** Do not reach for "authenticate the visitor" as the fix; that cannot be right for a form meant for the public. The remedy is the form's submission access, which belongs to [`formio-api`](../../../formio-api/SKILL.md) and the planner's access model.

## Authenticated submission

Once a user is logged in, the SDK attaches the session token automatically — an embedded form inherits it with no extra wiring. Submissions then carry an owner, which is what makes per-user access rules work.

Embedding does **not** require a logged-in user, and this skill does not generate a login flow for an embed request. Authentication surfaces are application scope; `formio-react`'s CRUD branches own them.

## More than one deployment

`FormioProvider`'s optional `Formio` prop takes the SDK **class** (`typeof Formio` from `@formio/js`), not an instance from `new Formio(url)`; when the prop is omitted, the provider uses the class `@formio/react` imports. The provider calls static methods on it — `setBaseUrl`, `setProjectUrl`, `getToken`, `logout` — and those write the class's global configuration, so two providers in one bundle share one configuration and one token store. A provider therefore does not isolate a second deployment, and neither does a full URL: the SDK keeps one token per namespace and sends it with every request whatever the host, so a form loaded from another deployment by full URL receives the first deployment's end-user token. Keep an application to the one deployment its provider configures; if a page needs a second, raise it with the user rather than mixing hosts through the same SDK.
