## MODIFIED Requirements

### Requirement: Marketplace manifest advertises the plugin

The repository SHALL publish a plugin marketplace manifest at `.claude-plugin/marketplace.json` that lists the `formio-ai` plugin with a repository-relative `source` of `./plugin`, rather than the npm package `@formio/ai`.

Three consequences make the path form the better source. Claude Code clones the marketplace repository, so `./plugin` resolves there and an install no longer waits on an npm publish. The `skills` CLI reads skill paths declared in a plugin marketplace manifest, so declaring the path is what makes `npx skills add formio/ai` discover the Form.io skills instead of the repository's internal tooling. And GitHub Copilot CLI reads a marketplace from `.claude-plugin/marketplace.json` as well as `.github/plugin/marketplace.json`, so one file serves both.

Because a cloned repository contains only committed files, a manifest reachable from this path SHALL launch the MCP server either from npm or from a file committed under `plugin/` — never from build output the clone lacks. The Claude Code manifest launches the committed `plugin/server/` (see the `plugin-vendored-server` capability); every other manifest launches from npm — see the MCP server declaration requirement below.

#### Scenario: Marketplace manifest is valid

- **WHEN** a Claude Code user adds the Form.io marketplace from this repository
- **THEN** Claude Code reads `.claude-plugin/marketplace.json` and discovers a plugin named `formio-ai` whose source is the repository path `./plugin`

#### Scenario: Skills CLI discovers the library through the manifest

- **WHEN** `npx skills add formio/ai --list` runs with no other flag
- **THEN** the Form.io library is listed, with `formio-angular-resources` shipping inside the `formio-angular` directory that shadows it

#### Scenario: Copilot CLI can add the same marketplace

- **WHEN** `.claude-plugin/marketplace.json` is inspected
- **THEN** it is a valid plugin marketplace manifest for GitHub Copilot CLI as well as Claude Code

### Requirement: Plugin manifest declares stdio MCP server

The plugin SHALL provide a `plugin/.claude-plugin/plugin.json` manifest that declares a single MCP server named `formio-mcp` launched as `node` with the single argument `${CLAUDE_PLUGIN_ROOT}/server/stdio.js` — the server compiled from this commit and committed under `plugin/server/`, whose dependencies Claude Code installs from `plugin/package.json` and `plugin/package-lock.json` when it installs, updates, or first caches the plugin. The launch SHALL NOT go through a shell or a package-manager script.

A pinned `npx` launch fixes the package but not its dependencies, which resolve at install time: a fresh `npx -y @formio/mcp@1.0.0` installed 29 of its 98 packages at versions no test had run against. Running the committed server against a lockfile generated from `pnpm-lock.yaml` makes the code and the dependency tree a user runs the ones this repository tested and a reviewer can read, and it is the form the Anthropic plugin directory asks a launcher to take.

The cost is a network that cannot reach `https://registry.npmjs.org/` directly: Claude Code's dependency install does not read `.npmrc`, so on a network that routes npm through a private mirror the plugin's server cannot install and does not start. The manual `npx` connection `formio-mcp-setup` documents reads `.npmrc` and stays the route there.

Every other launch this repository ships — `plugin/.cursor-plugin/plugin.json`, `plugin/mcp.json`, the MCP Registry entry, the install docs, and every skill that prints the command — SHALL keep `npx -y @formio/mcp@<MAJOR.MINOR.PATCH>`, pinned to the exact `version` in `packages/mcp-server/package.json`, because those clients perform no dependency install from the plugin folder. Such a launch SHALL NOT be unpinned and SHALL NOT carry a range, a caret, or a dist-tag. An unpinned `npx` resolves whatever the registry serves at the moment a client starts the server, so the code that gains tool access to the user's Form.io deployment is chosen at run time rather than reviewed once, and a range is no better: a floor goes stale at the next release while a ceiling would freeze installed plugins on an old server.

The pin SHALL be stamped rather than hand-typed. `pnpm sync:pins` reads the server's `package.json` and rewrites every launch it owns and runs during `changeset:version`, so the Version Packages PR carries the restamped pins and a release cannot ship a manifest launching one server version while the skills describe another. The pin SHALL therefore be written in a form the stamper can restamp.

