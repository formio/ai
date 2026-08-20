## Why

`formio-application`'s Deployment step is the only place in the library that verifies a working directory is mapped to a Form.io project. Every other entry point — another skill invoked first (`formio-form-builder`, `formio-actions`, `formio-auth`, `formio-resource-planner`), or the MCP server used stand-alone with no skills installed — relies on the first tool call failing to surface a missing configuration. That works for a missing **project URL**, which raises an actionable error. It does not work for a missing **base URL**: resolution silently substitutes `https://api.form.io`, so a self-hosted user whose mapping carries only a project URL gets a portal-login URL and a token-cache key pointed at Form.io's hosted cloud instead of their own deployment, and the failure surfaces later as an opaque auth error rather than as the configuration problem it is.

## What Changes

- **Server-side: stop defaulting the base URL when the project URL proves the default cannot be right.** `resolveProject` currently falls back to `https://api.form.io` whenever neither the environment nor the mapping supplied a base URL. That fallback is correct for exactly one of the three deployment shapes. Replace the unconditional default with a shape-aware decision at the same single site:
  - Project URL on a `form.io` host (hosted cloud) → `https://api.form.io`, unchanged, source `default`.
  - Project URL carrying a path (sub-directory routing) → the project URL **minus its final path segment**, new source `derived`. The final segment is the project name; everything before it is the deployment, which may itself be mounted at a sub-path. So `https://forms.mysite.com/myproject` derives `https://forms.mysite.com`, and `https://forms.mysite.com/one/two` derives `https://forms.mysite.com/one` — NOT the bare origin.
  - Project URL with no path on any other host (sub-domain routing, e.g. `https://myproject.mysite.com`) → the base URL is **unresolved**, and stays unresolved rather than becoming `https://api.form.io`.
- **The unresolved case fails where the value is needed, not on every call.** `baseUrl` is consumed only by the authentication path — it keys the JWT cache (`ensure-auth.ts`, `token-cache.ts`), builds the portal-login candidates (`auth.ts`), and forms the `${baseUrl}/current` validation request. Every API request is built from `projectUrl` instead (`formio-client.ts`). And `runAuthFlow` returns early when `FORMIO_API_KEY` is set, so an API-key deployment never reads `baseUrl` at all. A resolution-time throw would therefore break a working API-key configuration over a value it never uses. Instead: resolution succeeds with the base URL absent, and the actionable error is raised by the auth path at the moment it needs one.
- **BREAKING (runtime behavior, not API shape), narrowly:** a JWT-authenticating setup whose project URL is a path-less non-`form.io` host with no base URL from either source now fails its first authenticated call with a configuration error naming `project_set` and `baseUrl`, where today it silently attempts login against `https://api.form.io`. That setup cannot authenticate today, so the change converts a late, opaque auth failure into an early, actionable one. API-key setups in the same shape are unaffected and keep working.
- **A base URL may carry a path.** The derivation above can produce one (`https://forms.mysite.com/one`), which the current guidance forbids: `server-config`'s three-shapes text says the base URL never carries a path in any shape. That is corrected here — a deployment mounted at a sub-path is legitimate, and a derived value must not be rejected by the guidance the same server publishes. (`DEPLOYMENT.md` validates on the same rule and is left alone; the follow-on change deletes it.) What stays true is the rest: a `*.form.io` host is never a base URL, and a base URL is never derived from a path-less project URL.
- **`project get` reports the new source.** Its `Source:` line gains wording for a base URL that was derived from the project URL's origin, so a caller can tell derivation from a mapped value and from the default.
- **Skill-side prose is deliberately out of scope here.** This change makes the server correct and its errors actionable; teaching the skills to lead with `project get` and to stop carrying their own URL wording belongs to the follow-on `server-owns-project-configuration` change, so no skill file is edited by one change and rewritten by the next. `DEPLOYMENT.md` is not touched either: it carries a derivation table and a no-path validation rule that this change makes false, but the follow-on change deletes the file outright, so correcting it here would be churn.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `project-map-routing`: the base-URL half of the resolution-precedence requirement becomes shape-aware — derive by dropping the project URL's final path segment, keep `https://api.form.io` only for `form.io`-hosted projects, and leave the base URL unresolved for a path-less non-`form.io` project URL; the actionable-error requirement extends to cover the auth-path failure that unresolved state produces, and to state that non-auth work and API-key work are unaffected by it.
- `server-config`: the three-valid-shapes guidance stops asserting that a base URL never carries a path, so a deployment mounted at a sub-path is representable; `project get`'s "which source won" output covers a derived base URL alongside the environment, the mapping, and the default, and reports an unresolved base URL as unresolved rather than printing the default.

## Impact

- `packages/mcp-server/src/project-resolver.ts` — `chooseBaseUrl` (the single silent-default site, line ~100) and the `BaseUrlSource` union (adds `derived` and `unresolved`).
- `packages/mcp-server/src/config.ts` — `ResolvedFormioConfig.baseUrl` becomes optional, which is what makes "required only for auth" a type-level fact rather than a convention.
- `packages/mcp-server/src/ensure-auth.ts`, `auth.ts`, `token-validation.ts`, `formio-client.ts` (the 401-retry branch) — the auth path gains one `requireBaseUrl(config)` guard raising the actionable error; the API-key short-circuit is ordered ahead of every `baseUrl` read so it never trips.
- `packages/mcp-server/src/server.ts` — the three-shapes text in the MCP `instructions`, which currently states the base URL never carries a path.
- `packages/mcp-server/src/cli/project-command.ts` — the `Source:` phrasing for base URLs (line ~226) and the unresolved case.
- `packages/mcp-server/src/__tests__/` — resolver, ensure-auth, and project-command suites.
- No file under `plugin/skills/` is edited here, and no frontmatter `description` changes, so the byte-identical description snapshot in `fixtures/descriptions-before-preflight.json` stays valid.
- No change to `project_set`'s parameters, to any tool's input or output schema, or to the token-cache keying rule itself.
