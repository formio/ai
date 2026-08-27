## Overview

Plugin lifecycle and hook system. Plugins intercept every request the SDK makes, can alter URLs, options, and responses, and run in priority order. Sourced from `packages/core/src/sdk/Plugins.ts` in the Form.io source code.

## Imports

```ts
import { Formio } from '@formio/js';
```

## URL Configuration

**Where these two values come from.** The hosts below are illustrations — never ship one. Take both URLs from whichever of the two paths applies, per [`project-urls.md`](../../formio-mcp-setup/references/project-urls.md). **If the Form.io MCP tools are callable by you**, call `project_get` with `cwd` set to the user's current working directory and use exactly what it reports: its `projectUrl` for `setProjectUrl`, its `baseUrl` for `setBaseUrl`; if it reports a value missing, relay its instruction, persist the answer with `project_set`, and call it again. **If they are not, ask the user** — for the Project URL first and alone, deriving the Base URL from it, and asking for the Base URL only in the one shape where it cannot be derived. Do not install the MCP server to obtain these two values: writing them into an application reaches no deployment. Either way, do not hardcode an example host, do not derive either URL from the other, and do not carry a value over from another project or an earlier session — a wrong value here ships an application pointed at a deployment nobody is managing.

### Hosted

```ts
import { Formio } from '@formio/js';

Formio.setBaseUrl('https://forms.mysite.com');
Formio.setProjectUrl('https://forms.mysite.com/myproject');
```

### SaaS

```ts
import { Formio } from '@formio/js';

Formio.setBaseUrl('https://api.form.io');
Formio.setProjectUrl('https://myproject.form.io');
```

Plugins observe every request the SDK issues against `baseUrl` or `projectUrl` — configure URLs before registering plugins so the plugin sees consistent endpoints.

## API

Plugin registration:

- `Formio.registerPlugin(plugin, name): void` — install a plugin; the plugin's `init(Formio)` runs immediately.
- `Formio.deregisterPlugin(plugin | name): boolean` — remove a plugin; the plugin's `deregister(Formio)` runs first.
- `Formio.getPlugin(name): Plugin | null` — look up a registered plugin by name.

Reduction helpers (call these to invoke plugins manually inside your own code):

- `Formio.pluginAlter(hook, value, ...args): any` — fold `value` through every plugin's `hook(value, ...args)` and return the final value.
- `Formio.pluginGet(hook, ...args): Promise<any>` — return the first non-null result from the first plugin that handles `hook`.
- `Formio.pluginWait(hook, ...args): Promise<void>` — wait for all plugins to resolve `hook(...args)`.

Plugin shape:

```ts
interface Plugin {
  __name?: string;
  priority?: number;
  init?(Formio: typeof FormioStatic): void;
  deregister?(Formio: typeof FormioStatic): void;

  // Lifecycle hooks (any subset):
  preRequest?(requestArgs: {
    url: string;
    method: string;
    data: any;
    opts: any;
  }): void | Promise<void>;
  request?(requestArgs): Promise<any> | null;
  staticRequest?(requestArgs): Promise<any> | null;
  fileRequest?(requestArgs): Promise<any> | null;
  wrapRequestPromise?(promise: Promise<any>, requestArgs): Promise<any>;
  wrapStaticRequestPromise?(promise: Promise<any>, requestArgs): Promise<any>;
  wrapFileRequestPromise?(promise: Promise<any>, requestArgs): Promise<any>;
  wrapFetchRequestPromise?(promise: Promise<Response>, requestArgs): Promise<Response>;
  requestOptions?(options: RequestInit, url: string): RequestInit;
  requestResponse?(response: Response, formio: typeof FormioStatic, requestArgs): Response;
}
```

Lifecycle order for a single request:

1. `preRequest` — fan-out (`pluginWait`), no return value used.
2. `request` — first non-null wins (`pluginGet`); a plugin can short-circuit the network call by returning a Promise resolving to a response body.
3. `requestOptions` — fold (`pluginAlter`); plugins shape the `fetch` `RequestInit`.
4. The network call happens.
5. `requestResponse` — fold; plugins reshape the `Response`.
6. `wrapRequestPromise` (or `wrapStaticRequestPromise`, `wrapFileRequestPromise`) — fold over the final Promise.

Plugin priority controls order: higher `priority` runs first. The SDK keeps plugins sorted by `priority` descending after every `registerPlugin`.

## Examples

### Tag every request with a tenant ID

```ts
import { Formio } from '@formio/js';

Formio.setBaseUrl('https://forms.mysite.com');
Formio.setProjectUrl('https://forms.mysite.com/myproject');

Formio.registerPlugin(
  {
    __name: 'tenant-header',
    priority: 10,
    requestOptions(options) {
      options.headers = { ...options.headers, 'x-tenant-id': 'acme-co' };
      return options;
    },
  },
  'tenant-header'
);
```

### Short-circuit a request with a cached response

```ts
import { Formio } from '@formio/js';

const cache = new Map<string, any>();

Formio.registerPlugin(
  {
    __name: 'memo-cache',
    priority: 100,
    request({ url, method }) {
      if (method !== 'GET') return null;
      const hit = cache.get(url);
      return hit ? Promise.resolve(hit) : null;
    },
    wrapRequestPromise(promise, { url, method }) {
      return promise.then((value) => {
        if (method === 'GET') cache.set(url, value);
        return value;
      });
    },
  },
  'memo-cache'
);
```

### Log every preRequest

```ts
import { Formio } from '@formio/js';

Formio.setBaseUrl('https://api.form.io');
Formio.setProjectUrl('https://myproject.form.io');

Formio.registerPlugin(
  {
    __name: 'logger',
    priority: 1,
    preRequest({ url, method }) {
      console.log('[formio]', method, url);
    },
  },
  'logger'
);
```

### Deregister a plugin

```ts
import { Formio } from '@formio/js';

Formio.deregisterPlugin('logger');
```

### Manually fold a value through plugins

```ts
import { Formio } from '@formio/js';

const finalUrl = Formio.pluginAlter('rewriteUrl', `${Formio.getProjectUrl()}/intake`, {
  formId: 'intake',
});
```

## MCP Tool Preference

Plugins are SDK-only — no MCP tool maps to plugin registration. Use the SDK directly.
