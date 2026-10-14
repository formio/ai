## MODIFIED Requirements

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
