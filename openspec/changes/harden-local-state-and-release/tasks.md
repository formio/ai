## 1. Atomic, serialized map writes
<!-- depends_on: none -->

### Red

- [x] 1.1 Write failing tests: a write goes through a temp file and rename with mode 0600; two concurrent writers (separate processes via child_process, or interleaved calls with the lock held) both keep their entries; a stale lock (>3 s) is replaced; an unobtainable lock fails with CONFIG_UNREADABLE naming the lock file; the lock is removed after success and failure

### Green

- [x] 1.2 Implement the lock and atomic write in `project-map.ts`, reusing the token cache's atomic writer

### Refactor

- [x] 1.3 Review implementation and refactor as needed

## 2. Canonical, ancestor-aware lookup
<!-- depends_on: 1 -->

### Red

- [x] 2.1 Write failing tests: a subdirectory resolves its mapped ancestor; the nearer mapping wins; a symlinked path matches its target's mapping; case-insensitive matching on darwin/win32 (simulate platform); `/c/...` read as `C:\...` on win32; existing keys match without the file being rewritten; writes store the canonical form; committed `formio.json` still outranks a mapping

### Green

- [x] 2.2 Implement `canonicalDir` and the ancestor walk in `project-map.ts` / `project-resolver.ts`, and use it in `project_set`, `project set`, and the workspace-root record check

### Refactor

- [x] 2.3 Review implementation and refactor as needed

## 3. Scoped certificate setting
<!-- depends_on: none -->

### Red

- [x] 3.1 Write failing tests: with `FORMIO_INSECURE_TLS` true, a request to the resolved deployment host against a local self-signed HTTPS server succeeds; a request to another host is not given the relaxed dispatcher; `NODE_TLS_REJECT_UNAUTHORIZED` is not set; with it false, no dispatcher is passed

### Green

- [x] 3.2 Add `undici`, implement the lazily created dispatcher and its host check in `formio-client.ts` (and the auth probes that call `send`), and remove the process-wide setting

### Refactor

- [x] 3.3 Review implementation and refactor as needed

## 4. Login callback value and page embedding
<!-- depends_on: none -->

### Red

- [x] 4.1 Write failing tests: the served page carries a per-login value; `/callback` with the matching value completes the login; a missing or different value answers 403 and the login keeps waiting; the login-form URL appears in the page as a JSON string literal (a URL containing `'` is passed whole)

### Green

- [x] 4.2 Implement the value, its timing-safe comparison, and JSON embedding in `auth.ts`

### Refactor

- [x] 4.3 Review implementation and refactor as needed

## 5. Docker image from the lockfile
<!-- depends_on: none -->

### Red

- [x] 5.2 Write a failing test that the Dockerfile installs with `pnpm install --frozen-lockfile` and the release workflow's Docker build context is the repository root

### Green

- [x] 5.4 Rework the Dockerfile to build from the repository root with the lockfile and `pnpm deploy`; update the workflow's build context and any Docker docs

### Refactor

- [x] 5.5 Review implementation and refactor as needed

## 6. Package contents and version
<!-- depends_on: none -->

### Red

- [x] 6.1 Write failing tests: `npm pack --dry-run` lists `LICENSE`; a stale module in `dist` is gone after `build`; the `.mcpb` and plugin bundles report the package version from `server_status`; every `FORMIO_*` variable read in `src` is declared in `server.json`

### Green

- [x] 6.2 Add LICENSE to the package (`files` + `prepack` copy, git-ignored), make `build` clear `dist`, write the version in with esbuild `define` in both bundle scripts with a `package.json` fallback, and add the `FORMIO_AUTH_*` entries to `server.json`

### Refactor

- [x] 6.3 Review implementation and refactor as needed

## 7. Docs and release notes
<!-- depends_on: 1, 2, 3, 4, 5, 6 -->

### Red

- [x] 7.1 Write a failing docs test: both server READMEs say a mapping applies to subdirectories and that `FORMIO_INSECURE_TLS` applies only to the configured deployment

### Green

- [x] 7.2 Update the READMEs; add a changeset (`@formio/mcp` patch); run `pnpm test`, `pnpm lint`, `pnpm format`, `pnpm check:releases`, `openspec validate --strict`

### Refactor

- [x] 7.3 Review implementation and refactor as needed

## 8. Review follow-ups
<!-- depends_on: 1, 2, 4, 6 -->

### Red

- [x] 8.1 Write failing tests: a mapping above a directory holding `.git` does not apply inside it; two directories differing only by case on a case-sensitive volume keep separate entries; a stored directory that no longer exists matches case-insensitively on darwin/win32; restating an inherited pair is unchanged and never copies `forced`; the lock holds an owner token, a holder releases only its own lock, a stale lock is broken by a unique rename and only one breaker proceeds; stale 3 s inside a 5 s wait; transient rename and lock-create errors are retried; reads reuse the parsed map until its stat changes; a root LICENSE change needs a server release; the login server bound to loopback refuses a foreign `Host` on both routes, bound to every interface skips the check (the per-login value still required), and bound to a specific host accepts it at any port; `ProjectMapUnreadableError` takes one options object

### Green

- [x] 8.2 Implement the repository boundary, exact real-path matching, lock ownership and rename-to-break, the timings, transient-error retries, the read cache, the inherited unchanged outcome, the release-coverage entry, and the Host check

### Refactor

- [x] 8.3 Review implementation and refactor as needed
