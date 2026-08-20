## Purpose

Defines how this repository packages and advertises the Form.io toolset as a plugin for Claude Code — the marketplace manifest, the plugin manifest and its MCP server declaration, the published npm tree, and the bundled skills library.
## Requirements
### Requirement: Marketplace manifest advertises the plugin

The repository SHALL publish a plugin marketplace manifest at `.claude-plugin/marketplace.json` that lists the `formio-ai` plugin with a repository-relative `source` of `./plugin`, rather than the npm package `@formio/ai`.

Three consequences make the path form the better source. Claude Code clones the marketplace repository, so `./plugin` resolves there and an install no longer waits on an npm publish. The `skills` CLI reads skill paths declared in a plugin marketplace manifest, so declaring the path is what makes `npx skills add formio/ai` discover the Form.io skills instead of the repository's internal tooling. And GitHub Copilot CLI reads a marketplace from `.claude-plugin/marketplace.json` as well as `.github/plugin/marketplace.json`, so one file serves both.

Because a cloned repository contains no build output, the manifests reachable from this path SHALL launch the MCP server from npm rather than from a bundled file — see the MCP server declaration requirement below.

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

The plugin SHALL provide a `plugin/.claude-plugin/plugin.json` manifest that declares a single MCP server named `formio-mcp` launched by `npx -y @formio/mcp@<MAJOR.MINOR.PATCH>`, pinned to the exact `version` in `packages/mcp-server/package.json`. The launch SHALL NOT be unpinned and SHALL NOT carry a range, a caret, or a dist-tag. An unpinned `npx` resolves whatever the registry serves at the moment a client starts the server, so the code that gains tool access to the user's Form.io deployment is chosen at run time rather than reviewed once — the "runtime URL that controls the agent" pattern skill scanners rate Medium — and it leaves a plugin release describing a server nobody can name. A range is no better: `@formio/mcp` is a 0.x line where every minor may break, so a floor goes stale at the next release while a ceiling would freeze installed plugins on an old server, and a scanner reads either as resolving whatever the registry serves.

The pin SHALL be stamped rather than hand-typed. `pnpm sync:pins` reads the server's `package.json` and rewrites every launch it owns — the three client manifests, the MCP Registry entry, the install docs, and every skill that prints the command — and runs during `changeset:version`, so the Version Packages PR carries the restamped pins and a release cannot ship a manifest launching one server version while the skills describe another. The pin SHALL therefore be written in a form the stamper can restamp.

The cost of an exact pin is one window, which the spec accepts rather than closes by unpinning: `.claude-plugin/marketplace.json` installs from `./plugin`, so between the pin landing on main and npm accepting the publish, a fresh install names a version npm does not have yet and `npx` fails with `E404`. That window is one Release run, every step of which is idempotent, so a failed run is re-run; when it stays broken, publishing the server is the fix. `formio-mcp-setup` documents the `E404` for anyone who installs inside the window, and a client that does resolve a server too old to serve `project_set` surfaces it as missing tools, which every skill's preflight already routes to `formio-mcp-setup`.

The bundled `server/stdio.mjs` remains built for the smoke test, which spawns it and sends `tools/list`, but it SHALL NOT be published in the `@formio/ai` tarball (`files` omits `server/`) and SHALL NOT be the command in a manifest reachable by a git clone, where the file does not exist. The `.mcpb` desktop bundle builds its own copy at `dist/mcpb/server/index.mjs`.

The manifest SHALL declare no `userConfig` and SHALL pass no `env` block to the server. It launches with `command` and `args` alone. An install-time `FORMIO_BASE_URL` prompt is one global value answering a per-project question: the base URL is derived from the project URL wherever it can be, and the environment is the weakest resolution source — so it cannot override a committed `formio.json` or a working-directory mapping. Its only effect was on directories with nothing recorded, where per-project derivation is the better answer, and on a self-hosted install it silently satisfied the base URL for every project including ones on another deployment.

Removing it blocks nothing. A project whose base URL cannot be derived resolves with the base URL absent, and the first call that authenticates with a JWT fails with a message naming `project set --base-url`, the `formio.json` `baseUrl` key, and the project it applies to — the same message a skill's preflight `project get` surfaces before any tool call.

