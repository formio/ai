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
