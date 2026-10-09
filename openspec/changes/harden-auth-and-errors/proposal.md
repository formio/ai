## Why

Four paths still cost a user a browser login, a hung call, or a 500 they did not cause:

- Every 401 is read as an expired token. Form.io also answers 401 to a signed-in user who is not permitted the operation (`permissionHandler.js`), so a permission refusal discards a valid token, opens the portal login, and fails again after it — on every such call.
- Requests carry no timeout. A deployment that accepts the connection and never answers holds the tool call open indefinitely.
- On Linux, the browser launcher's child process can stay attached to the browser, and its buffered output is capped at 1 MB; a chatty browser is then terminated, sometimes mid-login.
- `project_import` sends any object. Form.io's importer reads `template.forms` and `template.resources` unconditionally (`templates/import.js`), so a template missing either fails server-side with a 500.

And two gaps leave the user without a lever: there is no way to sign out or switch accounts (the running server keeps its token in memory), and a failed login-form lookup is remembered for the session.

## What Changes

- **401 is checked before it is treated as an expired token.** With a JWT, a 401 first asks `{baseUrl}/current`. If the token is still valid, the token is kept and the tool returns `FORBIDDEN` (status 401) naming the signed-in account and the URL refused. Only when `/current` also refuses does the server re-authenticate once and retry, as today.
- **Every Form.io request has a timeout:** 60 seconds by default, 300 seconds for `project_import` and `project_export`, configurable with `FORMIO_REQUEST_TIMEOUT` (seconds). A timeout is `NETWORK_ERROR` naming the URL and the time waited.
- **The browser is launched detached**, with its output discarded, so the launcher never holds or terminates it. The login URL is still printed every time.
- **Sign out:** a new `formio-mcp project logout` CLI subcommand clears the cached token for the directory's deployment (or a named `--base-url`). The running server notices: before reusing an in-memory token it checks the cache still holds it, and logs in again when it does not. No MCP tool is added.
- **`project_import` checks the template's shape** before sending it: `forms` and `resources` must be objects (empty is fine), and `roles` / `actions`, when present, must be objects. Anything else is `INVALID_ARGUMENT` naming the key.
- **The login-form lookup caches only a found form**; a failed lookup is tried again on the next login.
- **Docs:** `plugin/README.md` no longer says a mapping entry falls back to environment values for a half it omits; halves are never combined across records.
- Changesets: `minor` for `@formio/mcp` (new CLI subcommand and env var), `patch` for `@formio/ai` (README). Both fold into the pending 1.0 major.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `formio-client`: a 401 with a valid token is a permission refusal, not a re-login; requests time out.
- `lazy-auth`: re-authentication on 401 runs only after `/current` refuses the token; an in-memory token removed from the cache is not reused.
- `user-auth`: the browser is launched detached; the login-form lookup caches only a found form.
- `token-cache`: a CLI command clears a deployment's cached token.
- `project-import`: the template's shape is checked before it is sent.
- `server-config`: `FORMIO_REQUEST_TIMEOUT` sets the request timeout.

## Impact

- Code: `packages/mcp-server/src/formio-client.ts`, `ensure-auth.ts`, `token-validation.ts` (the `/current` check), `token-cache.ts`, `browser-launch.ts`, `auth.ts`, `config.ts`, `tools/project_import.ts`, `tools/project_export.ts`, `cli/project-command.ts` (or a sibling for `logout`).
- Docs: `packages/mcp-server/README.md` and root `README.md` (logout command, `FORMIO_REQUEST_TIMEOUT`, the CLI table), `plugin/README.md`, `server.json` (new env var).
- No tool, argument, or output schema changes; `tools/list` is unaffected.
