# @formio/mcp

## 0.11.0

### Minor Changes

- de6a7a8: Make the Project URL the single piece of configuration, resolve it by scope, and let the server own the guidance for it.

  Configuring a project used to mean answering two questions in several places. The Project URL and the Base URL were collected together at install time and again per directory; the base URL silently defaulted to `https://api.form.io` whether or not that could be right; the environment outranked the per-directory mapping for one URL and lost to it for the other; and the guidance for choosing either value was duplicated across five skill documents that could each drift. This release reduces all of it to one value, one order, and one owner.

  ## One value to supply

  **The Project URL is the only value a user is asked for.** The Base URL is derived from it wherever it can be:
  - a project on a `form.io` host derives `https://api.form.io`;
  - a project addressed as a sub-directory derives its **parent path** — `https://forms.mysite.com/one/two` derives `https://forms.mysite.com/one`, not the bare origin, because a deployment may itself be mounted at a sub-path;
  - a path-less project URL on a customer domain derives nothing, because its deployment is a sibling sub-domain that nothing in the project URL names.

  Guidance that said a base URL never carries a path is corrected: a sub-path-mounted deployment is legitimate, and the server must not publish a rule its own derivation breaks.

  **BREAKING (runtime behavior, narrowly): the base URL is never defaulted.** In the third shape above it stays unresolved, and the first call that authenticates with a JWT fails naming `project set --base-url`, the `formio.json` `baseUrl` key, and the project it applies to. Previously that setup silently attempted a portal login against `https://api.form.io` and keyed its token cache there — a setup that could not authenticate anyway, so this converts a late, opaque auth failure into an early, actionable one. Resolution itself still succeeds with the value absent, and API-key deployments never read it, so they are unaffected. Nothing else changes: the hosted cloud and sub-directory routing both derive as before, with the reported source now `derived` rather than `default`. **`sources.baseUrl` and `project get`'s `Source:` line change strings for that case.**

  **`FORMIO_DEFAULT_PROJECT_URL` is removed.** It existed only because `FORMIO_PROJECT_URL` used to pin the server, so an install-time prompt wired to it would defeat every later mapping. With the environment now the weakest source (below), `FORMIO_PROJECT_URL` already suggests without pinning — exactly what the offering variable was invented to guarantee. It never took part in resolution, so nothing resolves differently; it simply no longer appears in the resolution error, `project get`, the server instructions, or the registry environment list. **Migration:** remove it wherever it is set. Where an install-time answer is the only route — the `.mcpb` desktop bundle — set `FORMIO_PROJECT_URL` instead; the bundle now does exactly that.

  ## One resolution order, by scope

  **BREAKING: resolution is ordered narrowest scope first, and identically for both URLs** — a committed `formio.json`, then the per-directory mapping in `~/.formio/projects.json`, then the environment. Previously the project URL resolved environment-first while the base URL already resolved mapping-first, so one pair resolved in two directions.

  `FORMIO_PROJECT_URL` is therefore **no longer a pin**: a committed file or a mapping overrides it, and `project_set` can redirect a directory whose environment names a different project. A launch that relied on the old precedence changes target if — and only if — its checkout carries a `formio.json` or its working directory has a mapping. The migration is to remove whichever source contradicts the intended target; a deployment that must resolve one project deterministically should supply only the source it wants used.

  **A committed `formio.json` is the new versionable source.** It holds `projectUrl` and optionally `baseUrl`, and is found by walking up from the working directory, taking the first file and never ascending past a directory containing `.git`. The nearest file wins, so a monorepo can point two application folders at two projects. Unlike the machine-local map, it travels with the code: it survives a clone and is visible in review. Write it with `project set --scope repo` or the `project_set` tool's `scope: "repo"`, which records it in the application's own folder rather than an ancestor — a file placed higher governs every unrelated project beneath it. `formio-angular` now writes one into the workspace it configures, so a clone resolves the project its `config.ts` was generated for.

  Relatedly, an unreadable `~/.formio/projects.json` is no longer skipped for a launch that sets `FORMIO_PROJECT_URL`. Skipping it was safe only while the map ranked below the environment; now that it ranks above, reading past a file that cannot be parsed could resolve a value the unreadable entry would have overridden. It is still tolerated when a committed file supplies both URLs, because nothing is left for the map to decide.

  ## The server owns the guidance; the skills relay it

  **Configuration errors are self-sufficient and staged.** Each names the exact remedy command in both vocabularies — the MCP tool and the runnable shell command — so an agent that never read the server's instructions can still act. They arrive one at a time: no project URL resolves → an error asking for the Project URL alone, describing what one is with an example per deployment kind; a project URL resolves but its base URL cannot be determined → a separate error naming that project URL and asking for the deployment alone. Fixing the first surfaces the second instead of presenting a compound failure.

  **`project set --project-url` is optional once a directory has a project mapped**, which is what makes the base-URL remedy runnable: `project set --base-url <url>` no longer fails for a project URL the directory already has. Either flag alone is a valid partial update; with nothing mapped, `--project-url` is still required.

  **`project get` is the single read surface.** It prints both URLs, names the winning source for each — including a committed file by absolute path — reports any source it shadowed, and exits `0` / `1` / `2` so a caller can tell "nothing recorded here" from "this command could not answer". Every skill that calls Form.io tools now runs it before its first deployment-touching call and relays whatever it says, branching on exit `1` (interview) versus exit `2` (do not interview — an unreadable map, a broken `formio.json`, a malformed URL, all of which a `project set` would fail on for the same unreported reason). `formio-mcp-setup` probes first and interviews only on failure. `formio-resource-planner` is the one exemption: it calls no MCP tool, and its Phase B emission now reads as the menu it prints rather than as calls it makes, naming who owns the gate for each option.

  **Skills stop carrying URL wording.** Deleted from the library and left to the server: the three-valid-shapes enumeration, the plain-language descriptions and example values, the validation rules, the Base-URL derivation table, and the per-skill exit-code tables. `formio-application/DEPLOYMENT.md` is deleted outright — once the wording moves, what remains is four lines that belong in the preflight every skill now carries. With resolution in the preflight there is no Deployment step left to order, so **`formio-application` drops to four steps: Intent → Plan → Import → Framework.** (Breaking for the spec and its assertions, not for users.)

  **No client prompts for anything at install time.** The Claude Code and Cursor manifests launch the server with `command` and `args` alone — no `userConfig`, no `variables`, no `env`. An install-time answer is the wrong scope for both values: a Form.io project is one-to-one with the application built against it, so an answer typed once is right for one directory and wrong for the next, and a global base URL silently satisfied every project including ones on another deployment. The `.mcpb` desktop bundle keeps its prompts deliberately — a desktop host has no working directory to map and no repository to commit into — and its project prompt sets `FORMIO_PROJECT_URL`, which now suggests without pinning.

  ## One name per job, enforced

  Three uses were conflated under a single spelling. Each now has one:

  | Use                                           | Spelling                                                                            |
  | --------------------------------------------- | ----------------------------------------------------------------------------------- |
  | A substitution slot in an endpoint or example | `{projectUrl}` / `{baseUrl}` — single braces                                        |
  | A value passed between phases or skills       | prose, or a `projectUrl` / `baseUrl` field                                          |
  | The environment variable                      | `FORMIO_PROJECT_URL` / `FORMIO_BASE_URL`, only where the subject is the environment |

  Spelling a slot or a handoff value with an `FORMIO_*` name told an agent to read an environment variable in order to build a URL — a different and wrong action, and one that finds nothing, because no shipped manifest sets an environment at all. 234 endpoint roots across the `formio-api` references were renamed, plus 24 slots (`{{FORMIO_PROJECT_URL}}`, `$FORMIO_PROJECT_URL`, `<FORMIO_BASE_URL>`, `YOUR_FORMIO_BASE_URL`, `{FORMIO_PROJECT_URL}`) and 24 handoff values across 18 skill documents. Single braces keep a slot distinct from Postman's `{{baseUrl}}`, which stays disallowed outside code spans.

  **The rule is now checked rather than described.** `api-skills-validation` had specified a `validateLibrary` suite that no longer existed, so its rules — this one included — were prose nothing ran. The validator is rebuilt in `@formio/skill-tests` and fails the run on a regression, covering the terminology rule, resolved Postman placeholders, the required reference layout, the canonical portal-login auth paragraph, legacy-auth tokens, PDF proxy scope, example-value suffixes, and the `formio-sdk` import rules. `@formio/core` is not banned outright there: the SDK skill documents a named set of helpers `@formio/js` does not re-export, and importing those is the fallback it teaches, so only a default, namespace, or unsanctioned named import fails.

  ## Two smaller behavior changes

  **A global `FORMIO_BASE_URL` no longer overwrites a derivable one.** `project_set` and `formio-mcp project set` fall back to the environment's base URL only for a project URL that derives no deployment of its own. Previously, setting a project on `https://forms.mysite.com/myproject` with `FORMIO_BASE_URL=https://api.form.io` exported wrote that global into the mapping, where it outranked derivation for that directory permanently and pointed the portal login at a deployment the user does not use. Directories already mapped that way keep what is recorded; pass `--base-url` to change one deliberately. `smithery.yaml` stopped defaulting the same value into every install for the same reason.

  **`project get` reports more.** Shadowed base URLs are reported alongside shadowed project URLs, from separately tracked candidate lists — the two halves resolve independently, so one shared list credited a shadowed deployment to whichever layer supplied the project. And a note about an ignored unusable `FORMIO_BASE_URL` now travels with the unresolved-base-URL failure it caused instead of being dropped.

