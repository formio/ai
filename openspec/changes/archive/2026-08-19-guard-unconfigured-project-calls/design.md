## Context

Two layers can notice that a Form.io project is unconfigured: the skills, in prose, before they call anything; and the server, in `resolveProject`, on every call. Only the server layer is unbypassable — it sees stand-alone use with no skills installed, another skill invoked before `formio-application`, and a cold `.mcp.json` in a fresh clone. So the enforcement belongs there, and the skill prose exists to make the server's error land as guidance rather than as a dead end.

The server already enforces half of this. A missing project URL raises `missingProjectError`, which names `project_set`, the `cwd` that was searched, and the base-URL consequence; `project-map-routing` specs it, and every project-scoped tool inherits it. The unenforced half is the base URL: `chooseBaseUrl` (`project-resolver.ts:100`) ends with `{ baseUrl: DEFAULT_BASE_URL, baseUrlSource: 'default' }` for every project shape, so a mapping carrying only a project URL silently resolves to `https://api.form.io`.

That constant is right for exactly one of the three shapes the `server-config` spec enumerates. For a customer deployment it sends the portal login to Form.io's cloud and keys the token cache under `api.form.io`, while form and submission requests still go to the correct project host — so the user sees an auth failure whose cause is nowhere near where it surfaces. `resolveProject` already computes and returns `sources`, but `resolveProjectConfig` — what every tool handler calls — discards it, so no handler can warn today even if it wanted to.

## Goals / Non-Goals

**Goals:**

- No request reaches a deployment the user did not configure, from any entry point, with or without skills.
- A base URL that cannot be known is an early, actionable error, not a constant.
- A base URL that CAN be known unambiguously is derived rather than asked for, so the guard adds no interview where none is needed.
- Every skill's preflight covers project configuration, not just tool availability, and routes failures to the one skill that owns the interview.

**Non-Goals:**

- No new tool, no change to any tool's input or output schema, and no change to `project_set`'s parameters.
- No change to the project-URL precedence order (environment, then mapping, then error) or to the mapped-base-URL-outranks-environment rule.
- No proactive `project get` call added to skill flows. The server error is the trigger; polling costs a subprocess per skill invocation and buys nothing the error does not already say.
- No change to how the token cache is keyed, only to what base URL reaches it.
- No relaxation of the "never hand-edit `~/.formio/projects.json`" rule.

## Decisions

**Decide the base URL in `chooseBaseUrl`; enforce the requirement for one in the auth path.** These are two separate sites and conflating them was the first draft's mistake. Deciding belongs in `chooseBaseUrl`, which already owns "which base URL wins" and needs only the resolved project URL to judge the shape. But *throwing* there would fail every project-scoped tool, and `baseUrl` is not an input to any of them: `formio-client.ts` builds every request from `projectUrl`, while `baseUrl` appears only in `ensure-auth.ts` (cache key), `auth.ts` (login-form candidates), `token-validation.ts` (`${baseUrl}/current`), and the 401-retry branch. Worse, `runAuthFlow` returns before any of that when `FORMIO_API_KEY` is set — so a resolution-time throw would break an API-key deployment over a value it never reads. Resolution therefore returns the base URL as absent, and one `requireBaseUrl(config)` guard in the auth path raises the error at the moment something needs it.

**Make `ResolvedFormioConfig.baseUrl` optional.** The alternative was a sentinel string or a parallel boolean. Rejected: the type is the documentation here. `baseUrl?: string` makes "required only for authentication" checkable by the compiler, and every call site the change forces open is in the auth path — precisely where the requirement lives. The API-key short-circuit must be ordered ahead of the first `baseUrl` read (today `ensureAuthenticated` reads `jwtCache.get(config.baseUrl)` before consulting `apiKey`), or the guard fires for the one caller that should never see it.

**Derive by dropping the project URL's final path segment, not by taking its origin.** The project URL is the deployment's URL plus exactly one segment — the project name — so the deployment is the project URL's parent, which is the origin only when the path has a single segment. A deployment mounted at a sub-path (`https://forms.mysite.com/one` serving `https://forms.mysite.com/one/two`) is legitimate, and flattening it to the origin would point the portal login and `/current` at a host root that serves neither: the same wrong-host failure as the `api.form.io` default, reached by a different route. Single-segment paths still reduce to the origin, so the common cases (`/myproject`, `http://localhost:3000/authoring-abc123`) are unchanged.

**Refuse the sub-domain shape only.** The `server-config` spec already forbids deriving a base URL from a path-less project URL, and that is exactly this case — the deployment is a sibling host and nothing in the project URL names it. Deriving the sub-directory shape instead of asking is what makes refusing this one affordable: the most common self-hosted and local-dev setups resolve correctly with no user interaction, so the refusal is narrow rather than a wall.

