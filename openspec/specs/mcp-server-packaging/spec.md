# mcp-server-packaging Specification

## Purpose
How the `@formio/mcp` server is packaged for distribution: the npm tarball, every bundled build reporting the package version, and the `server.json` registry manifest declaring the environment variables the server reads.
## Requirements
### Requirement: The published package is complete and current

The `@formio/mcp` tarball SHALL include the repository's MIT LICENSE text. Its `build` script SHALL remove `dist` before compiling, so no module from a previous build is packed.

#### Scenario: LICENSE in the tarball

- **WHEN** the package is packed
- **THEN** the tarball contains `LICENSE`

#### Scenario: A LICENSE change is released

- **WHEN** a branch changes the repository-root `LICENSE` and no pending changeset releases `@formio/mcp`
- **THEN** `pnpm check:releases` fails naming `@formio/mcp`

#### Scenario: No stale modules

- **WHEN** `dist` holds a module whose source was deleted and the package is built and packed
- **THEN** the tarball does not contain that module

### Requirement: Every build reports the package version

The server SHALL report the `@formio/mcp` package version at initialize and in `server_status` from every form it ships in: the npm package, the `.mcpb` bundle, and the plugin's vendored copy. The version SHALL come from a source module that `pnpm sync:pins` writes from `packages/mcp-server/package.json`, rather than from a run-time read of a `package.json` — which the `.mcpb` bundle does not contain and which, from `plugin/server/`, resolves to `@formio/ai`'s manifest — or from a bundler `define`. `pnpm sync:pins --check` SHALL fail when the module disagrees with the package version.

#### Scenario: The .mcpb bundle

- **WHEN** the `.mcpb` bundle's server is started and asked for `server_status`
- **THEN** it reports the package version, not `0.0.0`

#### Scenario: The plugin's vendored server

- **WHEN** `plugin/server/stdio.js` is started and answers `initialize`
- **THEN** the reported server version is the `version` in `packages/mcp-server/package.json`, not the `version` in `plugin/package.json`

#### Scenario: The stamped version drifts

- **WHEN** the version module disagrees with `packages/mcp-server/package.json`
- **THEN** `pnpm sync:pins --check` exits non-zero naming the module

### Requirement: server.json declares every environment variable the server reads

`server.json` SHALL list every environment variable the server reads, with a description, whether it is required, and whether it is secret — including `FORMIO_AUTH_HOST`, `FORMIO_AUTH_PORT`, and `FORMIO_AUTH_TIMEOUT`.

#### Scenario: The declared set matches the code

- **WHEN** the environment variables read in `packages/mcp-server/src` are compared with `server.json`
- **THEN** every one is declared

