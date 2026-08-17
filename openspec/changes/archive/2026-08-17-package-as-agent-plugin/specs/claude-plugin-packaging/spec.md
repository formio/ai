## MODIFIED Requirements

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

The plugin SHALL provide a `plugin/.claude-plugin/plugin.json` manifest that declares a single MCP server named `formio-mcp` launched by `npx -y @formio/mcp`. The spec SHALL carry no version range: `@formio/mcp` is a 0.x line where every minor may break, so a hard-coded floor in a shipped manifest goes stale on the next release and a ceiling would freeze installed plugins on an old server. Release ordering closes the only window that a floor would cover — publishing `@formio/mcp` before or with the marketplace change — and a client that resolves a server too old to serve `project_set` surfaces it as missing tools, which every skill's preflight already routes to `formio-mcp-setup`.

The bundled `server/stdio.mjs` remains built for the smoke test, which spawns it and sends `tools/list`, but it SHALL NOT be published in the `@formio/ai` tarball (`files` omits `server/`) and SHALL NOT be the command in a manifest reachable by a git clone, where the file does not exist. The `.mcpb` desktop bundle builds its own copy at `dist/mcpb/server/index.mjs`. `FORMIO_BASE_URL` SHALL continue to be supplied from `${user_config.formio_base_url}`, which is Claude Code's install-time prompt and has no equivalent in the vendor-neutral manifest.

#### Scenario: Plugin manifest is loaded

- **WHEN** Claude Code installs the `formio-ai` plugin
- **THEN** it reads `plugin.json`, registers the `formio-mcp` MCP server, and launches it over stdio via `npx -y @formio/mcp`

#### Scenario: No manifest points at a file a clone lacks

- **WHEN** every manifest under `plugin/` is scanned for `${CLAUDE_PLUGIN_ROOT}` or `${PLUGIN_ROOT}` paths used as an MCP `command`
- **THEN** none is found

#### Scenario: User config still supplies the base URL

- **WHEN** `plugin/.claude-plugin/plugin.json` is parsed
- **THEN** its `formio-mcp` env maps `FORMIO_BASE_URL` to `${user_config.formio_base_url}`
- **AND** `userConfig` declares that field

## ADDED Requirements

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
