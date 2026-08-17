## ADDED Requirements

### Requirement: Release publishes the multi-client plugin tree

The release workflow SHALL publish `dist/plugin/` — including `plugin.json`, `mcp.json`, and `.cursor-plugin/plugin.json` alongside the existing `.claude-plugin/` manifest and `skills/` tree — as the `@formio/ai` npm package. `plugin/package.json` `files` SHALL list every manifest so none is omitted from the tarball.

A manifest present in the repository but absent from the published package installs cleanly from git and breaks from npm, which is the failure mode this requirement exists to prevent.

#### Scenario: Published package contains every manifest

- **WHEN** `npm pack` runs against the built plugin directory
- **THEN** the tarball contains `plugin.json`, `mcp.json`, `.cursor-plugin/plugin.json`, `.claude-plugin/plugin.json`, and the `skills/` tree

#### Scenario: Files list covers the new manifests

- **WHEN** `plugin/package.json` `files` is inspected
- **THEN** it includes entries covering `plugin.json`, `mcp.json`, and `.cursor-plugin`

### Requirement: Marketplace submission state is recorded, not implied

The maintainers SHALL track, outside the public repository, the submission state of each external channel that requires human review — the Cursor marketplace, the Codex/ChatGPT plugin directory, `github/awesome-copilot`, the GitHub MCP Registry, the Docker MCP catalog, the Cursor MCP directory, and the Cline marketplace — with the owner and the current status. Submissions gated on third-party review SHALL NOT be automated in the release workflow, and the workflow SHALL NOT fail when they are pending.

#### Scenario: Checklist reflects reality after a release

- **WHEN** a release publishes a new version
- **THEN** the automated channels (npm, MCP Registry, Smithery, Docker Hub, GitHub release) are updated by the workflow
- **AND** the review-gated channels remain listed with their pending or listed status, unchanged by the workflow

#### Scenario: A pending submission does not fail the release

- **WHEN** the Cursor marketplace listing is still in review
- **THEN** `pnpm release` succeeds and publishes every automated channel
