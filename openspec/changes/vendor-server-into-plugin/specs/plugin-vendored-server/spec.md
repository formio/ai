## ADDED Requirements

### Requirement: The plugin carries the compiled server

`plugin/server/` SHALL hold the `tsc` output of `packages/mcp-server/src`, compiled without source maps or declarations and excluding tests: one `.js` module per source module, at the same relative paths, unbundled and unminified, so the code Claude Code runs is the code a reviewer and the directory's security scan can read. It SHALL contain no `.d.ts`, `.d.ts.map`, or `.js.map` files, no `__tests__` modules, and no `package.json`, because the plugin root's `package.json` and lockfile are the pair Claude Code installs from and a second `package.json` between the server and that root would be read as the server's own. Every file in it SHALL be smaller than 256 KiB, and the plugin as a whole SHALL hold fewer than 512 files, the limits past which the directory does not read a file and holds the plugin for review.

#### Scenario: The vendored server is the build output

- **WHEN** `packages/mcp-server/src` is compiled with `tsc` without source maps or declarations, and `plugin/server/` is compared with the output
- **THEN** every non-test `.js` module in the output exists in `plugin/server/` at the same relative path with identical bytes
- **AND** `plugin/server/` contains nothing else

#### Scenario: The plugin stays within the directory's read limits

- **WHEN** every file under `plugin/` is listed
- **THEN** there are fewer than 512 files
- **AND** every file that is not an image is smaller than 256 KiB

### Requirement: The plugin declares the server's dependencies at tested versions

`plugin/package.json` SHALL declare, in `dependencies`, exactly the runtime dependencies of `packages/mcp-server/package.json` — the same names, none added or missing — each at the exact version `pnpm-lock.yaml` resolves for `packages/mcp-server`, written without a range. `plugin/package-lock.json` SHALL be an npm lockfile of `lockfileVersion` 3 whose root entry agrees with `plugin/package.json` and whose entries are the complete runtime dependency closure `pnpm-lock.yaml` records for `packages/mcp-server`: one entry per package, at the version pnpm resolved, each with a `resolved` URL on `https://registry.npmjs.org/` and the `integrity` hash pnpm recorded. The lockfile SHALL NOT declare `overrides` and SHALL NOT mark any entry as requiring an install script, because Claude Code installs with frozen resolution, no lifecycle scripts, and no overrides.

The closure SHALL be read from `pnpm-lock.yaml`, not re-resolved against the registry, so the tree Claude Code installs is the tree this repository's tests ran against. A closure in which one package name resolves to two versions SHALL fail generation naming the package, rather than emit a lockfile that silently picks one.

#### Scenario: Declared dependencies match the server's, pinned exactly

- **WHEN** `plugin/package.json` `dependencies` is compared with `packages/mcp-server/package.json` `dependencies`
- **THEN** the names are identical
- **AND** each version is the exact version `pnpm-lock.yaml` resolves for `packages/mcp-server`, with no `^`, `~`, or range

#### Scenario: The lockfile is the tested closure

- **WHEN** `plugin/package-lock.json` is compared with the runtime closure `pnpm-lock.yaml` records for `packages/mcp-server`
- **THEN** every package in the closure has exactly one entry at the same version
- **AND** the lockfile has no entry outside the closure
- **AND** every entry carries a `resolved` URL on `https://registry.npmjs.org/` and the `integrity` hash from `pnpm-lock.yaml`

#### Scenario: The lockfile installs the way Claude Code installs

- **WHEN** `npm ci --ignore-scripts` runs in a copy of the built plugin
- **THEN** it succeeds without contacting any registry other than `https://registry.npmjs.org/`
- **AND** the installed version of every package equals its lockfile entry

#### Scenario: A split version fails generation

- **WHEN** the runtime closure resolves one package name to two versions
- **THEN** generation exits non-zero naming that package
- **AND** writes no lockfile

### Requirement: One script writes the vendored files and checks them

`pnpm sync:plugin-server` SHALL be the only writer of `plugin/server/`, the `dependencies` block of `plugin/package.json`, and `plugin/package-lock.json`. It SHALL build them from `packages/mcp-server`'s compiled output and `pnpm-lock.yaml` without network access. `pnpm sync:plugin-server --check` SHALL write nothing and exit non-zero naming each file that differs from what a sync would write. `pnpm test` SHALL run the check, so a server change that is not re-synced into the plugin fails CI, and `changeset:version` SHALL run the sync, so the Version Packages PR carries the regenerated files.

#### Scenario: Drift fails the test suite

- **WHEN** a module under `packages/mcp-server/src` changes and `pnpm sync:plugin-server` has not been run
- **THEN** `pnpm test` fails naming the stale file under `plugin/server/`

#### Scenario: Check mode writes nothing

- **WHEN** `pnpm sync:plugin-server --check` runs on a tree that has drifted
- **THEN** it exits non-zero naming each differing file
- **AND** every file it could write is byte-identical afterwards

#### Scenario: The release PR carries the regenerated files

- **WHEN** `pnpm changeset:version` runs
- **THEN** it runs `pnpm sync:plugin-server` after the version bump
- **AND** `plugin/package-lock.json`'s root entry carries the new `plugin/package.json` version
