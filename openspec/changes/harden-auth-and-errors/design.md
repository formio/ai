## Context

After #91 every tool error carries a code, network failures are typed (`FormioNetworkError`), and a login that cannot complete is `AUTH_REQUIRED`. What remains is how the server behaves around authentication and slow deployments:

- `formioRawFetch` (`formio-client.ts`) treats any 401 in JWT mode as an expired token: it invalidates the in-memory and on-disk token, runs the login gate, and retries once. Form.io's permission handler answers 401 for an authenticated user who lacks the permission (`apps/formio/src/middleware/permissionHandler.js`), so the same path fires for a refusal that a new login cannot change.
- No request carries a timeout except the licence probe (10 s) and the login-form probe.
- `browser-launch.ts` uses `execFile` with a callback. `xdg-open` can keep the browser as its child; `execFile` buffers that output (1 MB cap) and kills the child when the cap is passed.
- `ensure-auth.ts` keeps a per-deployment JWT in memory and reuses it without consulting the cache file, so removing the file entry has no effect on a running server.
- `project_import` forwards any object. Form.io's `/import` reads `Object.values(template.forms)` and `Object.values(template.resources)` before anything else (`templates/import.js:1170`); `roles` and `actions` are read only when present.
- `auth.ts` caches the resolved login-form URL per project (keyed by deployment and Project URL) for the process, and only a lookup that found a form — the case since the initial release — but nothing pins that behaviour.

## Goals / Non-Goals

**Goals:**

- A permission refusal never costs a login; an expired token still does, once.
- No tool call waits indefinitely on a deployment.
- The launcher never terminates or holds the browser.
- A user can sign out or switch accounts without restarting the client.
- An import that Form.io would reject with a 500 is refused before it is sent, naming the key.

**Non-Goals:**

