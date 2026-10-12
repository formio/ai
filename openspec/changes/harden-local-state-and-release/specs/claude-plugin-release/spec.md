## ADDED Requirements

### Requirement: A release uses only tools recorded in the repository

The release workflow SHALL reference every action by full commit SHA (with the tag as a comment), SHALL install `npm`, `@smithery/cli`, and `mcp-publisher` at versions written in the workflow, and SHALL verify the downloaded `mcp-publisher` archive against a SHA-256 checksum written in the workflow before running it. No step SHALL install a tool by `latest` or by a floating range.

#### Scenario: No floating tool versions

- **WHEN** the release workflow is read
- **THEN** no step names `@latest`, `/latest/`, or an action reference that is not a 40-character SHA

#### Scenario: A publisher download that does not match

- **WHEN** the downloaded `mcp-publisher` archive's checksum differs from the recorded one
- **THEN** the step fails before running it

### Requirement: The Docker image installs dependencies from the lockfile

The `@formio/mcp` Docker image SHALL install its dependencies from the repository's `pnpm-lock.yaml` with a frozen lockfile, so the image contains the dependency versions the repository tested.

#### Scenario: The image matches the lockfile

- **WHEN** the image is built
- **THEN** its installed dependency versions equal those in `pnpm-lock.yaml` for `@formio/mcp`
