## Overview

Authentication and current-user access via `@formio/js`. Covers username/password login, logout, current-user lookup, SSO (SAML / Okta), OAuth bearer-token exchange, and JWT decode. Sourced from `packages/core/src/sdk/Formio.ts` in the Form.io source code.

## Imports

```ts
import { Formio } from '@formio/js';
```

## URL Configuration

**Where these two values come from.** The hosts below are illustrations — never ship one. Take both URLs from whichever of the two paths applies, per [`project-urls.md`](../../formio-mcp-setup/references/project-urls.md). **If the Form.io MCP tools are callable by you**, call `project_get` as the preflight does — without `cwd`, unless its `cwdSource` was `server` or `claude-project-dir` — and use exactly what it reports: its `projectUrl` for `setProjectUrl`, its `baseUrl` for `setBaseUrl`; if it reports a value missing, relay its instruction, persist the answer with `project_set`, and call it again. **If they are not, ask the user** — for the Project URL first and alone, deriving the Base URL from it, and asking for the Base URL only in the one shape where it cannot be derived. Do not install the MCP server to obtain these two values: writing them into an application reaches no deployment. Either way, do not hardcode an example host, never build a Project URL from a Base URL, and do not carry a value over from another project or an earlier session — a wrong value here ships an application pointed at a deployment nobody is managing.

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

Login is project-scoped: `saveSubmission` on `${projectUrl}/user/login` posts to `${projectUrl}/user/login/submission` (or the project-admin equivalent for `/admin/login`). Override the auth endpoint with `Formio.setAuthUrl(url)` only when an SSO bridge sits in front of the platform.

## API

- `Formio.currentUser(formio?: Formio, options?): Promise<object>` — resolve the current user. Returns the stored user without a request when one is cached; otherwise sends GET `<root>/current`, where `<root>` is `authUrl` when set, else the passed instance's project URL (with no fallback to the globals), else the global project URL or Base URL; stores the result, and emits `formio.user` on the global `Formio.events`. Resolves `null` when no token is set.
- `Formio.logout(formio?: Formio, options?): Promise<void>` — sends GET `<root>/logout`, where `<root>` is `authUrl` when set, else the passed instance's project URL, else the global Base URL; then clears the token, the stored user, and the request cache, and emits `formio.user` with `null`. The token is cleared even when the request fails.
- `Formio.setToken(token: string, options?: { namespace?: string }): Promise<void>` — install a JWT; the SDK persists it to `localStorage` under `Formio.namespace`. `localStorage` is readable by any script running on the origin, so what keeps the token private is keeping foreign script off the page — the loader rule in [setup.md](./setup.md) and the sanitizer rule in [utils-mask-sanitize.md](./utils-mask-sanitize.md); do not copy the token into a cookie, a global, or a log.
- `Formio.getToken(options?: { decode?: boolean }): string` — read the active JWT; with `{ decode: true }` returns the decoded payload (`{ user, form, project, exp, iat, ... }`), or `{}` when no token is set. The decoded payload is cached and `setToken` does not refresh that cache, so decode again from the raw token after a token change.
- `Formio.setToken(null): Promise<void>` — clear the cached JWT/user payload. The SDK has no `clearTokens()` shortcut; pass `null` to `setToken` (and optionally clear `Formio.tokens` directly) for logout flows that should not send the `/logout` request.
- `Formio.ssoInit(type: 'saml' | 'okta', options?): Promise<object> | false` — call it when the application holds no token: on a page load without a session, and on the page the provider returns to. With no callback present it redirects to the provider and returns `false` even when a session exists (`samlInit` checks only for its own callback), so a page that already holds a token resolves the user with `Formio.currentUser()` instead; on the return trip it consumes the callback itself, installs the JWT, and resolves the user. For `saml` the server appends `?saml=<jwt>` to the return URL, and the SDK reads it, installs it, and strips it with `history.replaceState`; for `okta` the Okta SDK reads its own hash and Formio exchanges the access token at `/current`. Application code reads no token from the URL in either flow.
- `Formio.samlInit(options?): Promise<object> | false` — direct SAML entry point (equivalent to `ssoInit('saml', options)`); `options.relay` sets the return URL.
- `Formio.oktaInit(options?): Promise<object | false>` — direct Okta entry point. `options` are Okta Auth JS settings (`issuer`, `clientId`, `redirectUri`, `scopes`) plus `OktaAuth`, the class from `@okta/okta-auth-js`, when it is not a global.
- `Formio.oAuthCurrentUser(formio: Formio, token: string): Promise<object>` — exchange an OAuth bearer token for a Form.io JWT + current-user payload.
- `Formio.oauthLogoutURI(uri: string, options?): string` — set / read the OAuth logout-redirect URI.
- `Formio.pageQuery(): object` — parse `window.location` query + hash params into a plain object. The SSO entry points above already read and install their own callback token, so application code does not lift one out of the URL itself; a `token` parameter that arrives on a route with no SSO flow behind it is not the identity provider's, and is not installed.

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

// The credentials are whatever the user typed into the login form — a literal
// password in source is never correct, in an example or in a test.
const fields = new FormData(document.querySelector<HTMLFormElement>('#login')!);
const userLogin = new Formio(`${Formio.getProjectUrl()}/user/login`);
const submission = await userLogin.saveSubmission({
  data: { email: fields.get('email'), password: fields.get('password') },
});

const user = await Formio.currentUser();
console.log('logged in:', user.data.email);
```

### Read the decoded JWT

```ts
import { Formio } from '@formio/js';

const claims = Formio.getToken({ decode: true }); // {} when no token is set
if (!claims.exp || claims.exp * 1000 < Date.now()) {
  console.warn('token missing or expired');
}
```

### SSO

<!-- example: fragment -->
```ts
import { Formio } from '@formio/js';
import { OktaAuth } from '@okta/okta-auth-js';

Formio.setBaseUrl('https://api.form.io');
Formio.setProjectUrl('https://myproject.form.io');

// Reuse the session the SDK already holds; start SSO only without one. ssoInit
// redirects whenever its callback is absent, even for a signed-in user. On the page
// the provider returns to it consumes the callback itself (SAML's ?saml=, Okta's
// hash) and installs the JWT.
const session = Formio.getToken() ? await Formio.currentUser() : null;
const user = session ?? (await Formio.ssoInit('okta', {
  OktaAuth,
  issuer: oktaIssuerUrl,
  clientId: oktaClientId,
  redirectUri: window.location.origin + '/callback',
  scopes: ['openid', 'email', 'profile'],
}));
if (user === false) {
  // The browser is navigating to the provider.
} else {
  console.log('SSO user:', user.data.email);
}

// SAML is the same call: `await Formio.ssoInit('saml')` — false while redirecting,
// the user once the provider has returned.
```

### Logout

```ts
import { Formio } from '@formio/js';

await Formio.logout(); // GET …/logout, then clears the token even if the request fails
```

### Clear the cached JWT without calling /logout

```ts
import { Formio } from '@formio/js';

await Formio.setToken(null); // empties Formio.tokens and removes the persisted JWT
```

### OAuth bearer-token exchange

<!-- example: fragment -->
```ts
import { Formio } from '@formio/js';

const projectFormio = new Formio(Formio.getProjectUrl());
const user = await Formio.oAuthCurrentUser(projectFormio, googleBearerToken);
```

## MCP Tool Preference

Inside this workspace, prefer the MCP server for authentication — it opens the portal-login flow and installs the JWT into `formioFetch`. The SDK examples above are for consumer applications.