The `.mcpb` desktop bundle is the exception and SHALL keep its prompts, because a desktop host has no working directory to map and no repository to commit into, so an install-time value is its only practical route. Its project prompt SHALL set `FORMIO_PROJECT_URL` rather than an offering variable: the environment is the weakest source, so a value set there is overridden by a committed `formio.json` or a later `project_set`, which is exactly the "suggest without pinning" guarantee a separate offering variable used to provide. The bundle SHALL NOT reference `FORMIO_DEFAULT_PROJECT_URL`, which no longer exists.

#### Scenario: Plugin manifest is loaded

- **WHEN** Claude Code installs the `formio-ai` plugin
- **THEN** it reads `plugin.json`, registers the `formio-mcp` MCP server, and launches it over stdio via `npx -y @formio/mcp@<MAJOR.MINOR.PATCH>` at the version in `packages/mcp-server/package.json`

#### Scenario: Unpinned or ranged launch fails review

- **WHEN** any manifest under `plugin/` declares an MCP server whose args contain the bare string `@formio/mcp`, a range or caret, or a dist-tag such as `latest`
- **THEN** the change fails review and the launch is restamped by `pnpm sync:pins`

#### Scenario: Every source manifest agrees with the published server version

- **WHEN** `plugin/.claude-plugin/plugin.json`, `plugin/.cursor-plugin/plugin.json`, and `plugin/mcp.json` are parsed
- **THEN** every `formio-mcp` launch names `@formio/mcp@<version>` for the `version` in `packages/mcp-server/package.json`
- **AND** `pnpm sync:pins --check` reports agreement and leaves every file it could rewrite byte-identical

#### Scenario: No manifest points at a file a clone lacks

- **WHEN** every manifest under `plugin/` is scanned for `${CLAUDE_PLUGIN_ROOT}` or `${PLUGIN_ROOT}` paths used as an MCP `command`
- **THEN** none is found

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

The `plugin/package.json` SHALL set `name` to `@formio/ai`, `publishConfig.access` to `public`, and `publishConfig.directory` to `../dist/plugin` so that `npm publish` uploads the built plugin tree rather than the source tree.

#### Scenario: Publishing uploads the built tree

- **WHEN** `pnpm release:plugin` runs from `plugin/`
- **THEN** npm publishes the contents of `dist/plugin/` (bundled server, manifest, skills) under the `@formio/ai` package name with public access

### Requirement: Plugin bundles the skills library

The plugin source tree SHALL include, and the build SHALL copy to `dist/plugin/skills/`, the full `formio-api` router skill, every `formio-api-<group>` capability-group skill, and the `formio-schema`, `formio-resource-planner`, `formio-form`, and `formio-form-builder` skills. (`formio-form` is the `@formio/js` embed skill; `formio-form-builder` is the build-a-form orchestrator introduced by the `formio-form-builder-skill` capability.) The plugin build test's skill-inclusion assertions (`packages/mcp-server/src/__tests__/plugin-build.test.ts`) SHALL assert `formio-form-builder` is present in the bundled `skills/` directory.

#### Scenario: Installed plugin exposes all skills

- **WHEN** a user installs `@formio/ai` in a Claude Code project
- **THEN** Claude Code discovers every `formio-api`, `formio-schema`, `formio-resource-planner`, `formio-form`, and `formio-form-builder` skill from the plugin's `skills/` directory

#### Scenario: Bundled formio-form-builder is the orchestrator skill

- **WHEN** the bundled `skills/formio-form-builder/SKILL.md` is inspected
- **THEN** its frontmatter `name` is `formio-form-builder` and its description claims single-form creation triggers

#### Scenario: Build test asserts inclusion, not a stale exclusion

- **WHEN** the plugin build test suite runs against a built `dist/plugin/`
- **THEN** it asserts `formio-form-builder` is present in `dist/plugin/skills/`
- **AND** no assertion excludes `formio-form-builder` from the bundle

### Requirement: Build script produces a self-contained plugin tree

A `scripts/build-plugin.ts` script SHALL clean `dist/plugin/`, copy the `plugin/` source tree into it, sync the plugin manifest `version` field from `plugin/package.json`, and bundle `packages/mcp-server/src/stdio.ts` into `dist/plugin/server/stdio.mjs` as an executable ESM Node.js bundle targeting Node 20 with a CommonJS-compatibility banner that provides `require`, `__filename`, and `__dirname`.