### Patch Changes

- 15b86db: Fix three ways project configuration answered about a project or deployment that does not govern the directory.

  **A `*.form.io` `FORMIO_BASE_URL` is refused for a project whose deployment is underivable.** A path-less project URL on a customer domain (`https://myproject.mysite.com`) names no deployment — that is a sibling sub-domain — so the environment global is all there is, and it was taken unchecked. `https://api.form.io` is the value most likely to be stale in a shell, and taken there it became the portal-login URL and the token-cache key for a deployment the user does not use. It is now ignored with a note, leaving the base URL unresolved so the first call that needs it fails asking for that one value. A global on another customer host is still kept for this shape, because a differing host is exactly what a sibling sub-domain looks like.

  **A committed `formio.json` now outranks the mapping in both writers, as it already did at resolve time.** `project_set` and `project set` computed "what this directory resolves to" as mapping-then-committed, the reverse of resolution. With both on record they reported the mapped project as active while every later tool call resolved the committed one, and asked the base-URL derivation questions against the wrong URL. The write still lands — it is the fallback if the committed file goes away — and both writers now name the committed file as the record that governs until it changes.

  **`project get`'s documented exit codes include `3`.** Both READMEs enumerated `0` / `1` / `2` and omitted `EXIT_BASE_URL_UNRESOLVED`, so a reader or agent branching on them treated the half-configured directory as an unknown code. They also prescribed `project set --project-url <url> --base-url <url>`, teaching the habit the derivation design exists to remove; the base URL is now shown as the flag to add only when the server says it cannot be determined. A test asserts every `EXIT_*` constant appears in both footnotes.

  Also: the unresolved-base-URL error for a revisions write spelled its substitution slot `${baseUrl}`, the form the library's own terminology rule treats as an environment read. It is now `{baseUrl}`.

