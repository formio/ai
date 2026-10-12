## 1. 401 checks /current before re-authenticating
<!-- depends_on: none -->

### Red

- [x] 1.1 Write failing tests in `formio-client.test.ts`: a 401 with a JWT and `/current` 200 (`data.email`) → `FORBIDDEN`-coded error with status 401 naming the email and URL; token not cleared (memory and disk); gate not called; no retry
- [x] 1.2 Write failing tests: `/current` non-2xx, redirect, timeout, or network failure → today's clear/gate/retry path; API-key 401 → no `/current` request, no retry
- [x] 1.3 Update `lazy-auth` tests: the re-auth scenarios assert `/current` refused first; add the permission-refusal scenario (no browser opens)

### Green

- [x] 1.4 Implement the `/current` check in `formioRawFetch` (shared helper with `token-validation.ts`), returning a `ToolError` FORBIDDEN with status 401

### Refactor

- [x] 1.5 Review implementation and refactor as needed

## 2. Request timeouts
<!-- depends_on: none -->

### Red

- [x] 2.1 Write failing tests: a request with no response aborts after the default (fake timers or a test-supplied timeout) with `NETWORK_ERROR` naming the URL and seconds; a caller `signal` still aborts with its own error
- [x] 2.2 Write failing tests: `project_import` / `project_export` use 300 s; `FORMIO_REQUEST_TIMEOUT=5` sets the default to 5 s and does not change import/export; `0` / `abc` / unset → 60 s

### Green

- [x] 2.3 Implement the timeout in `formioRawFetch` (`AbortSignal.any` with `AbortSignal.timeout`), the env var in `config.ts`, and the 300 s option on the two tools

### Refactor

- [x] 2.4 Review implementation and refactor as needed

### Follow-up

- [x] 2.5 Body-read timeout maps to NETWORK_ERROR: a response whose headers arrive in time but whose body read the timeout aborts (a `TimeoutError` from `json()` / `text()`) fails with the same `NETWORK_ERROR` "timed out after N seconds" naming the URL, not `INTERNAL`; a caller's own abort keeps its reason

## 3. Detached browser launch and the login-form cache
<!-- depends_on: none -->

### Red

- [x] 3.1 Write failing tests in `browser-launch.test.ts`: `spawn` called with `{ stdio: 'ignore', detached: true, windowsHide: true }`, `unref()` called, an `'error'` event calls `onError`; `execFile` not used
- [x] 3.2 Write a failing test that the login URL is printed on stderr when the launch succeeds and when it fails
- [x] 3.3 Write a regression test that a failed login-form lookup is retried by the next login for the same project, and a found one is reused (the lookup already caches only a found form; no code change)

### Green

- [x] 3.4 Switch `browser-launch.ts` to a detached `spawn`

### Refactor

- [x] 3.5 Review implementation and refactor as needed

## 4. Sign out
<!-- depends_on: 1 -->

### Red

- [x] 4.1 Write failing CLI tests for `project logout`: `--cwd` resolves the deployment and removes its entry (others kept), `--base-url` names it directly, no entry → exit 0 saying so, no project → exit 1 (as `project get`), project without a resolvable deployment → exit 3, unreadable cache → exit 2
- [x] 4.2 Write failing `ensure-auth` tests: an in-memory token whose cache entry was removed or changed is discarded and the gate runs; an unchanged entry is reused without validation

### Green

- [x] 4.3 Implement `project logout` beside `project get` / `project set` and the cache check in `ensureAuthenticated`

### Refactor

- [x] 4.4 Review implementation and refactor as needed

## 5. project_import template shape
<!-- depends_on: none -->

### Red

- [x] 5.1 Write failing tests: missing `resources` or `forms` → `INVALID_ARGUMENT` naming the key, no request; `forms: []` → `INVALID_ARGUMENT` naming `forms`; `roles: []` / `actions: []` → refused; empty objects and extra keys (`reports`) → sent

### Green

- [x] 5.2 Implement the shape check in `tools/project_import.ts`

### Refactor

- [x] 5.3 Review implementation and refactor as needed

## 6. Docs and release notes
<!-- depends_on: 2, 4 -->

### Red

- [x] 6.1 Write a failing docs test: `plugin/README.md` does not say a mapping entry falls back to environment values for an omitted half; both server READMEs document `project logout` and `FORMIO_REQUEST_TIMEOUT`; `server.json` lists `FORMIO_REQUEST_TIMEOUT`

### Green

- [x] 6.2 Update the READMEs (CLI table, env var table, logout), `plugin/README.md`, `server.json`; add a changeset (`@formio/mcp` minor, `@formio/ai` patch)
- [x] 6.3 Run `pnpm test`, `pnpm lint`, `pnpm format`, `pnpm check:releases`, `openspec validate --strict`

### Refactor

- [x] 6.4 Review implementation and refactor as needed