#### Scenario: Build produces the expected layout

- **WHEN** `pnpm build:plugin` runs
- **THEN** `dist/plugin/.claude-plugin/plugin.json`, `dist/plugin/package.json`, `dist/plugin/skills/`, and an executable `dist/plugin/server/stdio.mjs` all exist, and the manifest `version` matches `plugin/package.json`

#### Scenario: Bundled server resolves CommonJS dependencies

- **WHEN** `dist/plugin/server/stdio.mjs` is executed with `node`
- **THEN** CommonJS dependencies bundled into the ESM output (e.g. `express`) resolve successfully via the banner-provided `require`, and the MCP server starts on stdio

### Requirement: Smoke test validates the built plugin over stdio

A `scripts/test-plugin.ts` script SHALL validate that `dist/plugin/` exists, that `plugin.json` contains required fields (`name`, `version`, `description`, at least one `mcpServers` entry), that required skill directories (at minimum `formio-api` and `formio-schema`) are present, and that spawning the bundled server and sending a JSON-RPC `tools/list` request returns a well-formed response.

#### Scenario: Smoke test fails when build is missing

- **WHEN** the smoke test runs without `dist/plugin/` present
- **THEN** it exits non-zero with a message instructing the user to run `pnpm build:plugin`

#### Scenario: Smoke test verifies live MCP server

- **WHEN** the smoke test spawns `dist/plugin/server/stdio.mjs` and sends a `tools/list` JSON-RPC request
- **THEN** the server responds with a `result.tools` array and the test exits zero

#### Scenario: Smoke test asserts on the consolidated schema skill

- **WHEN** the smoke test inspects the bundled `skills/` directory
- **THEN** it SHALL assert `formio-schema` is present

### Requirement: Plugin ships a README documenting environment variables

The plugin source tree SHALL include `plugin/README.md` — copied by the build into `dist/plugin/README.md` and therefore published with `@formio/ai` — that documents every environment variable the bundled MCP server reads, marking each as required or optional and stating its default. At minimum the README SHALL list `FORMIO_PROJECT_URL` (optional, no default, and the weakest of the three project sources), `FORMIO_API_KEY` (optional, default `undefined`), and `FORMIO_LOGIN_FORM` (optional, default `{projectUrl}/user/login` — the resolved project URL, not the environment variable), and SHALL describe the API-key vs. JWT authentication modes selected by presence/absence of `FORMIO_API_KEY`.

#### Scenario: README is published with the plugin

- **WHEN** `pnpm build:plugin` runs
- **THEN** `dist/plugin/README.md` exists and documents `FORMIO_PROJECT_URL`, `FORMIO_API_KEY`, and `FORMIO_LOGIN_FORM` with their required/optional status and defaults

#### Scenario: README stays in sync with server-config env vars

- **WHEN** the plugin-build test runs
- **THEN** it verifies `plugin/README.md` references every environment variable declared in the `server-config` capability (`FORMIO_PROJECT_URL`, `FORMIO_API_KEY`, `FORMIO_LOGIN_FORM`) and fails if any are missing

### Requirement: Example prompts demonstrate the skills library

The repository SHALL ship an `examples/` directory containing a `README.md` (how to run a prompt against the symlinked skills and the local MCP server) and per-entry-point subfolders of copy-paste prompt files. Each prompt file SHALL open with the target skill's slash tag (e.g. `/formio-application`) and document what the run should exercise.

#### Scenario: Application prompts are present

- **WHEN** a contributor opens `examples/apps/`
- **THEN** it contains at least one prompt file whose prompt begins with `/formio-application` and names an output folder under `examples/`

### Requirement: Plugin build is covered by Vitest

Vitest suites under `packages/mcp-server/src/__tests__/` SHALL include `plugin-build.test.ts` asserting the `dist/plugin/` layout produced by `buildPlugin()`. It MUST run as part of `pnpm test`.

#### Scenario: Plugin build regressions are caught by CI

- **WHEN** `pnpm test` runs
- **THEN** `plugin-build.test.ts` executes and fails if the plugin build output drifts from the manifest

