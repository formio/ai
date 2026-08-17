## REMOVED Requirements

### Requirement: Marketplace submission state is recorded, not implied

**Reason**: The requirement mandated that submission state be tracked in `docs/multi-agent-portability.md`, and that file is deleted. Its useful half was never the location — it was the release-workflow behaviour: review-gated channels must not be automated, and a pending submission must not fail a release. That half is restated below without prescribing where humans keep status.

Tracking the state of third-party review queues is operational work whose natural home is wherever the maintainers actually work — an issue, a board, a private note. Mandating a file in a public repository turned a moving status table into a committed artifact that goes stale between releases, and made a release requirement out of documentation housekeeping.

**Migration**: The behavioural half is preserved verbatim as "Review-gated submissions are never automated" below. The submission tables themselves (the plugin channels P1–P8 and the MCP channels M1–M6, each with owner and status) are handed to the maintainers to place where they track operational work; nothing in the repository asserts their location any more.

## ADDED Requirements

### Requirement: Review-gated submissions are never automated

Some distribution channels require human review by a third party — the Cursor marketplace, the Codex/ChatGPT plugin directory, `github/awesome-copilot`, the GitHub MCP Registry, the Docker MCP catalog, the Cursor MCP directory, and the Cline marketplace. Submissions to those channels SHALL NOT be automated in the release workflow, and the workflow SHALL NOT fail when one is pending or unsubmitted.

The channels that CAN be automated — npm, the official MCP Registry, Smithery, Docker Hub, the GitHub release — SHALL continue to be driven by the workflow on every release.

The repository SHALL NOT be required to record submission status in any file. Where maintainers track that status is their choice and is outside the scope of any specification here.

#### Scenario: A release publishes every automated channel

- **WHEN** a release publishes a new version
- **THEN** npm, the MCP Registry, Smithery, Docker Hub, and the GitHub release are updated by the workflow

#### Scenario: A pending submission does not fail the release

- **WHEN** the Cursor marketplace listing is still in review
- **THEN** `pnpm release` succeeds and publishes every automated channel
- **AND** the workflow makes no attempt to submit to the review-gated channel

#### Scenario: No file is mandated for submission status

- **WHEN** the repository is inspected
- **THEN** no requirement obliges any file to record per-channel submission status
