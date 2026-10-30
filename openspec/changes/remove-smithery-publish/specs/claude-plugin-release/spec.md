## MODIFIED Requirements

### Requirement: Review-gated submissions are never automated

Some distribution channels require human review by a third party — the Cursor marketplace, the Codex/ChatGPT plugin directory, `github/awesome-copilot`, the GitHub MCP Registry, the Docker MCP catalog, the Cursor MCP directory, and the Cline marketplace. Submissions to those channels SHALL NOT be automated in the release workflow, and the workflow SHALL NOT fail when one is pending or unsubmitted.

The channels that CAN be automated — npm, the official MCP Registry, Docker Hub, the GitHub release — SHALL continue to be driven by the workflow on every release. The workflow SHALL NOT publish to Smithery, which stopped accepting updates when it shut down its connection services on October 31, 2026.

The repository SHALL NOT be required to record submission status in any file. Where maintainers track that status is their choice and is outside the scope of any specification here.

#### Scenario: A release publishes every automated channel

- **WHEN** a release publishes a new version
- **THEN** npm, the MCP Registry, Docker Hub, and the GitHub release are updated by the workflow

#### Scenario: The release publishes nothing to Smithery

- **WHEN** the release workflow and the bundle build are inspected
- **THEN** no step publishes to Smithery or reads a Smithery credential
- **AND** the bundle build produces `dist/formio-mcp.mcpb` and no Smithery variant

#### Scenario: A pending submission does not fail the release

- **WHEN** the Cursor marketplace listing is still in review
- **THEN** `pnpm release` succeeds and publishes every automated channel
- **AND** the workflow makes no attempt to submit to the review-gated channel

#### Scenario: No file is mandated for submission status

- **WHEN** the repository is inspected
- **THEN** no requirement obliges any file to record per-channel submission status
