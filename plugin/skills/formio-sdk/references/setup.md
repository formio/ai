## Overview

Bootstrap a consumer of `@formio/js`. Configure the base and project URLs, install an authentication token, register plugins, and lazy-load auxiliary libraries before any `new Formio(...)` call or `Formio.createForm(...)`. Sourced from `packages/core/src/sdk/Formio.ts` and `packages/formio.js/src/Formio.js` in the Form.io source code.

## Imports

```ts
import { Formio } from '@formio/js';
```

## URL Configuration

**Where these two values come from.** The hosts below are illustrations. When you write these calls into a real application, take both URLs from the MCP server rather than typing them — run `npx -y @formio/mcp@0.11.0 project get --cwd "$(pwd)"` and use exactly what it prints: its `Project URL` for `setProjectUrl`, its `Base URL` for `setBaseUrl`. Do not hardcode an example host, do not derive either URL from the other, and do not carry a value over from another project or an earlier session — the mapping the server reports is what every build-time Form.io tool call resolves, so a different value here ships an application pointed at a deployment the tooling is not managing. If the command reports a value missing, relay its instruction, persist the answer with the `project set` command it names, and re-run it.

The `Formio` class is a static singleton. URLs are global and must be set once at application bootstrap.

### Hosted (self-deployed Form.io)

A hosted deployment routes projects one of two ways, and the pair has to match how that deployment is configured. Sub-directories:

```ts
import { Formio } from '@formio/js';

Formio.setBaseUrl('https://forms.mysite.com');
Formio.setProjectUrl('https://forms.mysite.com/myproject');
```

Sub-domains — the project is a sibling subdomain of the same parent domain, not a path under the base URL:

```ts
import { Formio } from '@formio/js';

Formio.setBaseUrl('https://forms.mysite.com');
Formio.setProjectUrl('https://myproject.mysite.com');
```

### SaaS (`portal.form.io`)

```ts
import { Formio } from '@formio/js';

Formio.setBaseUrl('https://api.form.io');
Formio.setProjectUrl('https://myproject.form.io');
```

`Formio.getBaseUrl()` and `Formio.getProjectUrl()` return the currently configured values.

`Formio.setAuthUrl(url)` overrides the authentication endpoint when SSO or a custom auth backend is in play (otherwise authentication falls back to `baseUrl`).

`Formio.setPathType('Subdirectories' | 'Subdomains')` controls how project URLs are derived. Hosted deployments default to `Subdirectories`; SaaS defaults to `Subdomains`. Setting `projectUrl` explicitly is preferred over manipulating `pathType` directly.

## API

Static URL / token methods on `Formio`:

- `setBaseUrl(url: string): void` — set the deployment root.
- `getBaseUrl(): string` — return the current base URL.
- `setProjectUrl(url: string): void` — set the project endpoint.
- `getProjectUrl(): string` — return the current project URL.
- `setAuthUrl(url: string): void` — override the auth endpoint.
- `setPathType(type: 'Subdirectories' | 'Subdomains'): void` — set how subproject URLs are derived.
- `setToken(token: string, options?: { namespace?: string }): Promise<void>` — store a JWT in local storage and emit a `user` event.
- `getToken(options?: { decode?: boolean }): string` — read the JWT from storage; with `{ decode: true }` it returns the decoded payload object.
- `setToken(null): Promise<void>` — clear the cached JWT (passing `null` removes it from `Formio.tokens` and `localStorage`). The SDK has no `clearTokens()` shortcut; use `setToken(null)` for logout flows that should not also hit the network.
- `setUser(user, options?): void` / `getUser(options?): object` — store / read the cached current-user payload.

Lazy-library and CDN helpers:

- `Formio.requireLibrary(name, property, src, polling?, onload?, rootElement?): Promise` — inject a script/stylesheet (or array of sources) and resolve when the named global property is present.
- `Formio.libraryReady(name): Promise` — resolve when a previously required library finishes loading.
- `Formio.cdn` — exposes `Formio.cdn.baseUrl`, `Formio.cdn.libs`, and `Formio.cdn.setBaseUrl(url)` to repoint the CDN root (useful when self-hosting third-party assets like ChoicesJS or Flatpickr).
- `Formio.addLibrary(name, src, flag?)` — register a library so the renderer can lazy-load it on demand.
- `Formio.addLoader(loader)` — install a custom asset loader.

Plugin glue (covered in depth in [plugins.md](./plugins.md)):

- `Formio.registerPlugin(plugin, name): void`
- `Formio.deregisterPlugin(plugin | name): boolean`
- `Formio.getPlugin(name): Plugin | null`

## Examples

### Bootstrap a Hosted single-page app

```ts
import { Formio } from '@formio/js';

Formio.setBaseUrl('https://forms.mysite.com');
Formio.setProjectUrl('https://forms.mysite.com/myproject');
```

### Bootstrap a SaaS single-page app

```ts
import { Formio } from '@formio/js';

Formio.setBaseUrl('https://api.form.io');
Formio.setProjectUrl('https://myproject.form.io');
```

### Repoint the CDN for offline / air-gapped builds

```ts
import { Formio } from '@formio/js';

Formio.cdn.setBaseUrl('https://assets.mysite.com/formio');
Formio.setBaseUrl('https://forms.mysite.com');
Formio.setProjectUrl('https://forms.mysite.com/myproject');
```

### Read a decoded token

```ts
import { Formio } from '@formio/js';

const claims = Formio.getToken({ decode: true });
if (claims && claims.user) {
  console.log('logged in as', claims.user._id);
}
```

## MCP Tool Preference

When running inside this MCP-server workspace, prefer the MCP authentication mechanism over hand-calling `Formio.setToken(...)` — the MCP server opens the portal-login flow and persists the JWT for subsequent requests. The SDK methods above are for consumer applications outside this workspace.
