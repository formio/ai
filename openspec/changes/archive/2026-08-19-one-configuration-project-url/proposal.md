## Why

Two rounds of resolution work left the configuration surface describing a world that no longer exists.

**`FORMIO_DEFAULT_PROJECT_URL` is vestigial.** Its own spec states the reason it exists: `FORMIO_PROJECT_URL` "pins the server and cannot be redirected", so wiring an install-time prompt to it would "silently defeat `project_set`". The offering variable was the workaround for that. The scope reorder made the environment the WEAKEST source — a committed `formio.json` or a working-directory mapping both override it — so `FORMIO_PROJECT_URL` no longer pins, `project_set` can redirect it, and the problem the offering variable solved is gone. What remains is a second way to say the same thing, and a suggestion an agent might mistake for an answer instead of asking.

**One name is doing three unrelated jobs.** `FORMIO_PROJECT_URL` appears 223 times under `plugin/skills`, and the uses are not the same thing: 171 are substitution slots in endpoint headings (`### GET ${FORMIO_PROJECT_URL}/form`), ~35 name a value passed between phases ("stash them under the variable names…"), and only ~15 are about the environment variable. The first two borrow an environment-variable spelling for something that is not one, which tells an agent to go read an environment variable when the instruction is "use the project URL you resolved". That conflation is not hypothetical — it is what made `FORMIO_DEFAULT_PROJECT_URL` read as part of the base-URL defaulting story earlier in this work, when it is a project suggestion and unrelated.

**The Base URL is over-documented for what it now is.** It is derived from the project URL in every shape but one: `https://api.form.io` for a `form.io` host, the project URL's parent for sub-directory routing. Only a path-less non-`form.io` project URL — sub-domain routing — cannot be derived, and that is rare across the customer base. The library still presents the two URLs as co-equal configuration, which asks readers and agents to reason about a value they will almost never supply.

The result should be one configuration to think about — the **Project URL** — with the Base URL derived, and asked for only when it genuinely cannot be.

## What Changes

### Code

- **Remove `FORMIO_DEFAULT_PROJECT_URL` entirely** — from `getConfig`, the `FormioConfig.defaultProjectUrl` field, the resolution error's suggestion clause, `project get`'s offer, the server `instructions`, and the `server.json` registry environment list. Nothing offers a project any more: the agent runs `project get` and asks when it resolves nothing.
- **The `.mcpb` desktop bundle prompts `FORMIO_PROJECT_URL` directly.** That is now safe and is exactly the guarantee the offering variable was invented to provide: the environment is the weakest source, so a later `project_set` or a committed file overrides it. A desktop host has no working directory to map and no repository to commit into, so an install-time value is its only practical route to a project.
- **Collapse the base-URL model to "derived, or asked".** A `form.io`-hosted project reports its base URL as `derived` rather than `default`. The value is unchanged — `https://api.form.io` — but "default" reads as a guess, and after the shape work there is no guess left: every base URL is either derived from the project URL or absent and asked for.
- **Split the guidance by where it is actionable.** The unset-project error asks for the Project URL and stops reciting all three URL shapes; the base-URL error keeps the sub-domain explanation, because that is the only message where it changes what the reader does.
- **`project_set`'s description stops saying "pass baseUrl unless the project is on the Form.io hosted cloud."** It now says to pass it only when the server reports it cannot be determined.

### Docs and skills

- Rewrite the configuration guidance so the Project URL is *the* configuration and the Base URL is a derived value with one rare exception — across the shared preflight clause, `formio-angular/SETUP.md`'s two-value table, the `appUrl`/`apiUrl` alias notes, `formio-mcp-setup`, and the README environment tables.
- **Separate the three uses of the URL names by spelling, so one rule covers every document:**
  - A **substitution slot** in an endpoint heading or example becomes `{projectUrl}` / `{baseUrl}` — single braces, no `FORMIO_` prefix, no `${…}`. Single rather than double braces keeps it visually distinct from a Postman placeholder, which stays disallowed.
  - A **value passed between phases or skills** is named in prose ("the Project URL") or as a payload field `projectUrl` / `baseUrl`. No variable name for something that is not a variable.
  - The **environment variable** keeps `FORMIO_PROJECT_URL` / `FORMIO_BASE_URL` verbatim, and appears ONLY where the subject is the environment — an `env` block, an environment table, the resolution order's weakest source.
- **The endpoint roots are renamed, not removed.** An earlier draft of this proposal ruled them out of scope on the grounds that they document where an endpoint lives — which is true, and is why they survive as roots. They are in scope for a different reason: the token spelling misleads. `{projectUrl}/form` says exactly what `${FORMIO_PROJECT_URL}/form` was trying to say, without instructing an environment read.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `server-config`: the environment list loses `FORMIO_DEFAULT_PROJECT_URL`; the `project_set` description requirement stops telling callers to pass a base URL by deployment kind; the stand-alone guidance presents the Project URL as the single configuration.
- `project-map-routing`: the reported base-URL sources lose `default` in favour of `derived`; the unset-project error requirement no longer carries the full three-shapes recital.
- `claude-plugin-packaging`: the `.mcpb` desktop bundle's project prompt is re-pointed from the offering variable to `FORMIO_PROJECT_URL`, which is now overridable by both stronger sources.
- `api-skills-authoring`: the Terminology requirement gains the three-uses rule and switches endpoint roots from `${FORMIO_*}` to `{projectUrl}` / `{baseUrl}`; the scope-to-root mapping follows.
- `api-skills-validation`: the placeholder-resolution and terminology rules resolve to the new slots, and validation additionally rejects an `FORMIO_*` name used as a slot or as the name of a value passed between phases.

### Removed Capabilities

- `default-project-offer`: removed in full. Its entire purpose was to keep an install-time project answer from defeating `project_set`, which the scope reorder made impossible by making the environment the weakest source.

## Impact

- `packages/mcp-server/src/config.ts`, `project-resolver.ts`, `cli/project-command.ts`, `server.ts`, `tools/project_set.ts`
- `scripts/build-mcpb.ts` — the bundle's user-config field and env mapping
- `server.json` — the registry environment list
- `packages/mcp-server/src/__tests__/` — `default-project-offer.test.ts` (deleted), plus `config`, `project-command`, `mcpb-build`, `plugin-build`, `plugin-manifests`
- `packages/skill-tests/src/shipped-surface/project-url-variables.test.ts`
- The ~14 skill documents carrying base-URL configuration guidance
- The 8 `formio-api` reference files carrying endpoint roots — 171 project-URL slots and 68 base-URL slots renamed, none removed
- `packages/skill-tests/` — the api-skills validator, which enforces the old spelling
- `README.md`, `plugin/README.md`, `packages/mcp-server/README.md`
- `openspec/specs/default-project-offer/` — deleted
