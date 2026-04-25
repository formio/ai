## 1. Plugin source tree and manifests
<!-- depends_on: none -->

### Red

- [x] 1.1 Write failing test in `plugin-build.test.ts` asserting `plugin/.claude-plugin/plugin.json` declares a `formio-mcp` MCP server launched via `node ${CLAUDE_PLUGIN_ROOT}/server/stdio.mjs`
- [x] 1.2 Write failing test asserting `plugin/package.json` has `name: "@formio/ai"`, `publishConfig.access: "public"`, and `publishConfig.directory: "../dist/plugin"`
- [x] 1.3 Write failing test asserting `.claude-plugin/marketplace.json` at repo root lists `formio-ai` with `source: "npm"` and `package: "@formio/ai"`

### Green

- [x] 1.4 Add `plugin/.claude-plugin/plugin.json` with the `formio-mcp` stdio server entry
- [x] 1.5 Add `plugin/package.json` with the npm package metadata and publish config
- [x] 1.6 Add `.claude-plugin/marketplace.json` at repo root

### Refactor

- [x] 1.7 Review implementation and refactor as needed

## 2. Bundled skills library
<!-- depends_on: 1 -->

### Red

- [x] 2.1 Write failing test asserting `plugin/skills/` contains the `formio-api` router (with every required reference file under `formio-api/references/`), `formio-form`, `formio-schema`, and `formio-resource-planner`
- [x] 2.2 Write failing test asserting `dist/plugin/skills/` after build mirrors `plugin/skills/`

### Green

- [x] 2.3 Populate `plugin/skills/` with the 21 skill directories from the skills library
- [x] 2.4 Ensure `scripts/build-plugin.ts` copies `plugin/skills/` into `dist/plugin/skills/` verbatim

### Refactor

- [x] 2.5 Review implementation and refactor as needed

## 3. Plugin build script
<!-- depends_on: 1, 2 -->

### Red

- [x] 3.1 Write failing test asserting `buildPlugin()` cleans and recreates `dist/plugin/` with manifest, package.json, skills, and `server/stdio.mjs`
- [x] 3.2 Write failing test asserting the built manifest's `version` equals `plugin/package.json` `version`
- [x] 3.3 Write failing test asserting `dist/plugin/server/stdio.mjs` is an ESM bundle with a CJS-compat banner (`createRequire`, `__filename`, `__dirname`) and is chmod 755

### Green

- [x] 3.4 Implement `scripts/build-plugin.ts` with `cleanDist`, `copyStatic`, `syncManifestVersion`, and `bundleServer` using esbuild (platform node, format esm, target node20, banner)
- [x] 3.5 Wire `pnpm build:plugin` to invoke the script

### Refactor

- [x] 3.6 Review implementation and refactor as needed

## 4. Plugin smoke test
<!-- depends_on: 3 -->

### Red

- [x] 4.1 Write failing test asserting the smoke test exits non-zero with a helpful message when `dist/plugin/` is missing
- [x] 4.2 Write failing test asserting the smoke test validates required `plugin.json` fields and required skill directories
- [x] 4.3 Write failing test asserting the smoke test spawns the bundled server and gets a valid JSON-RPC `tools/list` response

### Green

- [x] 4.4 Implement `scripts/test-plugin.ts` with `assertBuildExists`, `validateManifest`, skill-dir checks, and a stdio `tools/list` round-trip

### Refactor

- [x] 4.5 Review implementation and refactor as needed

## 5. Example consumer app
<!-- depends_on: 1 -->

### Red

- [x] 5.1 Write failing test in `plugin-example-app.test.ts` asserting `examples/basic-app/` contains `README.md`, `.claude/settings.json`, and `.env.example`
- [x] 5.2 Write failing test asserting `examples/basic-app/.claude/settings.json` references the plugin name from `plugin/.claude-plugin/plugin.json`
- [x] 5.3 Write failing test asserting `.env.example` documents the Form.io environment variables the bundled server needs

### Green

- [x] 5.4 Add `examples/basic-app/README.md` with install and configuration instructions
- [x] 5.5 Add `examples/basic-app/.claude/settings.json` enabling the `formio-ai` plugin
- [x] 5.6 Add `examples/basic-app/.env.example` documenting required Form.io env vars

### Refactor

- [x] 5.7 Review implementation and refactor as needed

## 6. Plugin README
<!-- depends_on: 1, 3 -->

### Red

- [x] 6a.1 Write failing test in `plugin-build.test.ts` asserting `plugin/README.md` exists and references `FORMIO_PROJECT_URL`, `FORMIO_API_KEY`, and `FORMIO_LOGIN_FORM` with their required/optional status and defaults
- [x] 6a.2 Write failing test asserting `dist/plugin/README.md` exists after `pnpm build:plugin`

### Green

- [x] 6a.3 Add `plugin/README.md` documenting env vars, defaults, and API-key vs. JWT auth modes
- [x] 6a.4 Confirm `scripts/build-plugin.ts` copies the README into `dist/plugin/` (covered by existing `copyStatic` step)

### Refactor

- [x] 6a.5 Review implementation and refactor as needed

## 7. Release workflow
<!-- depends_on: 3, 4 -->

### Red

- [x] 6.1 Write failing assertion that `.github/workflows/plugin.yml` triggers on `push` to `main` and `workflow_dispatch`
- [x] 6.2 Write failing assertion that the job uses pnpm + Node 22, installs with `--frozen-lockfile`, and invokes `changesets/action@v1` with `version: pnpm changeset:version` and `publish: pnpm release:plugin`
- [x] 6.3 Write failing assertion that the job declares `contents: write` and `pull-requests: write` permissions and a cancel-in-progress concurrency group

### Green

- [x] 6.4 Add `.github/workflows/plugin.yml` implementing the release job
- [x] 6.5 Add `.changeset/pre.json` to enter prerelease mode for `0.x`

### Refactor

- [x] 6.6 Review implementation and refactor as needed
