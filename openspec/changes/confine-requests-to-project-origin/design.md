## Context

Every project-scoped tool resolves a Project URL, then calls `formioFetch(path, params, cfg)`, which builds `new URL(path, projectUrl + '/')` and sends it with the header `getAuthHeader(config)` returns: `x-jwt-token` when a JWT is held, otherwise `x-token` from `FORMIO_API_KEY`. Tools build `path` by template-joining their arguments (`form/${formId}/action/${actionId}`, or `formIdOrPath` as-is for a form path). Nothing checks what `new URL` produces, so the URL standard's rules — an absolute URL replaces the base, `..` walks up — decide where a request goes.

Credentials come from two places. The JWT is cached per Base URL (`ensure-auth.ts`, `token-cache.ts`) and sent to the Project URL; that is correct only when the project is served by that deployment. The pair rule (`pair-rule.ts` `classifyPair`) already guarantees this for the hosted cloud (a `*.form.io` project pairs only with `https://api.form.io`) and for sub-directory projects (the deployment is derived from the path), but accepts any deployment for a path-less customer project. The API key is read from the environment once and attached to every request, whichever record resolved the project.

The pair rule, its verdict vocabulary, and the resolver's handling of deployment-half verdicts (`faultedHalf`, the note-and-unresolve path in `project-resolver.ts`) already exist and are the extension point here.

## Goals / Non-Goals

**Goals:**