## 0.10.0

### Minor Changes

- 94896a6: Resolve the medium-and-above skill-scanner findings across the library.

  Every documented launch of the MCP server is pinned — `npx -y @formio/mcp@<version>` in the three client manifests, the install docs, and every skill that prints the command — so an install runs the server the release was tested against instead of whatever the registry serves at that moment. `pnpm sync:pins` stamps the pin from `packages/mcp-server/package.json` inside `changeset:version`, so the Version Packages PR already carries the version about to publish, and `pnpm changeset:follow` adds the plugin bump that a server-only release needs to carry the new pin to npm. Three suites fail when either goes stale.

  The server's own browser-login page stops loading an unpinnable vendor bundle. It fetched `https://cdn.form.io/js/5.2.2/formio.full.min.js`, a host that serves whatever it decides to serve for that path with no integrity check available; the page now loads `@formio/js@5.5.1`, Bootstrap 5.3.8, and Bootstrap Icons 1.13.1 from jsDelivr with an `integrity` hash on every tag, and the renderer bundle narrowed to `formio.form.min.js` — the UMD global `Formio.createForm` needs and nothing more. This changeset releases `@formio/mcp` for that fix, which also republishes the plugin carrying the new pin.

  `formio-angular` no longer fetches unpinned `package.json` files from a CDN to decide what it installs: version resolution goes through `npm view` against the registry the install itself uses. Installing the Angular team's skill library is now an offer with the exact command shown, and declining it falls back to the pinned Angular CLI rather than dead-ending.

  The release tooling that enforces all of the above is itself checked. `pnpm sync:pins` recognises every runner spelling that resolves the registry at launch time (`npx`, `npm exec`, `pnpm dlx`, with or without a yes flag, plus global installs) so none ships floating, and its manifest pattern is anchored to the args array that launches the server — an unanchored quoted package name also matched `"dependencies"` entries, quoted `pnpm --filter` arguments, and the registry's `"identifier"`, and stamping a version into any of those corrupted the file and then failed the plugin build until the corruption was committed. `pnpm check:releases` skips the `changeset-release/*` branch, the one PR that consumes every changeset while rewriting the versions and pins it guards. And the login page's SRI digests are now derived rather than typed: `pnpm sync:sri` fetches each pinned asset and writes the digest of what the CDN served, with `login-asset-integrity.test.ts` verifying it whenever the network is reachable — a stale digest passed every shape assertion and then blocked the renderer, hanging the login flow on a blank page.

  `formio-angular` keeps a bounded offline path for a host that cannot reach the npm registry: an `@formio/angular` manifest already in `node_modules`, otherwise asking the user for the version and Angular major, with the source named in the approval summary either way. Never a CDN, and never a guessed major.

  `formio-actions` drops the save action's `transform` setting (a JavaScript string the server executes) and documents the build-time/runtime split explicitly: the skill writes project configuration and stops, the actions it configures run later inside the Form.io server, and the toolset exposes no submission-read tool — so nothing a submitter types is ever input to the skill. Its guidance is now framed as what the configuration decides about runtime handling, which is the only thing a build-time skill controls. `formio-form` gets the same framing for the code it writes around a rendered form, and states that the JS-string forms of field logic — the `javascript` trigger, the `value` action, `customAction` — are the user's to write, never the agent's to generate.

  The same build-time/runtime split resolves a contradiction that ran through the whole library. Every skill's preflight said "do not write code that [makes direct HTTP requests against a deployment]", which forbade the applications `formio-angular` and `formio-form` exist to build; the ban is now scoped to build-time work, with the app's runtime API calls named as expected and legitimate. `formio-api`'s five runtime-scope references — submissions, auth, reports, access control, custom users — no longer say "use the HTTP endpoint directly" with no actor named: they state that the caller is the finished application, using the end user's own token, and that reading end users' submissions is no part of configuring a project.