- A sign-out MCP tool (the tool surface is frozen by #91; signing out is a user action at a shell).
- Local state file hardening, request confinement of TLS settings, release pinning — `harden-local-state-and-release`.

## Decisions

**1. A 401 asks `/current` before it re-authenticates.**
`/current` is the one request whose answer distinguishes "this token is no longer accepted" from "this token cannot do that". It is sent with the same headers, `redirect: 'manual'`, and a 10 s timeout. A 2xx means the token is valid: return `FORBIDDEN` with status 401, the account (`data.email`, else `_id`), and the URL. The refusal is a `FormioPermissionError`, a subclass of `FormioApiError` that overrides only the code and appends its remedy, so it carries Form.io's explanation (`formioErrorText(body)`) and the truncated body exactly as every other API error does, and `toolErrorDetails` needs no special case. The remedy names the way to continue as another account: `project logout --base-url <deployment>` (spelled as the runnable `npx` command, like every other CLI command the server prints), then retry — the retry signs in again. It is error text, not a tool description, so `tools/list` is unchanged. Anything else — non-2xx, redirect, timeout, network failure — falls back to today's path (clear, gate, retry once), because a wrong "still valid" is worse than an extra login. The check runs only in JWT mode; API-key mode keeps throwing without retry.
*Alternative:* inspect the 401 body — rejected, Form.io sends a bare `sendStatus(401)` in both cases.

**2. One timeout per request, set in the client.**
`formioRawFetch` combines a caller's `signal` with `AbortSignal.timeout(ms)` (`AbortSignal.any`). The default is 60 s, or `FORMIO_REQUEST_TIMEOUT` seconds when set to a positive integer (parsed with the same helper as `FORMIO_AUTH_TIMEOUT`). That helper ignores a value whose milliseconds exceed 2,147,483,647 — a longer timer overflows and fires at once — so the default applies, as for any other unusable value. `project_import` and `project_export` pass `max(300 s, the configured request timeout)`: the env var can lengthen a template transfer but never shorten it, because a large template legitimately takes minutes and the env var is meant for the everyday calls. A timeout abort maps to `NETWORK_ERROR` with "timed out after N seconds" and the URL; a caller abort keeps its own error. A `project_import` that times out adds that the import may still complete on the server, and to check with `project_export` before retrying — the client stopped waiting, the server may not have, and a blind retry merges the template a second time.
*Alternative:* one timeout for everything — rejected; any value short enough for `form_get` breaks large imports.

**3. Detached launch with ignored streams.**
`spawn(command, args, { stdio: 'ignore', detached: true, windowsHide: true })`, then `child.unref()`, with an `'error'` listener and an `'exit'` listener: a failure to start, or an exit with a non-zero code (`open` and `xdg-open` exit non-zero when nothing can open the URL), calls `onError` once, and `auth.ts` prints the "open it manually" hint. Nothing is buffered, so nothing is capped; the server process does not wait on or own the browser — the exit is observed, never awaited. A zero exit proves nothing (Windows' `rundll32` reports none either way), so the login URL printed on stderr every time (already the case in `auth.ts`) remains the guarantee.

**4. Sign-out is a CLI subcommand plus a cache check before reuse.**
`formio-mcp project logout [--base-url <url>] [--cwd <path>]` lives beside `project get` / `project set`, reusing their flag parsing and exit codes: it resolves the directory's deployment exactly as `project get` does (or takes `--base-url`, normalized), removes that entry from `~/.formio/mcp-tokens.json`, and reports it. In the server, `ensureAuthenticated` checks the cache entry before reusing an in-memory token; a missing file, an entry absent from a readable file, or a different token discards the memory copy. A file that exists but cannot be read or parsed — torn by a concurrent writer, say — says nothing about the token, so the memory copy is kept and no login starts. The check stats the file and re-reads it only when its modification time, size, or inode changed since the last check (stat'd before it is read, so a write between the two only causes one more read); otherwise it reuses the last parsed result. This makes the CLI command — and simply deleting the file — take effect on the next call.

Every write of the cache — `saveToken`, `clearToken`, `signOut` — goes through one writer: the new contents are written to a temporary file in the same directory, created `0600`, and renamed over the cache, so a concurrent reader sees the old file or the new one, never a partial one; a failed write removes the temporary file and leaves the old one. All three share one strict reader, which tells a missing file (no tokens) from an unreadable one; the server's read-modify-write path wraps it to treat an unreadable file as empty (the next login rewrites it), while `signOut` refuses to rewrite a file it cannot parse. Because the file is replaced by rename, what blocks a write is an unwritable directory, not the file's own mode. A `--base-url` the caller typed that is not a URL is answered like `project set` answers one: exit 1, naming the value as typed.

A login is single-flight per deployment, and each tool call resolves its own config, so a call that joins a login in flight — including a 401 re-auth — takes the resulting token from the shared in-memory cache onto its own config before it retries.
*Alternative:* an `auth_logout` MCP tool — rejected for 1.0: it adds surface to a frozen list for an action users take at a shell, and an agent signing a user out unprompted is not a behaviour to invite.

**5. Template shape checked against what the importer reads.**
`forms` and `resources` are required plain objects (empty allowed) because the importer reads both unconditionally; `roles` and `actions`, when present, must be plain objects. Other keys pass through untouched (Form.io accepts `reports`, `revisions`, `name`, and so on). The refusal names the key and says entries are keyed by machine name — the common mistake is an array.

**6. Pin the found-only login-form cache.**
The resolved-form map already stores only success; a failure is returned and forgotten. This change adds a regression test that a failed lookup is retried by the next login and a found one is reused, with no code change.

**7. Docs follow the pair rule.**
`plugin/README.md`'s footnote stops saying a mapping falls back to environment values for an omitted half; it says the mapping's own pair is used and the environment is a separate, weaker record.

## Risks / Trade-offs

- [The `/current` check adds a request to each 401] → Only on a 401, which today costs a full login; the check is cheaper than what it replaces.
- [A 60 s default cuts off a legitimately slow call] → `FORMIO_REQUEST_TIMEOUT` raises it; import and export already get 300 s.
- [Checking the cache file before every reuse] → One `stat` per tool call, and a read only when the file changed; negligible next to the network request that follows.
- [Two writes landing in the same millisecond with the same size] → The inode is part of the comparison, and every write renames a new file into place, so each write is seen.
- [Trusting the opener's exit status] → Only a non-zero exit is acted on, and only to print a hint; a zero exit is not taken as proof (Windows reports none), so the printed URL is the fallback in every case.

## Migration Plan

Additive behaviour; no on-disk format changes (writes are now atomic, the file's contents and mode are as before). Ships under the pending 1.0 release. Rollback is a revert.

## Open Questions

None.
