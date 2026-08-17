## Purpose

Defines the release pipeline that publishes the plugin: the Changesets-driven workflow, the smoke test the publish is gated on, the concurrency rules that keep releases from overlapping, and prerelease gating.
## Requirements
### Requirement: Release workflow publishes plugin via Changesets

A GitHub Actions workflow at `.github/workflows/plugin.yml` SHALL run on pushes to `main` and on manual `workflow_dispatch`, use pnpm and Node.js 22, install dependencies with `--frozen-lockfile`, and invoke `changesets/action@v1` with `version: pnpm changeset:version` and `publish: pnpm release:plugin` using `GITHUB_TOKEN` and `PUBLIC_NPM_TOKEN` secrets.

#### Scenario: Push to main opens a Version Packages PR

- **WHEN** a commit with pending changesets is pushed to `main`
- **THEN** the workflow runs `pnpm changeset:version` and opens or updates a "Version Packages" pull request containing the version bumps

#### Scenario: Merging the Version Packages PR publishes to npm

- **WHEN** the "Version Packages" PR is merged to `main`
- **THEN** the workflow runs `pnpm release:plugin`, which publishes the already-built `dist/plugin/` tree as `@formio/ai` to the public npm registry using `PUBLIC_NPM_TOKEN`

### Requirement: Release workflow gates publish on a successful smoke test

The release workflow SHALL run `pnpm build:plugin` followed by `pnpm test:plugin` before invoking `changesets/action@v1`, so that a broken build or failing smoke test blocks the publish step and the `changesets/action@v1` `publish` command operates on the pre-built `dist/plugin/` tree.

#### Scenario: Failing smoke test blocks publish

- **WHEN** `pnpm test:plugin` exits non-zero in CI
- **THEN** the workflow fails before `changesets/action@v1` runs and `@formio/ai` is not published

#### Scenario: Publish reuses the pre-built tree

- **WHEN** the smoke test passes and `changesets/action@v1` invokes `pnpm release:plugin`
- **THEN** `release:plugin` publishes the existing `dist/plugin/` tree without rebuilding it

### Requirement: Workflow concurrency prevents overlapping releases

The release workflow SHALL declare a concurrency group keyed by workflow and ref with `cancel-in-progress: true` so that overlapping pushes to `main` do not produce competing release runs.

#### Scenario: Overlapping pushes cancel the earlier run

- **WHEN** two pushes to `main` occur in quick succession
- **THEN** the first workflow run is cancelled and only the latest run proceeds to the release step

### Requirement: Prerelease mode gates early versions

While `.changeset/pre.json` is present, Changesets SHALL operate in prerelease mode so that published `@formio/ai` versions carry a prerelease dist-tag instead of `latest`.

#### Scenario: Prerelease versions do not become the default install

- **WHEN** `@formio/ai` is published while prerelease mode is active
- **THEN** `npm install @formio/ai` without an explicit tag does not resolve to the prerelease version

### Requirement: Release job has permissions to open PRs and push tags

The `plugin-changeset` job SHALL declare `permissions: { contents: write, pull-requests: write }` so the Changesets action can push version-bump commits, create release tags, and open the Version Packages PR.

#### Scenario: Changesets action has sufficient permissions

- **WHEN** the workflow runs Changesets' versioning step
- **THEN** it successfully pushes the version-bump commit and opens or updates the Version Packages PR without permission errors

### Requirement: Release publishes the multi-client plugin tree

The release workflow SHALL publish `dist/plugin/` — including `plugin.json`, `mcp.json`, and `.cursor-plugin/plugin.json` alongside the existing `.claude-plugin/` manifest and `skills/` tree — as the `@formio/ai` npm package. `plugin/package.json` `files` SHALL list every manifest so none is omitted from the tarball.

A manifest present in the repository but absent from the published package installs cleanly from git and breaks from npm, which is the failure mode this requirement exists to prevent.

#### Scenario: Published package contains every manifest

- **WHEN** `npm pack` runs against the built plugin directory
- **THEN** the tarball contains `plugin.json`, `mcp.json`, `.cursor-plugin/plugin.json`, `.claude-plugin/plugin.json`, and the `skills/` tree

#### Scenario: Files list covers the new manifests

- **WHEN** `plugin/package.json` `files` is inspected
- **THEN** it includes entries covering `plugin.json`, `mcp.json`, and `.cursor-plugin`

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

