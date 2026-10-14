## 1. Local plugin build

<!-- depends_on: none -->

### Red

- [x] 1.1 Write failing unit tests for the manifest rewrite: a `formio-mcp` entry launching `npx @formio/mcp@x` becomes `node [--use-system-ca] <abs>/server/stdio.mjs`; other entries and fields are untouched; `--use-system-ca` only when the given flag set has it

### Green

- [x] 1.2 Implement `scripts/build-plugin-local.ts` (runs `build:plugin`, copies to `dist/plugin-local`, rewrites the copy's manifests) and the root `build:plugin:local` script; document it in `CONTRIBUTING.md` beside "Testing the plugin locally"
- [x] 1.3 Run it; start the local server and confirm it lists every registered tool; confirm `dist/plugin` and `plugin/` are unchanged

### Refactor

- [x] 1.4 Review implementation and refactor as needed

## 2. README screenshots

<!-- depends_on: 1 -->

### Red

- [x] 2.1 Confirm which README images show retired tool names (`hello`, `form_revisions_list`) or a bare-array `form_list` result

### Green

- [ ] 2.2 Retake them by hand (or with the blocking extension disabled) against the local 1.0 build; replace the files under `packages/mcp-server/docs/` — not blocking the release: the README loads them by URL from `main`, so new images show on npm and GitHub without a republish

### Refactor

- [x] 2.3 Review implementation and refactor as needed

## 3. Release verification

<!-- depends_on: 1 -->

### Red

- [x] 3.1 Run the live suite against `https://form.test/sandbox` on the release candidate; every case passes and the project is left as found

### Green

- [x] 3.2 Run the routing eval and the planner eval on the release candidate; record both beside the live result in `design.md`; neither below its last recorded result
- [x] 3.3 Check #89: every package version and `@formio/mcp@` pin names 1.0.0, and the changelogs read correctly

### Refactor

- [x] 3.4 Review implementation and refactor as needed

## 4. Publish

<!-- depends_on: 3 -->

### Red

- [x] 4.1 Merge this change (Definition of Done: `pnpm test`, `pnpm lint`, `pnpm format`, `pnpm check:releases`, `openspec validate release-1-0 --strict`) — merged as #105

### Green

- [x] 4.2 Maintainer merges #89; the release workflow publishes; confirm npm, MCP Registry, bundles, Smithery, Docker Hub, and the GitHub release at 1.0.0 — 1.0.0 published 2026-10-14 after #107 fixed the prepublish suite under npm 12; npm, MCP Registry, mcpb, Smithery, Docker Hub, and the GitHub release confirmed
- [x] 4.3 Maintainer publishes 1.0.0 in the Anthropic plugin directory (claude.ai/directory/manage) — submitted; the directory held it for a pinned npx launch, which `vendor-server-into-plugin` (1.0.1) replaced with a lockfile install that a reviewer clears

### Refactor

- [x] 4.4 Review implementation and refactor as needed