### Requirement: Build output carries every manifest, version-stamped

`scripts/build-plugin.ts` SHALL copy all manifests into `dist/plugin/` and sync the `version` field of each from `plugin/package.json`: `.claude-plugin/plugin.json`, `plugin.json`, and `.cursor-plugin/plugin.json`. A manifest whose version drifts from the package is a release defect, because clients display it and marketplaces key updates on it.

#### Scenario: Versions are synced across manifests

- **WHEN** `pnpm build:plugin` runs
- **THEN** the `version` in each of `dist/plugin/.claude-plugin/plugin.json`, `dist/plugin/plugin.json`, and `dist/plugin/.cursor-plugin/plugin.json` equals the `version` in `plugin/package.json`

#### Scenario: The build verifies committed manifests instead of rewriting them

- **WHEN** `pnpm build:plugin` runs
- **THEN** the committed `plugin/{.claude-plugin,.cursor-plugin,}plugin.json` are byte-identical afterwards
- **AND** the build exits non-zero naming `pnpm sync:versions` when any committed manifest's `version` disagrees with `plugin/package.json`
- **AND** `pnpm sync:versions` (run by `changeset:version`) remains the only writer, with `pnpm sync:versions --check` performing the same verification without writing — a build runs during `prepublishOnly`, so a build that stamped versions would mutate tracked source outside any `changeset:version` run

#### Scenario: A missing manifest fails the build loudly

- **WHEN** one of the three manifests is absent from `plugin/` and `pnpm build:plugin` runs
- **THEN** the build exits non-zero with an error naming the missing manifest path
- **AND** it does NOT publish a bundle that silently omits a client's manifest
- **AND** this is enforced by `assertManifestsPresent` in `scripts/build-plugin.ts`, observed through the build step every suite depends on, rather than by a test that removes a manifest from the shared source tree — which raced with the suites that read it

### Requirement: Smoke test validates every layout

`scripts/test-plugin.ts` SHALL validate each manifest that ships: required fields present, the Agent Plugins manifests valid against their declared `$schema` version, the Cursor manifest's `variables` matching its `${VAR}` placeholders, and the MCP command from `mcp.json` answering a `tools/list` request. A layout that ships unvalidated is a layout that breaks silently in a client nobody on the team runs.

#### Scenario: Smoke test covers all three manifests

- **WHEN** `pnpm test:plugin` runs against a fresh build
- **THEN** it validates `.claude-plugin/plugin.json`, `plugin.json`, `mcp.json`, and `.cursor-plugin/plugin.json`
- **AND** exits non-zero if any is missing or malformed

#### Scenario: The server is exercised over stdio

- **WHEN** `pnpm test:plugin` runs
- **THEN** it spawns the locally built `server/stdio.mjs` and asserts a well-formed `tools/list` response
- **AND** it does not spawn `npx` against the public registry, which would exercise the last published version rather than this tree

### Requirement: Shipped npm metadata describes a multi-client bundle

`plugin/package.json` is the metadata consumers see on npm, so it SHALL describe what the bundle actually is. Its `description` SHALL NOT present the package as a Claude Code plugin, and its `keywords` SHALL NOT name only Claude Code — the bundle carries manifests for multiple clients and a skills library any Agent Skills client can read.

Its `files[]` SHALL list only directories that exist in the built tree and are meant to ship. `hooks` SHALL NOT appear, because the directory is deleted.

#### Scenario: Description is not Claude-specific

- **WHEN** `plugin/package.json` is read
- **THEN** its `description` does not describe the package as a Claude Code plugin
- **AND** it names the MCP server and the skills library

#### Scenario: Keywords cover the clients the bundle targets

- **WHEN** `plugin/package.json` `keywords` is read
- **THEN** it is not limited to Claude Code terms
- **AND** it includes terms covering agent skills and the MCP server

#### Scenario: files[] carries no deleted directory

- **WHEN** `plugin/package.json` `files[]` is read
- **THEN** `hooks` is absent
- **AND** every remaining entry exists in the built plugin tree

#### Scenario: The built tree ships no hooks

- **WHEN** `dist/plugin/` is assembled by the build script
- **THEN** it contains no `hooks/` directory
- **AND** no manifest inside it declares a `hooks` component

