# @formio/mcp

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
