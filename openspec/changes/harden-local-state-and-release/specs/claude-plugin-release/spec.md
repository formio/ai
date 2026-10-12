## ADDED Requirements

### Requirement: The Docker image installs dependencies from the lockfile

The `@formio/mcp` Docker image SHALL install its dependencies from the repository's `pnpm-lock.yaml` with a frozen lockfile, so the image contains the dependency versions the repository tested.

#### Scenario: The image matches the lockfile

- **WHEN** the image is built
- **THEN** its installed dependency versions equal those in `pnpm-lock.yaml` for `@formio/mcp`
