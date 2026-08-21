## Overview

Authentication and current-user access via `@formio/js`. Covers username/password login, logout, current-user lookup, SSO (SAML / Okta), OAuth bearer-token exchange, and JWT decode. Sourced from `packages/core/src/sdk/Formio.ts` in the Form.io source code.

## Imports

```ts
import { Formio } from '@formio/js';
```

## URL Configuration

**Where these two values come from.** The hosts below are illustrations. When you write these calls into a real application, take both URLs from the MCP server rather than typing them — run `npx -y @formio/mcp@0.11.0 project get --cwd "$(pwd)"` and use exactly what it prints: its `Project URL` for `setProjectUrl`, its `Base URL` for `setBaseUrl`. Do not hardcode an example host, do not derive either URL from the other, and do not carry a value over from another project or an earlier session — the mapping the server reports is what every build-time Form.io tool call resolves, so a different value here ships an application pointed at a deployment the tooling is not managing. If the command reports a value missing, relay its instruction, persist the answer with the `project set` command it names, and re-run it.

### Self-Hosted

```ts
import { Formio } from '@formio/js';

Formio.setBaseUrl('https://forms.mysite.com');
Formio.setProjectUrl('https://forms.mysite.com/myproject');
```

### Form.io SaaS

```ts
import { Formio } from '@formio/js';

Formio.setBaseUrl('https://api.form.io');
Formio.setProjectUrl('https://myproject.form.io');
```

Login is project-scoped: requests post to `${projectUrl}/user/login` (or the project-admin equivalent for `/admin/login`). Override the auth endpoint with `Formio.setAuthUrl(url)` only when an SSO bridge sits in front of the platform.

## API

- `Formio.currentUser(formio?: Formio, options?): Promise<object>` — return the currently authenticated user (decodes the JWT, calls `${baseUrl}/current` if the cache is stale). Emits a `user` event on the global `Formio.events`.
- `Formio.logout(formio?: Formio, options?): Promise<void>` — `POST /logout`, clear stored tokens, clear request cache, emit `user` with `null`.
- `Formio.setToken(token: string, options?: { namespace?: string }): Promise<void>` — install a JWT; the SDK persists it to `localStorage` under `Formio.namespace`.
- `Formio.getToken(options?: { decode?: boolean }): string` — read the active JWT; with `{ decode: true }` returns the decoded payload (`{ user, form, project, exp, iat, ... }`).
- `Formio.setToken(null): Promise<void>` — clear the cached JWT/user payload. The SDK has no `clearTokens()` shortcut; pass `null` to `setToken` (and optionally clear `Formio.tokens` directly) for logout flows that should not hit `POST /logout`.
- `Formio.ssoInit(type: 'saml' | 'okta', options?): Promise` — start SSO redirect; on return the JWT lands in the URL hash and `Formio.pageQuery()` parses it.
- `Formio.samlInit(options?): Promise` — direct SAML entry point (equivalent to `ssoInit('saml', options)`).
- `Formio.oktaInit(options?): Promise` — direct Okta entry point.
- `Formio.oAuthCurrentUser(formio: Formio, token: string): Promise<object>` — exchange an OAuth bearer token for a Form.io JWT + current-user payload.
- `Formio.oauthLogoutURI(uri: string, options?): string` — set / read the OAuth logout-redirect URI.
- `Formio.pageQuery(): object` — parse `window.location` query + hash params into a plain object (used to lift JWTs out of SSO redirects).

There is no static `Formio.login`. Login is performed by `saveSubmission` on the login form, which is wrapped on the user resource:

```ts
const userForm = new Formio(`${Formio.getProjectUrl()}/user/login`);
const submission = await userForm.saveSubmission({
  data: { email, password },
});
// JWT is delivered in the response headers and auto-installed by the SDK.
```

The MCP server's authentication mechanism wraps the portal-login equivalent for platform admins (`${projectUrl}/admin/login`).

## Examples

### Email / password login

```ts
import { Formio } from '@formio/js';

Formio.setBaseUrl('https://forms.mysite.com');
Formio.setProjectUrl('https://forms.mysite.com/myproject');

const userLogin = new Formio(`${Formio.getProjectUrl()}/user/login`);
const submission = await userLogin.saveSubmission({
  data: { email: 'alice@example.com', password: 'hunter2' },
});

const user = await Formio.currentUser();
console.log('logged in:', user.data.email);
```

### Read the decoded JWT

```ts
import { Formio } from '@formio/js';

const claims = Formio.getToken({ decode: true });
if (!claims || claims.exp * 1000 < Date.now()) {
  console.warn('token missing or expired');
}
```

### SSO via Okta

```ts
import { Formio } from '@formio/js';

Formio.setBaseUrl('https://api.form.io');
Formio.setProjectUrl('https://myproject.form.io');

await Formio.ssoInit('okta', {
  clientId: 'okta-app-id',
  authority: 'https://acme.okta.com',
  redirectUri: window.location.origin + '/callback',
});

// On /callback:
const query = Formio.pageQuery();
if (query.token) {
  await Formio.setToken(query.token);
  const user = await Formio.currentUser();
  console.log('SSO user:', user.data.email);
}
```

### Logout

```ts
import { Formio } from '@formio/js';

await Formio.logout(); // POST /logout + clears cached tokens
```

### Clear the cached JWT without calling /logout

```ts
import { Formio } from '@formio/js';

await Formio.setToken(null); // empties Formio.tokens and removes the persisted JWT
```

### OAuth bearer-token exchange

```ts
import { Formio } from '@formio/js';

const projectFormio = new Formio(Formio.getProjectUrl());
const user = await Formio.oAuthCurrentUser(projectFormio, googleBearerToken);
```

## MCP Tool Preference

Inside this workspace, prefer the MCP server for authentication — it opens the portal-login flow and installs the JWT into `formioFetch`. The SDK examples above are for consumer applications.
