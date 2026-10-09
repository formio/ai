## Why

Every Form.io tool builds its request URL by joining tool arguments onto the resolved Project URL, and it attaches whichever credential the configuration holds. Neither step checks the result: an argument shaped like a URL or a relative path moves the request off the project, and a record can pair a project with a deployment on an unrelated domain, so the credential issued by one deployment goes with requests addressed to another. 1.0.0 freezes the tool surface, and the rule "a request goes to the project the user configured, carrying only the credential that deployment issued" belongs in it from the first stable release.

## What Changes

- **Path arguments are validated before a URL is built.** Every tool argument that becomes part of a request path — `formIdOrPath`, `formId`, `actionId`, `actionName`, `version`, `roleId` — is checked by one shared rule. A form path keeps its `/` separators (`user/login` stays valid); a value carrying a URL scheme, a leading `/`, a `//`, a backslash, a `.` or `..` segment, or an empty segment is refused, naming the argument, before any request is made. Arguments that name one resource (`actionId`, `actionName`, `version`, and `formId` on the action tools) accept a single segment. Arguments that already require an ObjectId keep that check.
- **Every request stays under the Project URL.** `formioFetch` refuses to send a request whose built URL's origin differs from the Project URL's origin or whose path is not under the Project URL's path, as an invariant behind the argument rule.
- **The API key is sent only to the project it was issued for.** `FORMIO_API_KEY` is attached when the resolved project is on the same origin as `FORMIO_PROJECT_URL`. A project resolved from a committed `formio.json` or a directory mapping on another origin authenticates through the portal login instead, and `project_get` says the key was not applied and why.
- **A path-less project's deployment shares its registrable domain.** The pair rule gains one verdict: a project URL with no path on a customer domain (`https://myproject.mysite.com`) pairs only with a deployment on the same registrable domain (`https://api.mysite.com`). A deployment on another domain is handled exactly as the existing "API root is not your deployment" verdict is: writers refuse it, and the resolver ignores the recorded value with a note and leaves the deployment unresolved. `project set --force` still records such a pair for a developer at a shell.
- **New runtime dependency:** `tldts`, for registrable-domain comparison that is correct under multi-label public suffixes (`co.uk`, `com.au`).
- Not breaking for any documented configuration: the hosted cloud, sub-directory, and sibling-sub-domain shapes in `formio-mcp-setup/references/project-urls.md` resolve exactly as today with no new prompt. No tool or argument is renamed.

## Capabilities

### New Capabilities

- `tool-path-arguments`: the single rule every tool applies to an argument before it becomes part of a request path, and the error it returns.

### Modified Capabilities

- `formio-client`: `formioFetch` refuses any request whose built URL is not under the Project URL's origin and path.
- `lazy-auth`: API key mode applies only when the resolved project is on `FORMIO_PROJECT_URL`'s origin; otherwise the portal-login path runs.
- `project-map-routing`: the pair rule adds the registrable-domain check for path-less customer project URLs, applied by every writer and by the resolver.

## Impact

- Code: `packages/mcp-server/src/formio-client.ts`, `auth-header.ts`, `ensure-auth.ts`, `pair-rule.ts`, `project-resolver.ts`, `project-report.ts`, `cli/project-command.ts`, a new shared path-argument module under `src/tools/`, and every tool that joins an argument into a path (`form_get`, `form_update`, `form_revisions_list`, `form_revision_get`, `action_*`, `role_update`) plus `revisions/flows.ts` and `revisions/tracking.ts`.
- Dependencies: adds `tldts` to `@formio/mcp`'s runtime dependencies.
- Docs: `packages/mcp-server/README.md`, root `README.md`, and `plugin/README.md` describe `FORMIO_API_KEY` as bound to `FORMIO_PROJECT_URL`. Skill prose is unchanged: no skill builds a request path or sets the API key.
- Users: a setup that relied on `FORMIO_API_KEY` without `FORMIO_PROJECT_URL`, or for a project on a different origin, now gets the portal login for that project; `project_get` names the cause.
