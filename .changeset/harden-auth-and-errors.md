---
'@formio/mcp': minor
'@formio/ai': patch
---

Keep a valid login through permission refusals, bound every request in time, and add a way to sign out.

- **A 401 is checked before it is treated as an expired token.** With a JWT, a 401 first asks the deployment's `/current`. When the token is still accepted, it is kept and the call fails with `FORBIDDEN` (status 401) naming the signed-in account and the URL refused, with no login. Only when `/current` also refuses the token does the server sign in again and retry once.
- **Every Form.io request has a timeout:** 60 seconds by default, set with the `FORMIO_REQUEST_TIMEOUT` environment variable (seconds; a positive integer, anything else is ignored), and 300 seconds for `project_import` and `project_export` whatever that variable says. A request whose response — headers or body — does not arrive in time fails with `NETWORK_ERROR` naming the URL and the wait.
- **The browser is launched detached,** with its output discarded, so the server neither buffers, holds nor terminates it. The login URL is still printed on stderr every time.
- **Sign out:** `formio-mcp project logout [--base-url <url>] [--cwd <path>]` removes one deployment's cached token from `~/.formio/mcp-tokens.json` — the one the directory resolves to, exactly as `project get` resolves it, or the one `--base-url` names — and leaves the others. It exits `0` when a token was removed or none was cached (saying which), `1` when the directory resolves no project (as `project get` does), `3` when a project resolves without a deployment, and `2` when the cache cannot be read or written. A running server checks the cache before reusing a token it holds in memory, so the next call signs in again without a restart; an entry replaced by another sign-in is validated and used in its place.
- **`project_import` checks the template's shape** before sending it: `forms` and `resources` must be objects keyed by machine name (an empty object is fine), and `roles` / `actions` must be objects when present. Anything else is refused with `INVALID_ARGUMENT` naming the key, and no request is made. Other keys pass through unchanged.
- The plugin README no longer says a directory mapping falls back to environment values for a half it omits: a record's project and deployment are a pair, and halves are never combined across records.