**Correct the "a base URL never carries a path" rule rather than special-casing around it.** `server-config`'s three-shapes text and `DEPLOYMENT.md`'s validation both assert it, and the sub-path derivation contradicts both. Keeping the assertion and exempting derived values would mean the library publishes a validation rule that rejects a value its own resolver produces. The assertion is simply too strong: it holds for shapes 1 and 2 and not for shape 3. What survives intact is the pair of rules that actually prevent wrong hosts — a `*.form.io` host is never a base URL, and a base URL is never derived from a path-less project URL.

**Add `derived` to `BaseUrlSource` rather than reporting it as `mapping`.** The union exists because a reader cannot otherwise distinguish "the mapping supplied this" from "this happened to match". A derived value has a third provenance and `project get`'s `Source:` line is read by both `DEPLOYMENT.md`'s resolve step and `formio-mcp-setup`, whose branches turn on it — collapsing it into `mapping` would make those branches wrong (they would skip persisting a value nothing has persisted).

**The failure is scoped to JWT authentication, and says so.** An API-key deployment in the refused shape keeps working, which means the error must not claim the project is unusable — it blocks login, nothing else. `project get` reports on the same terms: it prints the configured project URL and names the base URL as unresolved, rather than exiting as though nothing were mapped.

**The new base-URL failure is NOT reported as "no project configured".** Reusing `missingProjectError` would send the agent to interview both URLs and call `project_set` from scratch, when the project URL is already correct and only `baseUrl` is missing. Worse, `project_set`'s own base-URL fallback would then re-persist whatever the environment holds. A distinct error naming `project_set`'s `baseUrl` argument and echoing the resolved project URL keeps the remedy narrow.

**Accept the breaking change rather than gate it behind a flag.** A JWT-authenticating directory in the refused shape cannot authenticate today: its login goes to `api.form.io` for a project that is not there. An opt-in flag would preserve a state that is already broken while adding a knob to document. The failure is loud, names its fix, and the fix is one `project_set` call. Scoping it to the auth path is what keeps the blast radius honest — the setups that are not broken are not touched.

**Skill prose binds the first deployment-touching call, not the first tool call.** Binding every first tool call would force `formio-api`, `formio-schema`, and `formio-sdk` — which answer most questions out of their reference documents — to resolve a project before saying anything. Binding writes specifically also puts the announcement where it earns its keep: `project_import` merges and overwrites by machine name, so naming the target project before that call is the difference between a caught mistake and an overwritten project.

## Risks / Trade-offs

**The new failure fires for a legitimate setup nobody anticipated** → The refused shape is narrow (path-less, non-`form.io` host, no base URL from either source, JWT auth) and every such setup is already unable to log in. Mitigation: the error names the exact remedy with the exact argument, `project get` reports on the same terms so a user can reproduce it outside a tool call, and API-key callers are exempt by construction rather than by a special case.

**Making `baseUrl` optional loosens a type other code relies on** → Any site that reads it without a guard becomes a compile error, which is the point, but a site that "handles" `undefined` by string-interpolating it would produce `undefined/current` instead of failing. Mitigation: route every auth-path read through `requireBaseUrl`, and cover `${baseUrl}/current` explicitly in the ensure-auth tests rather than only at the resolver level.

**Derivation is wrong for a deployment that serves projects at a path but hosts its API elsewhere** → Possible in principle (a reverse proxy splitting the API host from the project path). Accepted: an explicit `FORMIO_BASE_URL` in the mapping or the environment still outranks the derivation, and the alternative for this user today is `api.form.io`, which is wrong in every case rather than in an unusual one.

**Dropping one segment is wrong for a deployment that routes projects two segments deep** → The rule assumes the project URL is the deployment plus exactly one segment, which is what shape 3 states. A deployment addressing projects as `/tenants/acme/myproject` would derive `/tenants/acme` and be right; one addressing them as `/projects/myproject/v2` would not. Accepted: no such routing exists in the shapes the server documents, and the explicit `baseUrl` remains the escape hatch for any deployment that disagrees.

**`project get`'s new non-zero exit breaks a caller that treats exit 1 as "unmapped, run the interview"** → `DEPLOYMENT.md`'s exit-code table already distinguishes `1` (nothing mapped) from `2` (the command ran and failed), and the base-URL refusal is a ran-and-failed case. Mitigation: exit `2` for the refusal, not `1`, so the existing table routes it to "show stderr and stop" instead of to an interview that would not fix it.

**Eleven preflight sections drift apart as the clause is added** → The `preflight contract` describe block in `mcp-setup-skill.test.ts` already sweeps every skill body for the tool-availability clause; extending that sweep to the new clause makes drift a test failure rather than a review catch.

**The write-announcement line becomes noise in long flows** → It fires once per skill invocation, before the first write, and `formio-application` already prints an equivalent line at its Import gate. Accepted; the alternative is a silent first write against an unverified target.
