## ADDED Requirements

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