The cost of an exact `npx` pin is one window, which the spec accepts rather than closes by unpinning: between the pin landing on main and npm accepting the publish, a fresh `npx` install names a version npm does not have yet and fails with `E404`. That window is one Release run, every step of which is idempotent, so a failed run is re-run. `formio-mcp-setup` documents the `E404` for anyone who installs inside the window. The Claude Code manifest has no such window, because the server it launches is in the commit.

The `.mcpb` desktop bundle builds its own bundled copy at `dist/mcpb/server/index.mjs`.

The manifest SHALL declare no `userConfig` and SHALL pass no `env` block to the server. It launches with `command` and `args` alone. An install-time `FORMIO_BASE_URL` prompt is one global value answering a per-project question: the base URL is derived from the project URL wherever it can be, and the environment is the weakest resolution source — so it cannot override a committed `formio.json` or a working-directory mapping. Its only effect was on directories with nothing recorded, where per-project derivation is the better answer, and on a self-hosted install it silently satisfied the base URL for every project including ones on another deployment.

Removing it blocks nothing. A project whose base URL cannot be derived resolves with the base URL absent, and the first call that authenticates with a JWT fails with a message naming `project set --base-url`, the `formio.json` `baseUrl` key, and the project it applies to — the same message a skill's preflight `project get` surfaces before any tool call.

The `.mcpb` desktop bundle is the exception and SHALL keep its prompts, because a desktop host has no working directory to map and no repository to commit into, so an install-time value is its only practical route. Its project prompt SHALL set `FORMIO_PROJECT_URL` rather than an offering variable: the environment is the weakest source, so a value set there is overridden by a committed `formio.json` or a later `project_set`, which is exactly the "suggest without pinning" guarantee a separate offering variable used to provide. The bundle SHALL NOT reference `FORMIO_DEFAULT_PROJECT_URL`, which no longer exists.

#### Scenario: Plugin manifest is loaded

- **WHEN** Claude Code installs the `formio-ai` plugin
- **THEN** it installs the dependencies `plugin/package-lock.json` pins, reads `plugin.json`, registers the `formio-mcp` MCP server, and launches it over stdio as `node ${CLAUDE_PLUGIN_ROOT}/server/stdio.js`

#### Scenario: The Claude Code launch runs a committed file

- **WHEN** `plugin/.claude-plugin/plugin.json` is parsed
- **THEN** the `formio-mcp` entry's `command` is `node`
- **AND** its `args` are exactly `["${CLAUDE_PLUGIN_ROOT}/server/stdio.js"]`
- **AND** `plugin/server/stdio.js` exists in the committed tree

#### Scenario: Unpinned or ranged launch fails review

- **WHEN** any manifest under `plugin/` declares an MCP server whose args contain the bare string `@formio/mcp`, a range or caret, or a dist-tag such as `latest`
- **THEN** the change fails review and the launch is restamped by `pnpm sync:pins`

#### Scenario: Every npx launch agrees with the published server version

- **WHEN** `plugin/.cursor-plugin/plugin.json` and `plugin/mcp.json` are parsed
- **THEN** every `formio-mcp` launch names `@formio/mcp@<version>` for the `version` in `packages/mcp-server/package.json`
- **AND** `pnpm sync:pins --check` reports agreement and leaves every file it could rewrite byte-identical

#### Scenario: No manifest points at a file a clone lacks

- **WHEN** every manifest under `plugin/` is scanned for `${CLAUDE_PLUGIN_ROOT}` or `${PLUGIN_ROOT}` paths in an MCP `command` or `args`
- **THEN** each path names a file committed under `plugin/`

#### Scenario: The manifest prompts for nothing and passes no environment

- **WHEN** `plugin/.claude-plugin/plugin.json` is parsed
- **THEN** it declares no `userConfig`
- **AND** its `formio-mcp` entry has no `env` block
- **AND** its `formio-mcp` entry declares only `command` and `args`

#### Scenario: The desktop bundle prompts for a project without pinning one

- **WHEN** `scripts/build-mcpb.ts` is inspected
- **THEN** it declares a project user-config field mapped to `FORMIO_PROJECT_URL`
- **AND** it does not reference `FORMIO_DEFAULT_PROJECT_URL`
- **AND** it still declares a `formio_base_url` field, because a desktop host has no working directory to interview in

### Requirement: Plugin npm package publishes the built tree

The `plugin/package.json` SHALL set `name` to `@formio/ai`, `publishConfig.access` to `public`, and `publishConfig.directory` to `../dist/plugin` so that `npm publish` uploads the built plugin tree rather than the source tree. Its `files` SHALL include `server` and `package-lock.json`, so the published package carries the same vendored server and lockfile the Claude Code manifest depends on.

