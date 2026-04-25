## Why

The Form.io MCP server and skills library were only consumable by wiring up the `mcp-server` package directly. To make distribution to Claude Code users one-step, we ship a first-party Claude Code plugin (`@formio/ai`) that bundles the MCP server and every `formio-api` / `formio-form` skill into a single npm-installable plugin, published through a Form.io marketplace manifest.

## What Changes

- Add a Claude Code marketplace manifest at repo root (`.claude-plugin/marketplace.json`) that advertises the `formio-ai` plugin sourced from npm.
- Add a plugin source tree at `plugin/` containing:
  - `plugin/.claude-plugin/plugin.json` — Claude Code plugin manifest declaring the `formio-mcp` stdio MCP server entrypoint.
  - `plugin/package.json` — npm package metadata for `@formio/ai` (publishes from `dist/plugin`).
  - `plugin/README.md` — published README documenting the environment variables the bundled server reads (`FORMIO_PROJECT_URL`, `FORMIO_API_KEY`, `FORMIO_LOGIN_FORM`) with required/optional status, defaults, and API-key vs. JWT auth modes.
  - `plugin/skills/` — 21 skill directories copied into the plugin bundle (full `formio-api` library plus `formio-form`, `formio-schema`, `formio-resource-planner`).
- Add `scripts/build-plugin.ts` that cleans `dist/plugin`, copies the `plugin/` static tree, syncs the manifest version from `plugin/package.json`, and bundles `packages/mcp-server/src/stdio.ts` into `dist/plugin/server/stdio.mjs` via esbuild (ESM, node20, with CJS-compat banner).
- Add `scripts/test-plugin.ts` — a smoke test that validates the built `dist/plugin/` tree (manifest fields, required skill dirs, MCP server `tools/list` over stdio).
- Add `examples/basic-app/` — an example consumer app (README, `.claude/settings.json`, `.env.example`) demonstrating how an end user installs and configures `@formio/ai` in a Claude Code project.
- Add Vitest coverage:
  - `packages/mcp-server/src/__tests__/plugin-build.test.ts` — asserts `buildPlugin()` produces the expected `dist/plugin/` layout.
  - `packages/mcp-server/src/__tests__/plugin-example-app.test.ts` — asserts the `examples/basic-app/` fixture stays consistent with the plugin manifest.
- Add `.github/workflows/plugin.yml` — a Release workflow that uses Changesets to version and publish `@formio/ai` to npm on pushes to `main`.
- Enter Changesets prerelease mode (`.changeset/pre.json`) so early `0.x` versions publish under a prerelease dist-tag.

## Capabilities

### New Capabilities

- `claude-plugin-packaging`: Defines the plugin source layout, build pipeline, and publish contract for the `@formio/ai` Claude Code plugin (marketplace manifest, plugin manifest, bundled MCP server, bundled skills library, example app).
- `claude-plugin-release`: Defines the CI release pipeline that versions and publishes the plugin to npm via Changesets.

### Modified Capabilities

<!-- None. Existing skills and MCP server behavior are unchanged; they are only re-packaged. -->

## Impact

- New top-level directories: `.claude-plugin/`, `plugin/`, `scripts/`, `examples/`.
- New CI workflow: `.github/workflows/plugin.yml`.
- New published npm artifact: `@formio/ai` (public access, prerelease dist-tag initially).
- New build/test scripts consumed via `pnpm build:plugin` and the plugin smoke test.
- No changes to the existing MCP server tool surface, skills library content, or authentication flow — the plugin is a packaging layer on top.
