## 1. Shape-aware base-URL resolution
<!-- depends_on: none -->

### Red

- [x] 1.1 In `packages/mcp-server/src/__tests__/project-resolver.test.ts`, write a failing test: with no base URL from the environment or the mapping and a project URL of `https://examples.form.io`, resolution returns `https://api.form.io` with `sources.baseUrl === 'default'` (the unchanged hosted-cloud case, pinned so the new logic cannot regress it)
- [x] 1.2 Write a failing test: project URL `https://forms.mysite.com/myproject` and no supplied base URL resolves to `https://forms.mysite.com` with `sources.baseUrl === 'derived'`
- [x] 1.3 Write a failing test: project URL `https://forms.mysite.com/one/two` derives `https://forms.mysite.com/one` — the parent path is retained and the value is NOT flattened to the origin
- [x] 1.4 Write a failing test: project URL `http://localhost:3000/authoring-abc123` derives `http://localhost:3000`, port included
- [x] 1.5 Write a failing test: project URL `https://myproject.mysite.com` with no supplied base URL resolves SUCCESSFULLY, with the project URL intact, the base URL absent, and `sources.baseUrl === 'unresolved'` — resolution does not throw
- [x] 1.6 Write a failing test: an explicit `FORMIO_BASE_URL` from the environment, and a mapped `FORMIO_BASE_URL`, each still win for a path-less non-`form.io` project URL — the unresolved state arises only when nothing supplied a value
- [x] 1.7 Write a failing test asserting the pinned-environment path is unaffected: `FORMIO_PROJECT_URL` set to a path-less customer project with `FORMIO_BASE_URL` also set resolves both from the environment with no derivation

### Green

- [x] 1.8 Add `'derived'` and `'unresolved'` to the `BaseUrlSource` union in `packages/mcp-server/src/project-resolver.ts`, and make `ResolvedFormioConfig.baseUrl` optional in `packages/mcp-server/src/config.ts`
- [x] 1.9 Rewrite `chooseBaseUrl` to take the resolved project URL alongside the ordered candidates and decide the no-candidate case by shape: `form.io` host → `DEFAULT_BASE_URL` / `'default'`; non-empty path → the project URL minus its final path segment / `'derived'`; otherwise absent / `'unresolved'`
- [x] 1.10 Fix every compile error the optional `baseUrl` surfaces, deferring the auth-path guard itself to group 2 — no site may paper over `undefined` by interpolating it into a URL

### Refactor

- [x] 1.11 Review implementation and refactor as needed

## 2. The auth path requires a base URL; nothing else does
<!-- depends_on: 1 -->

### Red

- [x] 2.1 Write a failing test: with no `FORMIO_API_KEY`, a project-scoped tool called against an unresolved-base-URL project fails with an error naming `project_set` and `baseUrl`, echoing the project URL, not claiming the project is unconfigured, and stating that JWT authentication is what is blocked
- [x] 2.2 Write a failing test asserting that same call opens no portal-login window and makes no request to `https://api.form.io`
- [x] 2.3 Write a failing test: with `FORMIO_API_KEY` set and the same unresolved-base-URL project, `form_list` succeeds against the project URL and raises no base-URL error — the regression this group exists to prevent
- [x] 2.4 Write a failing test asserting no `${baseUrl}/current` request is ever issued with an `undefined` segment (guards the interpolation failure mode named in the design)
- [x] 2.5 Write a failing test asserting `hello` still succeeds with an unresolved base URL

### Green

- [x] 2.6 Add `requireBaseUrl(config)` and call it from the auth path only — `ensure-auth.ts`, `auth.ts`'s login-candidate builder, `token-validation.ts`, and `formio-client.ts`'s 401-retry branch
- [x] 2.7 Reorder `ensureAuthenticated` so the `FORMIO_API_KEY` short-circuit precedes every `baseUrl` read, including the `jwtCache.get(config.baseUrl)` lookup that currently runs first

### Refactor

- [x] 2.8 Review implementation and refactor as needed

## 3. Shapes guidance and the CLI report
<!-- depends_on: 1, 2 -->

### Red

- [x] 3.1 Write a failing test in the project-command suite: `project get` for a mapping with project URL `https://forms.mysite.com/myproject` and no base URL prints `https://forms.mysite.com` and a `Source:` line saying the value was derived from the project URL — not "mapped", not "the default"
- [x] 3.2 Write a failing test: the same command for `https://forms.mysite.com/one/two` prints `https://forms.mysite.com/one` and not `https://forms.mysite.com`
- [x] 3.3 Write a failing test: `project get` for `https://myproject.mysite.com` with no base URL exits `2`, prints the project URL, names `project set` and `--base-url`, never prints `https://api.form.io`, and says JWT authentication is what is blocked
- [x] 3.4 Write a failing test asserting the server's declared `instructions` no longer claim a base URL never carries a path, and do state that a sub-directory project URL is its deployment's URL plus exactly one segment — while still stating that a `*.form.io` host is never a base URL and that a path-less project URL yields no derivable base URL

### Green

- [x] 3.5 Add the derived and unresolved reporting to `packages/mcp-server/src/cli/project-command.ts` (the base-URL `Source:` line, ~line 226) and route the unresolved case to exit `2`
- [x] 3.6 Update the three-shapes text in `packages/mcp-server/src/server.ts` per the `server-config` delta

### Refactor

- [x] 3.7 Review implementation and refactor as needed

## 4. Spec sync and repo checks
<!-- depends_on: 1, 2, 3 -->

### Red

- [x] 4.1 Write a failing test asserting `openspec/specs/project-map-routing/spec.md` no longer states the base URL falls back unconditionally to the configured value, and that it enumerates the five base-URL sources including `derived` and `unresolved`

### Green

- [x] 4.2 Apply the two delta specs in `openspec/changes/guard-unconfigured-project-calls/specs/` to their counterparts under `openspec/specs/`, replacing each MODIFIED requirement block in full
- [x] 4.3 Run `pnpm test`, `pnpm lint`, and `pnpm format` (no skill markdown is edited by this change, so no prose-wrap pass is needed)

### Refactor

- [x] 4.4 Review implementation and refactor as needed
