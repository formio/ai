## MODIFIED Requirements

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
