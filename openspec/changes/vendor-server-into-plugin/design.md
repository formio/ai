## Context

The 1.0.0 directory update for `formio-ai` is held by the Anthropic plugin directory's policy. The scan reports, against `.claude-plugin/plugin.json · mcpServers.formio-mcp`, that a launcher running a registry package at an exact version is held because the package's dependencies resolve at install time, and separately that no `package.json` plus `package-lock.json` (or `npm-shrinkwrap.json`) was found between the server's directory and the plugin root — exact versions, registry sources, and hashes being what the Verified badge needs.

Facts established before writing this design:

- Claude Code installs a plugin's npm dependencies itself when the plugin root holds a `package.json` and a lockfile of `lockfileVersion` 2 or 3 (`npm-shrinkwrap.json` or `package-lock.json`): at install, at update, and at session start when an enabled plugin is not cached. It uses frozen resolution, runs no lifecycle scripts, rejects `overrides`, accepts only registry packages with `https` download links, does not read `.npmrc`, and stops after 60 seconds. It does not run for a plugin loaded in place (`--plugin-dir`, or a relative-path plugin from a local-directory marketplace). Source: code.claude.com/docs/en/plugins/loading.
- The directory's pre-submission checklist holds both a pinned `npx` launcher ("Runs a pinned npx or uvx package") and a root lockfile ("Dependencies install from a lockfile"); no route is hold-free. Bundling a package's code into the plugin removes the launcher finding. Files over 256 KiB, plugins over 512 files, and minified or packed code are held unread.
- A fresh `npx -y @formio/mcp@1.0.0` today resolves 29 of 98 packages to versions this repository never tested (e.g. `@modelcontextprotocol/sdk` 1.32.1 against 1.30.1, `express` 5.3.0 against 5.2.1).
- An `npm-shrinkwrap.json` inside the `@formio/mcp` tarball was not honoured by `npx` in a local test: npm's installer reads a dependency's shrinkwrap only when the registry flags the version `_hasShrinkwrap`, which none of six sampled CLIs carry. That route was dropped.
- `pnpm-lock.yaml` records the server's runtime closure as 94 packages, each at a single version, each with an `integrity` hash. A lockfile generated from that closure installed exactly those 94 versions.
- `packages/mcp-server`'s `tsc` output is 70 non-test `.js` modules, about 400 KB in total, the largest 44 KB.
- `cli-launch.ts` reads the version from `../package.json` unless an esbuild `define` supplied it; from `plugin/server/` that read would find `@formio/ai`'s manifest.

## Goals / Non-Goals

**Goals:**

- The Claude Code manifest runs code committed in the plugin, against a dependency tree pinned by a lockfile with registry URLs and integrity hashes.
- That tree is the one `pnpm-lock.yaml` records and CI tests, not a fresh resolution.
- The vendored files cannot drift from the server source without `pnpm test` failing.
- Every launch other than the Claude Code manifest keeps working exactly as today.
- Releases stay one step: the Version Packages PR carries everything.

**Non-Goals:**

- Removing the directory's review hold. A lockfile is itself held; this change makes the held code readable and its dependencies pinned, which is what a reviewer checks.
- Changing the `.mcpb` bundle, the Docker image, the MCP Registry entry, the Cursor or Agent Plugins manifests, or the server's behaviour.
- The scan's `user_config` note ("Ask the user for the value through a user_config option (sensitive: true) instead of reading it from their machine"). Its location was not reported; the likeliest trigger is `plugin/README.md` documenting `FORMIO_API_KEY` as an environment variable. It is left for a separate change once the finding's location is known, because the README requirement in `claude-plugin-packaging` mandates documenting that variable and the manifest requirement forbids `userConfig` — both are decisions to revisit deliberately, not as a side effect here.

## Decisions

### 1. Vendor the `tsc` output, not a bundle

`plugin/server/` holds `packages/mcp-server/dist/**/*.js` minus `__tests__`, maps, and declarations. Alternatives:

- **The esbuild bundle (`server/stdio.mjs`)**: 3.6 MB in one minified file — over the 256 KiB limit and unreadable, so held unread. Rejected.
- **TypeScript sources run with type stripping**: needs Node ≥ 22.18 unflagged, above the plugin's declared `>=22.12`, and `.ts` imports with `.js` specifiers do not resolve under stripping. Rejected.
- **`tsc` output**: readable, one module per source file, small, and byte-identical to what `@formio/mcp` publishes. Chosen.

`plugin/package.json` already declares `"type": "module"`, so the ESM modules load as they do in the npm package. No `package.json` is written inside `plugin/server/`: the scanner looks for the manifest pair between the server's directory and the plugin root, and a nearer `package.json` without a lockfile would be found first.

### 2. Generate the lockfile from `pnpm-lock.yaml`, offline

