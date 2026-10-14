## 1. Stamped server version

<!-- depends_on: none -->

### Red

- [x] 1.1 Write failing tests: `sync:pins` writes `packages/mcp-server/src/version.ts` from `packages/mcp-server/package.json`; `sync:pins --check` fails naming the module when it disagrees; `SERVER_VERSION` equals the package version with no `package.json` read; the `.mcpb` build no longer passes a `define`

### Green

- [x] 1.2 Add `version.ts`, teach `sync-server-pin.ts` to stamp and check it, import it in `cli-launch.ts`, remove the `createRequire` read and the `__FORMIO_MCP_VERSION__` define from `cli-launch.ts` and `build-mcpb.ts`

### Refactor

- [x] 1.3 Review implementation and refactor as needed

## 2. Lockfile generation from pnpm-lock

<!-- depends_on: none -->

### Red

- [x] 2.1 Write failing tests for the pure generator: closure walk from a fixture `pnpm-lock.yaml` (peer suffixes stripped, optional dependencies followed); lockfile v3 root entry mirrors the plugin `package.json`; every closure package has one flat entry with `resolved` on `https://registry.npmjs.org/` (scoped and unscoped tarball names) and pnpm's `integrity`; no `overrides`, no `hasInstallScript`; a split version fails naming the package
- [x] 2.2 Write failing tests for the dependency block: names equal the server's runtime dependencies, versions exact from the lock

### Green

- [x] 2.3 Implement the closure walk, lockfile builder, and dependency-block builder as pure functions in `scripts/sync-plugin-server.ts`

### Refactor

- [x] 2.4 Review implementation and refactor as needed

## 3. Vendored server sync and drift check

<!-- depends_on: 1, 2 -->

### Red

- [x] 3.1 Write failing tests: the server-file selection keeps non-test `.js` modules at their relative paths and drops maps, declarations, and `__tests__`; `--check` exits non-zero naming each differing or extra file and writes nothing; the committed `plugin/server/`, `plugin/package.json` dependencies, and `plugin/package-lock.json` pass `--check` against a fresh server build; every file under `plugin/` that is not an image is under 256 KiB and the plugin holds fewer than 512 files; `changeset:version` runs `sync:plugin-server` after `sync:pins` and a server build

### Green

- [x] 3.2 Implement the CLI (`pnpm sync:plugin-server [--check]`), add the root scripts and the `changeset:version` step, run it to commit `plugin/server/`, the dependency block, and `plugin/package-lock.json`; mark them `linguist-generated` in `.gitattributes`; run `pnpm install` so `pnpm-lock.yaml` records the `plugin` importer

### Refactor

- [x] 3.3 Review implementation and refactor as needed

## 4. Claude Code manifest launch and icon

<!-- depends_on: 3 -->

### Red

- [x] 4.1 Write failing tests: `.claude-plugin/plugin.json`'s `formio-mcp` is `command: node`, `args: ["${CLAUDE_PLUGIN_ROOT}/server/stdio.js"]`, no `env`, no `userConfig`; every `${CLAUDE_PLUGIN_ROOT}`/`${PLUGIN_ROOT}` path in any manifest names a committed file; the Cursor manifest and `mcp.json` keep the exact `npx` pin and `sync:pins --check` no longer expects one in the Claude manifest; `icon` names a square PNG of 512–2048 px under 2 MB; `plugin/package.json` `files` lists `server` and `package-lock.json`

### Green

- [x] 4.2 Change the Claude Code manifest launch and add `icon`; narrow `sync:pins` to the manifests that keep `npx`; update `files`

### Refactor

- [x] 4.3 Review implementation and refactor as needed

## 5. Build, smoke test, and local plugin

<!-- depends_on: 4 -->

### Red

- [x] 5.1 Write failing tests: `build:plugin` copies `server/`, `package.json`, and `package-lock.json`, writes no `server/stdio.mjs`, and fails naming `pnpm sync:plugin-server` on drift; `test:plugin` runs `npm ci --ignore-scripts` from the lockfile in a temporary copy with no user `.npmrc`, checks installed versions against the lockfile, spawns `node server/stdio.js`, and gets `tools/list` with `project_set`; the vendored server reports the server package version at `initialize`; `build:plugin:local` installs the locked dependencies into `dist/plugin-local`

### Green

- [x] 5.2 Update `build-plugin.ts`, `test-plugin.ts`, and `build-plugin-local.ts`; update the plugin build tests that referenced `stdio.mjs`

### Refactor

- [x] 5.3 Review implementation and refactor as needed

## 6. Setup-skill fallback and docs

<!-- depends_on: 4 -->

### Red

- [x] 6.1 Write failing tests: `formio-mcp-setup` covers a Claude Code plugin whose tools are missing because its server could not install, names a private npm mirror as the likely cause, routes to the manual `npx` connection, and does not instruct editing installed plugin files

### Green

- [x] 6.2 Add the fallback to `formio-mcp-setup`; update `plugin/README.md` and `CONTRIBUTING.md` (how the Claude Code plugin launches, `sync:plugin-server`, the local plugin's install step)

### Refactor

- [x] 6.3 Review implementation and refactor as needed

## 7. Release and end-to-end verification

<!-- depends_on: 5, 6 -->

### Red

- [x] 7.1 Confirm which manifest GitHub Copilot CLI reads from this marketplace; if it is `.claude-plugin/plugin.json`, stop and revisit the design before continuing

### Green

- [x] 7.2 Add a changeset: `@formio/mcp` patch and `@formio/ai` patch; run the Definition of Done (`pnpm test`, `pnpm lint`, `pnpm format`, `pnpm test:plugin`, `pnpm check:releases`, `openspec validate vendor-server-into-plugin --strict`)
- [x] 7.3 Install the plugin in Claude Code from this branch through a GitHub marketplace (not `--plugin-dir`), confirm Claude Code installs the dependencies, the `formio-mcp` server starts, `project_get` answers, and the install takes well under 60 seconds
- [x] 7.4 After release, the maintainer rescans in the directory; record which findings remain — rescanned 2026-10-14 on 1.0.1: validation and security scan passed; the launcher hold and the Verified-badge lockfile note are gone; remaining are the lockfile hold a reviewer clears and the `user_config` note, location unreported

### Refactor

- [x] 7.5 Review implementation and refactor as needed