## 0.9.0

### Minor Changes

- a494543: Use the Form.io toolset from any coding agent, not just Claude Code.

  **Install it two ways, and they are alternatives rather than steps.**
  1. **A plugin install** wherever the agent has a marketplace — Claude Code, Cursor, GitHub Copilot CLI, VS Code, Codex. One step, carrying the skills _and_ the MCP server. The plugin directory ships three manifests over one `skills/` tree and one `mcp.json`: `plugin.json` ([Agent Plugins 1.0.0](https://agent-plugins.org/)), `.cursor-plugin/plugin.json`, and `.claude-plugin/plugin.json`. Each client detects its own and ignores the rest.
  2. **`npx skills add formio/ai`** for everything else — 75+ agents, installing once into `.agents/skills/` with Claude Code symlinked to the same files. That installer handles skills only, so a new **`formio-mcp-setup`** skill connects the server on first use: every skill carries a preflight that checks for its tools, hands off to setup when they are missing, and is forbidden from working around the gap with raw HTTP against a Form.io deployment.

  **One server behaviour everywhere.** Project resolution follows a single documented order — `FORMIO_PROJECT_URL` from the environment, then the working-directory mapping in `~/.formio/projects.json`, then an actionable error naming `project_set`. `project_set` is registered for every client, `cwd` is one schema everywhere, and `FORMIO_BASE_URL` always defaults.

  **One exit-code contract for the `project` command.** `project get` exits `0` when it resolved, `1` when nothing is mapped for that directory, and `2` when the command ran and could not answer — so a skill can tell "nothing here yet" from "this failed", and stops interviewing on the latter. No launch carries a version range: `@formio/mcp` is a 0.x line, so a floor hard-coded into a shipped manifest or skill goes stale at the next release and a ceiling would freeze installed plugins on an old server. The one silent case — a pre-0.9.0 binary ignoring the `project` arguments and exiting 0 with no output — is handled by rule: empty output is never an answer, and no skill may report a mapping it did not read.

  **Configure a project before any client connects.** The `formio-mcp` bin gains a `project` command: `project set --project-url <url> --base-url <url> --cwd <path>` writes the mapping through the same module the `project_set` tool uses, and `project get --cwd <path>` prints what resolves and which source supplied it. Invoked with no arguments the bin starts the stdio server exactly as before. `formio-mcp-setup` uses this to capture the project during setup, so the first tool call after a reload works instead of failing.

  **The server explains itself.** It declares MCP `instructions` at initialize describing what it needs — the Project URL, and the Base URL, which builds the portal-login URL and keys the cached token and therefore must not be assumed. Used stand-alone with no skills installed, that plus the resolution error is now the whole of what an agent needs; previously neither mentioned the base URL, so a self-hosted user could silently log in against the wrong deployment.

  **A configured default is offered, not applied.** `FORMIO_DEFAULT_PROJECT_URL` is surfaced as a suggestion in the instructions and the resolution error, for the agent to confirm and persist with `project_set`. It takes no part in resolution. `FORMIO_PROJECT_URL` remains the opposite: it pins the server, and `project_set` cannot redirect it.

  **BREAKING — `FORMIO_PLUGIN_CONTEXT` is removed.** It gated per-directory project routing, `project_set` registration, and a required `FORMIO_BASE_URL`, so all of that was unavailable outside the Claude Code plugin. Plugin behaviour is unchanged, and a pinned stand-alone launch stays pinned even with a stale mapping.

  **BREAKING — the plugin ships no hooks.** The `verify-project-url` gate matched a Claude-namespaced tool prefix and expanded `${user_config.*}`, so it only ever fired in Claude Code with a plugin install and was inert everywhere else, including every skills-only install. It could also deny tool calls the server resolves fine. Its behaviour is carried identically for every client by the server's instructions, the resolution error, `formio-mcp-setup`, and the orchestrator's Deployment step.

  **BREAKING — no client prompts for a project URL at install time.** The Cursor prompt fed its answer into `FORMIO_PROJECT_URL`, which takes precedence over every per-directory mapping, so filling it in locked the server to one project and silently defeated `project_set` — contradicting the prompt's own description. Both that prompt and Claude Code's are now gone: a deployment is shared across a developer's projects, but a Form.io project is one-to-one with the application built against it, so the one folder an install-time answer is collected in is the only folder it is right for. Install asks for `FORMIO_BASE_URL` alone; the agent captures the Project URL in the directory it belongs to and persists both with `project_set`. The `.mcpb` desktop bundle keeps its optional project prompt — a desktop host has no working directory to interview in — but that answer now reaches the server as `FORMIO_DEFAULT_PROJECT_URL` instead of `FORMIO_PROJECT_URL`, so it is offered for confirmation rather than pinned, and any `project_set` mapping overrides it. `FORMIO_DEFAULT_PROJECT_URL` (a suggestion) and `FORMIO_PROJECT_URL` (a pin) are still read from the environment for scripted and containerized launches.

  **BREAKING (install path, not API)** — manifests reachable from a git clone launch the server with `npx -y @formio/mcp` rather than the bundled `${CLAUDE_PLUGIN_ROOT}/server/stdio.mjs`, because a clone contains no build output. Release ordering is what closes the window this opens: until `@formio/mcp` 0.9.0 publishes, `latest` is 0.8.4, which registers `project_set` only under the now-removed `FORMIO_PLUGIN_CONTEXT` — so publish the server with or before the marketplace change rather than pinning a floor into manifests that would outlive it. The plugin tarball ships no server bundle; the build still writes `dist/plugin/server/stdio.mjs` for the smoke test, and the `.mcpb` desktop bundle builds its own copy. `.claude-plugin/marketplace.json` declares `"source": "./plugin"`, which is also what makes the skills CLI discover the library.

  **The skills read correctly in every client.** Instructions name the client's structured question mechanism rather than one client's tool, and the batching rule — everything a step needs in one round, never a sequence of prompts — is stated portably. Tool availability is a capability probe rather than a tool-name prefix match. `frontend-design` keeps its name, because it is a portable Agent Skill; what went is the assumption about how it is registered and the client-specific commands for installing it.

  **No restart boundary.** The orchestrator no longer writes `.mcp.json` and no longer halts for a reload. It writes no MCP configuration at all — a missing server routes to `formio-mcp-setup` — and its Deployment step resolves an existing mapping before asking, so a project is captured once and never re-requested.

  **Browser login fails fast where there is no browser.** CI, containers, and SSH sessions with no display are detected before a port is bound, with guidance to set `FORMIO_API_KEY`; `FORMIO_FORCE_BROWSER=1` overrides the check. Previously such hosts waited out the full 15-minute timeout.

  Other changes: the nested Angular sub-skill moved to `formio-angular-resources/` so its directory matches its name, and its description was trimmed to fit the specification's 1,024-character budget — both were Agent Skills violations that only surfaced in clients discovering skills by recursive scan. The published bundle carries only what a consumer needs: eval harnesses moved to `packages/skill-tests/evals/`, and a test enforces the boundary by allowlist. CI validates every `SKILL.md` against the Agent Skills specification.

### Patch Changes

- cbb5d57: Declare a privacy policy, as the Anthropic Software Directory requires.

  Local connectors must carry all three of a `"Privacy Policy"` section in the README, a `privacy_policies` array in the manifest, and HTTPS policy URLs — a missing or incomplete policy is an immediate rejection. The bundle had none of them.

  The manifest now declares `https://form.io/privacy`, and the server README — the file packed into the bundle — gains a section covering what the policy cannot describe: that requests go only to the configured deployment, that the two files under `~/.formio/` are written `0600` and hold a JWT and a per-directory project map, that form data is never written to disk, that there is no telemetry, and that the browser sign-in page loads assets from `cdn.form.io`, `cdn.jsdelivr.net` and `fonts.googleapis.com`, so those hosts see the browser's IP while it is open.

  Also corrects a footnote that still claimed the server "refuses to start" without `FORMIO_PROJECT_URL`, which stopped being true in 0.8.0.

## 0.8.4

### Patch Changes

- 4d99bb9: Build the container image without emulation.

  No change to the server itself. The published `formio/mcp` image is now built with one architecture per native runner instead of building `linux/arm64` under QEMU, where `npm install` died with SIGILL on two of three releases and left Docker Hub a version behind. Build time dropped from 128s to about 45s per architecture in parallel.

  One consequence for image consumers: the per-architecture builds no longer attach a provenance attestation, because with `push-by-digest` an attestation makes the pushed digest an image index rather than a single-platform manifest, which is not what the manifest join combines. Tags published from 0.8.4 list `amd64` and `arm64` only, where earlier tags also carried two attestation manifests.

- dbebf61: Add the Smithery backlink to the server README.

  Smithery's validation step scans the README, homepage, or a custom URL for a link back to the listing and reported finding none, which costs listing score. The badge now sits in `packages/mcp-server/README.md`, which is the file packed into the `.mcpb` as its README — so the link travels with the bundle rather than depending on the scanner reaching GitHub.

## 0.8.3

### Patch Changes

- 90119b4: Stop declaring the project URL as required configuration.

  The server starts with an empty environment, serves its full tool list, and answers `hello` without any configuration; the tools that read or write Form.io data raise an actionable error when called without a project. Declaring `FORMIO_PROJECT_URL` required told hosts to block installation on a value the server runs fine without, which made it harder to try than it actually is. The field description now says plainly that a useful install sets it.

## 0.8.2

### Patch Changes

- 3426aa0: Give Smithery a bundle whose tool definitions it accepts.

  Declaring tools in the `.mcpb` manifest made the Smithery publish fail with a 400 — `expected object, received undefined`, once per tool. Its CLI copies `manifest.tools` verbatim into the serverCard it uploads and validates against the MCP `Tool` type, so entries need an `inputSchema`. The MCPB schema permits only `name` and `description` per tool and rejects an `inputSchema` outright, so no single manifest satisfies both.

  The build now emits two archives wrapping identical server bytes: `formio-mcp.mcpb`, packed and validated by `mcpb pack` and attached to the GitHub release, and `formio-mcp.smithery.mcpb`, carrying the full definitions (input and output schemas plus annotations) for Smithery. If the MCPB schema ever admits full tool definitions the two collapse back into one.

## 0.8.1

### Patch Changes

- c74ccfd: Declare the server's tools in the `.mcpb` manifest.

  Directories that ingest the bundle read `manifest.tools` rather than launching the server: Smithery's listing reported no tools at all, because the manifest left discovery to runtime (`tools_generated: true`, no `tools` key). The list is now generated during the build by running the freshly bundled server and calling `tools/list`, so it stays accurate without being maintained by hand — a tool added in code appears on the next build. The build fails if the server lists nothing, rather than shipping a manifest that quietly claims no tools.

## 0.8.0

### Minor Changes

- 439c866: Start without configuration, and describe every tool fully.

  The server no longer exits when `FORMIO_PROJECT_URL` is unset. It starts, serves `tools/list`, and raises the (already clearer) missing-project error only when a tool actually needs the value. Previously any client that connected before being configured — including automated crawlers — saw a dead process and concluded the server exposed no tools at all.

  Every tool now declares an `outputSchema` and MCP annotations (`title`, `readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`), so a caller can type-check responses and tell a read from an overwrite before invoking anything.

  Breaking change to the list tools' payloads: `form_list`, `role_list`, `action_list`, `action_types_list`, and `form_revisions_list` now return a named object (`{ forms: [...], count: n }`) instead of a bare array, because structured content must be an object.

## 0.7.0

### Minor Changes

- d8dfe36: Make `cwd` optional when not running as the Claude Code plugin. The per-directory project map is only consulted in plugin context, so standalone and container callers were being asked for a value that could not affect the result — and were pointed at `project_set`, which is not registered outside the plugin. `cwd` stays required in plugin context, where the mapping is authoritative.

## 0.6.0

### Minor Changes

- c5f8408: Make browser login usable in headless environments instead of hanging. The login URL is now always written to stderr and included in the timeout error, a failed browser launch is reported rather than swallowed, `FORMIO_AUTH_HOST` and `FORMIO_AUTH_PORT` allow binding somewhere a host browser can reach, and `FORMIO_AUTH_TIMEOUT` (default 900s) fails with an actionable message instead of waiting forever. Also reports the real package version to clients — it had been hardcoded to `0.1.0`.

## 0.5.1

### Patch Changes

- f0ff32d: Register the server in the official MCP Registry as `io.form/formio-mcp`. Adds the `mcpName` field that the registry uses to verify npm ownership, a root `server.json` describing the stdio transport and supported environment variables, and a release-workflow step that publishes to the registry after npm.

## 0.5.0

### Minor Changes

- a9012a6: Adding `formio-form`, `formio-form-builder` skills and general cleanup.

## 0.4.1

### Patch Changes

- ae993dc: Fixed issues with baseURL not getting set correctly.
- 4237e6c: Check cached JWT expiry locally before use. The MCP server now decodes a cached
  token's `exp` claim and clears expired tokens — both from the on-disk cache and
  the in-process cache — before attempting any request, triggering re-auth instead
  of thrashing on failing calls with a known-dead token.

## 0.4.0

### Minor Changes

- f75be94: Added authenticated route guards to the angular skill.

## 0.3.0

### Minor Changes

- 736278e: Added better authentication indication in login page. Improved formio-angular for correct Auth module use. Encourage the use of frontend-design skill when building applications.

## 0.2.0

### Minor Changes

- d98a326: Added form revision support.