#### Scenario: Publishing uploads the built tree

- **WHEN** `pnpm release:plugin` runs from `plugin/`
- **THEN** npm publishes the contents of `dist/plugin/` (vendored server, lockfile, manifests, skills) under the `@formio/ai` package name with public access

### Requirement: Build script produces a self-contained plugin tree

A `scripts/build-plugin.ts` script SHALL clean `dist/plugin/`, copy the `plugin/` source tree into it — including the committed `server/`, `package.json`, and `package-lock.json` — and verify, without writing, that the plugin manifests' `version` fields agree with `plugin/package.json` and that `pnpm sync:plugin-server --check` reports no drift. It SHALL NOT bundle the server, because the plugin runs the committed `server/` modules against its installed dependencies.

#### Scenario: Build produces the expected layout

- **WHEN** `pnpm build:plugin` runs
- **THEN** `dist/plugin/.claude-plugin/plugin.json`, `dist/plugin/package.json`, `dist/plugin/package-lock.json`, `dist/plugin/skills/`, and `dist/plugin/server/stdio.js` all exist, and the manifest `version` matches `plugin/package.json`
- **AND** `dist/plugin/server/stdio.mjs` does not exist

#### Scenario: A stale vendored server fails the build

- **WHEN** `pnpm build:plugin` runs while `pnpm sync:plugin-server --check` reports drift
- **THEN** the build exits non-zero naming `pnpm sync:plugin-server`

### Requirement: Smoke test validates the built plugin over stdio

A `scripts/test-plugin.ts` script SHALL validate that `dist/plugin/` exists, that `plugin.json` contains required fields (`name`, `version`, `description`, at least one `mcpServers` entry), that required skill directories (at minimum `formio-api` and `formio-schema`) are present, and that installing the plugin's dependencies the way Claude Code does — `npm ci --ignore-scripts` from `package-lock.json`, in a copy of the built tree — and then spawning the Claude Code manifest's launch returns a well-formed response to a JSON-RPC `tools/list` request.

#### Scenario: Smoke test fails when build is missing

- **WHEN** the smoke test runs without `dist/plugin/` present
- **THEN** it exits non-zero with a message instructing the user to run `pnpm build:plugin`

#### Scenario: Smoke test verifies live MCP server

- **WHEN** the smoke test installs the plugin's locked dependencies, spawns `node <plugin>/server/stdio.js`, and sends a `tools/list` JSON-RPC request
- **THEN** the server responds with a `result.tools` array and the test exits zero

#### Scenario: Smoke test asserts on the consolidated schema skill

- **WHEN** the smoke test inspects the bundled `skills/` directory
- **THEN** it SHALL assert `formio-schema` is present

### Requirement: Smoke test validates every layout

`scripts/test-plugin.ts` SHALL validate each manifest that ships: required fields present, the Agent Plugins manifests valid against their declared `$schema` version, the Cursor manifest's `variables` matching its `${VAR}` placeholders, and the MCP server answering a `tools/list` request. A layout that ships unvalidated is a layout that breaks silently in a client nobody on the team runs.

#### Scenario: Smoke test covers all three manifests

- **WHEN** `pnpm test:plugin` runs against a fresh build
- **THEN** it validates `.claude-plugin/plugin.json`, `plugin.json`, `mcp.json`, and `.cursor-plugin/plugin.json`
- **AND** exits non-zero if any is missing or malformed

#### Scenario: The server is exercised over stdio

- **WHEN** `pnpm test:plugin` runs
- **THEN** it spawns the vendored `server/stdio.js` against dependencies installed from the plugin's lockfile and asserts a well-formed `tools/list` response
- **AND** it does not spawn `npx` against the public registry, which would exercise the last published version rather than this tree

## ADDED Requirements

### Requirement: The Claude Code manifest names the plugin icon

`plugin/.claude-plugin/plugin.json` SHALL set `icon` to `./assets/formio-logo.png`, a square PNG of 512 to 2048 pixels per side and under 2 MB, which the Anthropic plugin directory reads for its listing.

#### Scenario: The icon is a square PNG in range

- **WHEN** the file `icon` names is read
- **THEN** it exists under `plugin/`, is a PNG, its width equals its height, each is between 512 and 2048 pixels, and it is smaller than 2 MB