- A request is sent only to a URL under the resolved Project URL.
- A credential is sent only with requests to the deployment or project that issued it.
- Every configuration shape documented in `formio-mcp-setup/references/project-urls.md` resolves exactly as today, with no new prompt, note, or refusal.
- One rule per concern, applied by every caller (the pair rule's own principle).

**Non-Goals:**

- Renaming or re-typing tool arguments (`formId` vs `formIdOrPath` unification belongs to the 1.0 surface proposal).
- A trust-on-first-use confirmation for a committed `formio.json`. Deferred — see Decisions.
- Changes to error-message content for Form.io responses, 401 handling, or timeouts (separate proposals).

## Decisions

**1. Validate arguments with a shared rule, plus an origin/prefix invariant in `formioFetch`.**
Two layers because they answer different questions. The argument rule runs in each tool handler before resolution and names the argument in its error, which is what makes the failure actionable for an agent. The invariant in `formioFetch` guarantees the property for every caller — including `revisions/flows.ts` and `revisions/tracking.ts`, and any future tool — without relying on each one remembering the rule.
*Alternatives:* percent-encoding every argument — rejected, because form paths legitimately contain `/` (`user/login`) and encoding them changes the request; the invariant alone — rejected, because its error cannot name the tool argument, and `..` that stays inside the project would pass it.

**2. The argument rule is a pure function in `src/tools/path-arguments.ts`, applied through the zod schema.**
Expose `projectPathArgument(name)` and `resourceSegmentArgument(name)` as zod schemas built with `.superRefine`, so the refusal goes through the SDK's existing input-validation error path and `isError: true` comes for free. The underlying predicates (`checkProjectPath`, `checkResourceSegment`) are exported for unit tests. Refinements do not serialise into the published JSON Schema, so `tools/list` is unchanged.
*Alternative:* checking inside each handler — rejected, as it repeats the call in eleven handlers.

**3. Prefix check compares path segments, not strings.**
`https://forms.mysite.com/myproject2` must not pass as "under" `https://forms.mysite.com/myproject`, so the check is `pathname === prefix || pathname.startsWith(prefix + '/')` with `prefix` the Project URL's pathname without trailing slashes.

**4. The API key binds to `FORMIO_PROJECT_URL`'s origin, decided in resolution.**
The resolver already knows the winning record and the environment's project. It sets `config.apiKey` on the resolved configuration only when `FORMIO_PROJECT_URL` is set and the resolved Project URL has the same origin; otherwise the field is absent, so `ensureAuthenticated` and `getAuthHeader` need no change — they already fall through to the portal login when there is no key. `project_get`'s report carries the reason when a set key is not applied.
*Alternatives:* a new `FORMIO_API_KEY_PROJECT` variable — rejected, it adds a second value to configure where `FORMIO_PROJECT_URL` already names the project the key was issued for; binding to the full Project URL instead of its origin — rejected, because a sub-directory deployment's projects share an origin, a project-scoped key simply gets a 401 from a sibling project, and origin is what decides where the header travels.

**5. Registrable domain via `tldts`, with private-domain entries enabled.**
`getDomain(host, { allowPrivateDomains: true })` for both hosts; equal and non-null means related. Private entries matter: `a.herokuapp.com` and `b.herokuapp.com` are different tenants, and with private entries off they share `herokuapp.com`. When either side has no registrable domain (IP literal, `localhost`), fall back to "deployment host equals project host minus its first label, or equals the project host". Probed against the installed `tldts@7.4.9`: `myproject.mysite.co.uk`/`api.mysite.co.uk` → `mysite.co.uk` both; `myproject.localhost` → `myproject.localhost`, `localhost` → `null` (fallback applies); `myproject.form.test`/`api.form.test` → `form.test` both.
*Alternatives:* comparing the last two labels — rejected, it treats every `*.co.uk` host as related; a vendored suffix list — rejected, it rots. `tldts` is already in the lockfile (via `jsdom`), has no runtime dependencies beyond `tldts-core`, and is maintained.

**6. The new verdict is `unrelated-deployment`, a deployment-half verdict.**
It reuses the existing deployment-half path: writers refuse it (`cli/project-command.ts` and `project_set` gain one message), and the resolver sets the recorded value aside with a note and leaves the deployment unresolved — identical to `api-root-deployment`, which is the same mistake with a specific host. Forced pairs skip all verdicts as today; `forced` can only come from a mapping entry written by `project set --force`, never from a committed file or a tool.

**7. Trust-on-first-use for committed files: deferred.**
With decisions 4–6, a committed file can direct requests only to a project whose deployment shares its registrable domain, and receives the API key only on `FORMIO_PROJECT_URL`'s origin. What remains is a committed file naming a deployment the user has never signed in to, which leads to a portal-login page the user sees in their own browser, at a URL they can read, before any credential is entered. A first-use confirmation needs a persisted per-repository trust store and an elicitation fallback for clients without it; that is not small, so it is listed as a follow-up rather than folded in.

## Risks / Trade-offs

- [A setup relies on `FORMIO_API_KEY` with only a directory mapping or a committed file naming the project] → It now gets the portal login; `project_get` names the cause and the fix (set `FORMIO_PROJECT_URL`). Called out in the changelog and the three READMEs.
- [A legitimate on-prem deployment serves sub-domain projects from a different registrable domain] → Refused by writers and set aside at read with a note naming the rule; a developer records it with `project set --force`, which already exists for the analogous `*.form.io` internal-deployment case.
- [A future tool joins an argument into a path without the shared schema] → The `formioFetch` invariant still holds the request inside the project; a test enumerating registered tools asserts every string argument that reaches a path uses one of the two schemas.
- [`tldts` suffix data ages] → Its releases track the public suffix list, so routine dependency updates refresh it. A stale list errs toward treating a new suffix as a registrable domain, which refuses pairs rather than accepting them.

## Migration Plan

Ships in the 1.0.0 release with a changeset describing the API key binding as a behaviour change. No data migration: existing mappings and committed files are read under the new verdict at the next call; only a path-less customer project paired with an unrelated deployment changes outcome, and it does so with a note. Rollback is reverting the change; no on-disk format changes.

## Open Questions

- Should the `project_get` reason for an unapplied key be a structured field (e.g. `apiKey: { applied: false, reason }`) or part of the existing notes? Decide alongside the 1.0 error/report contract; the spec requires only that the report states it.
