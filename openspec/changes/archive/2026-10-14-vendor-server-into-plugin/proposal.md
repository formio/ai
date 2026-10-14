## Why

The Anthropic plugin directory holds every `formio-ai` update for review because the Claude Code manifest launches `npx -y @formio/mcp@<version>`: the pin fixes the package but not its dependencies, which resolve at install time. That is not only a review formality — a fresh `npx` of 1.0.0 today installs 29 of its 98 packages at versions no test ran against, including `@modelcontextprotocol/sdk` 1.32.1 against a tested 1.30.1. The directory's documented remedy is to run code the plugin carries: Claude Code installs a plugin's dependencies from a `package.json` and lockfile at the plugin root, and a lockfile with exact versions, registry sources, and hashes is what the directory's Verified badge asks for.

## What Changes

- The Claude Code manifest launches the server from the plugin itself: `node ${CLAUDE_PLUGIN_ROOT}/server/stdio.js`. **BREAKING** for the spec's current rule that no manifest points at a file a clone lacks — the compiled server is now committed, so a clone has it.
- `plugin/server/` carries the server's `tsc` output: readable, unminified JavaScript, the same modules `@formio/mcp` publishes, every file under the directory's 256 KiB limit.
- `plugin/package.json` declares the server's runtime dependencies at the exact versions this repository tests, and `plugin/package-lock.json` (lockfile v3) pins the whole dependency tree with registry URLs and integrity hashes, generated from `pnpm-lock.yaml` so the tree Claude Code installs is the tree CI tested.
- A sync script writes `plugin/server/`, the dependency block, and the lockfile; its `--check` mode fails `pnpm test` when any of them drifts from the build, and `changeset:version` runs it so the Version Packages PR carries the regenerated files.
- The server's version comes from a module `sync:pins` writes, rather than a run-time read of `../package.json`, which would find `@formio/ai`'s manifest from inside the plugin.
- Every other launch is unchanged: the Cursor manifest, the vendor-neutral `mcp.json`, the MCP Registry entry, the `.mcpb` bundle, Docker, and the documented manual setup keep `npx -y @formio/mcp@<version>`, which reads the user's `.npmrc`.
- `formio-mcp-setup` gains the fallback for a network that blocks the public npm registry: Claude Code's dependency install does not read `.npmrc`, so there the plugin's server does not start and the manual `npx` connection is the route.
- The Claude Code manifest names the existing square logo as its `icon`.
- `pnpm build:plugin` stops bundling `server/stdio.mjs`; `pnpm test:plugin` installs the plugin's dependencies with `npm ci --ignore-scripts` and starts the vendored server, which exercises the lockfile exactly as Claude Code will. `pnpm build:plugin:local` installs them too, because Claude Code skips the install for a plugin loaded in place.

## Capabilities

### New Capabilities

- `plugin-vendored-server`: the compiled server, dependency declaration, and lockfile the plugin carries; how they are generated from the build and `pnpm-lock.yaml`; and the drift check that keeps them current.

### Modified Capabilities

- `claude-plugin-packaging`: the Claude Code manifest launches the vendored server instead of `npx`, declares an `icon`, and the build and smoke test change accordingly.
- `mcp-server-packaging`: every build, including the plugin's vendored copy, reports the server version from a stamped module rather than a `package.json` read.
- `agent-plugin-packaging`: `mcp.json` keeps the `npx` launch; its "that server starts" scenario names the vendored server instead of the removed bundle.
- `formio-mcp-setup-skill`: documents the manual `npx` connection as the route when the plugin's server cannot install.

## Impact

- `plugin/.claude-plugin/plugin.json`, `plugin/package.json`, new `plugin/package-lock.json`, new `plugin/server/` (about 70 files, ~400 KB in total; the plugin stays well under 512 files).
- `packages/mcp-server/src/cli-launch.ts` and a new stamped version module; `scripts/sync-server-pin.ts`; new `scripts/sync-plugin-server.ts`; `scripts/build-plugin.ts`, `scripts/test-plugin.ts`, `scripts/build-plugin-local.ts`; root `package.json` scripts; the plugin and server packaging tests.
- `plugin/skills/formio-mcp-setup/`, `plugin/README.md`, `CONTRIBUTING.md`.
- Releases: `@formio/mcp` and `@formio/ai` patch to 1.0.1. The directory still applies a review hold for a plugin that installs from a lockfile; this change trades the launcher hold for that one and makes the reviewed code and dependency tree visible in the plugin.
- Users on networks that block npmjs.org lose the automatic Claude Code launch and keep the manual `npx` route.