`scripts/sync-plugin-server.ts` walks `importers['packages/mcp-server'].dependencies` through `snapshots` (stripping pnpm's peer suffixes) to collect the runtime closure, then writes a `lockfileVersion: 3` lockfile with a flat layout: every package at `node_modules/<name>`, `version` from pnpm, `resolved` as `https://registry.npmjs.org/<name>/-/<basename>-<version>.tgz`, `integrity` from the `packages` entry, and `dependencies` / `optionalDependencies` / `peerDependencies` from the package's metadata. A flat layout is valid because each name appears once; a second version of any name fails generation (spec: "A split version fails generation") rather than requiring a nesting algorithm nobody needs yet.

Alternative considered: `npm install --package-lock-only` with `overrides` seeded from the pnpm closure, in a scratch directory. It produced the right 94 versions, but needs the network, rejects an override on a direct dependency (direct dependencies must be written exact instead), and leaves the correctness of the output to npm's resolver rather than to a pure function this repository can unit-test. The offline generator is a pure function of `pnpm-lock.yaml` and two `package.json` files, so `--check` runs inside `pnpm test` without network. The real-install proof moves to `pnpm test:plugin` (Decision 5).

The root entry (`packages[""]`) carries `name`, `version`, `license`, `engines`, and `dependencies` exactly as `plugin/package.json` declares them, which is what frozen resolution compares.

### 3. Exact dependency versions in `plugin/package.json`

The plugin's `dependencies` are the server's direct dependencies at the versions pnpm resolved, written exactly (`"express": "5.2.1"`), not the server's ranges. pnpm treats `plugin` as a workspace package, so these entries also join `pnpm-lock.yaml` as a `plugin` importer resolving to the same versions — no new packages enter the store. The sync script writes the block; the check compares names with `packages/mcp-server/package.json` and versions with the lock.

### 4. A stamped version module replaces the `package.json` read

`packages/mcp-server/src/version.ts` exports `SERVER_VERSION`, written by `pnpm sync:pins` from `packages/mcp-server/package.json` and checked by `sync:pins --check`. `cli-launch.ts` imports it; the `__FORMIO_MCP_VERSION__` define and the `createRequire` read are removed, and the `.mcpb` build drops its `define`. One source serves the npm package, the `.mcpb` bundle, and `plugin/server/`. Ordering inside `changeset:version`: `changeset version` bumps the package, `sync:pins` stamps `version.ts`, the server builds, then `sync:plugin-server` copies the compiled output — so the vendored `version.js` carries the new version.

### 5. The smoke test installs the way Claude Code installs

`pnpm build:plugin` stops bundling `dist/plugin/server/stdio.mjs`; it copies `plugin/` (now including `server/`, `package.json`, `package-lock.json`) and runs `sync:plugin-server --check`. `pnpm test:plugin` copies `dist/plugin` to a temporary directory, runs `npm ci --ignore-scripts --no-audit --no-fund` there with a user config that names no `.npmrc` (so a contributor's mirror cannot mask a lockfile that only works through it), asserts every installed version matches its lockfile entry, then spawns `node <copy>/server/stdio.js` and sends `tools/list`. This is the only network-dependent check, and it is the one that proves Claude Code's install will succeed. It runs in the release workflow before publish, as today.

`pnpm build:plugin:local` keeps rewriting launches to the local tree and, because Claude Code skips the install for in-place plugins, runs the same `npm ci` in `dist/plugin-local`. Its Claude Code launch becomes the manifest's own (`node ${CLAUDE_PLUGIN_ROOT}/server/stdio.js`), plus `--use-system-ca` where supported.

### 6. Only the Claude Code manifest changes launch

The Cursor manifest, `plugin/plugin.json` + `mcp.json`, `server.json`, the setup skill, and the READMEs keep `npx -y @formio/mcp@<version>`. Those clients do not install from the plugin's lockfile, and `npx` is the route that reads `.npmrc`. `sync:pins` stops owning the Claude Code manifest's launch; its tests assert the new launch shape instead.

### 7. Release coupling follows automatically

Any change under `packages/mcp-server/src` now also changes `plugin/server/` once synced, so `check:releases` requires an `@formio/ai` release for a server change in the same PR, which `changeset:follow` already adds at version time. No change to `require-release-coverage.ts` is expected; a test confirms a server-only changeset still produces both releases.

## Risks / Trade-offs

- **Networks that reach npm only through a private mirror** → Claude Code's install ignores `.npmrc`, so the plugin's server does not start there. Mitigation: every other launch keeps `npx`; `formio-mcp-setup` routes a plugin whose tools are missing to the manual `npx` connection. This is a regression for those users of the Claude Code plugin specifically, accepted in exchange for tested dependencies everywhere else.
- **60-second install limit** → 94 small packages; `test:plugin` reports the install duration so a growing tree is visible before it nears the limit.
- **Committed generated code** → reviewers see compiled diffs alongside source diffs in every server PR. The drift check keeps them honest; `.gitattributes` marks `plugin/server/**` and `plugin/package-lock.json` `linguist-generated` so GitHub collapses them.
- **GitHub Copilot CLI** reads the same marketplace. If it loads `.claude-plugin/plugin.json` and performs no install, its server would fail to start. Verified during implementation by checking which manifest Copilot CLI reads; if it reads the Claude manifest, the design is revisited before merge.
- **`plugin/CHANGELOG.md` is 133 KiB** and grows each release; at 256 KiB the directory holds it unread. Not addressed here; noted for a follow-up.
- **Dependency fixes no longer reach Claude Code users silently** → a security release of a transitive package arrives only with a Form.io release. That is the point of pinning, and pnpm's lock update plus a patch release is the path.
- **The review hold remains** → the directory holds lockfile installs too. Its reviewer now reads committed server code and a hashed lockfile instead of an unpinned dependency tree.

## Migration Plan

Ship as 1.0.1 (`@formio/mcp` and `@formio/ai` patches). Users of the Claude Code plugin pick up the new launch on update; nothing on their machines needs changing. Rollback is reverting the manifest's launch to the `npx` pin, which `sync:pins` can restamp.
