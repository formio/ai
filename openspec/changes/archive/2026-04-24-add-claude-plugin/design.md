## Context

The Form.io MCP server (`packages/mcp-server`) and the skills library (`.claude/skills/`) currently ship only as pnpm workspace packages. End users who want to use them in Claude Code must clone the repo or manually wire the MCP server command. Claude Code now supports a first-party plugin format with a `.claude-plugin/plugin.json` manifest and a `mcpServers` field, distributed via a marketplace manifest hosted at a known location. We want a one-command install path (`@formio/ai` from npm) that gives Claude Code users both the MCP server and the skills library.

The MCP server entrypoint is `packages/mcp-server/src/stdio.ts`, which depends on CJS modules (`express`, formio client libs) that don't resolve cleanly under pure ESM. The skills library has 22 directories, each with a `SKILL.md` validated by `skills-validator.ts`.

## Goals / Non-Goals

**Goals:**

- Publish `@formio/ai` to npm so Claude Code users can install the plugin with one command.
- Bundle the MCP server into a single stdio-executable `.mjs` file so the plugin has no runtime install step beyond `npm install @formio/ai`.
- Ship the full skills library inside the plugin so skills are discovered automatically when the plugin is enabled.
- Keep the plugin versioned via Changesets and released automatically from `main`.
- Provide a runnable example (`examples/basic-app/`) and smoke test that verify the built plugin works end-to-end.

**Non-Goals:**

- No changes to MCP tool surface, skill content, or authentication flow.
- No backward-compat layer for consumers using the raw `mcp-server` package — the plugin is purely additive.
- No separate marketplace hosting infrastructure; we rely on the npm `source` type in `marketplace.json`.
- No HTTP transport for the MCP server — plugin uses stdio only.

## Decisions

**1. Plugin source in `plugin/` at repo root, built artifact in `dist/plugin/`.**
Keeps hand-authored files (manifest, package.json, skills) separate from generated ones (bundled server). `plugin/package.json` sets `publishConfig.directory = "../dist/plugin"` so `pnpm publish` from `plugin/` publishes the built tree. Alternatives: publishing directly from `plugin/` (would require the bundled server to live in source) or a single flat directory (muddles source and build).

**2. esbuild single-file ESM bundle for the MCP server.**
Bundles `packages/mcp-server/src/stdio.ts` to `dist/plugin/server/stdio.mjs` with `platform: 'node'`, `format: 'esm'`, `target: 'node20'`. A banner re-creates `require`, `__filename`, and `__dirname` via `createRequire`/`fileURLToPath` so CJS deps (express, formio-js) resolve. Output is chmod 755 so the shebang executes. Alternatives: tsc + node_modules in the published tarball (much larger, version-skew risk) or rollup (equivalent result, esbuild is already in the toolchain).

**3. Marketplace manifest uses `source: "npm"`, `package: "@formio/ai"`.**
Users add the Form.io marketplace once, then install by plugin name. Alternatives: `git` source (forces users to have repo access and handle tags) or a standalone marketplace repo (extra infra for a single plugin).

**4. Skills are copied verbatim from `plugin/skills/` into `dist/plugin/skills/` (no transform).**
Claude Code's skill loader reads `SKILL.md` frontmatter directly; no build step is needed. The skills in `plugin/skills/` are the authoritative copies shipped to users and are validated by the existing skills-validator tests.

**5. Changesets prerelease mode for `0.x`.**
`.changeset/pre.json` keeps initial releases on a prerelease dist-tag so we can iterate on the plugin format before promoting to `latest`.

**6. Release via `changesets/action@v1` on pushes to `main`.**
`plugin.yml` runs `pnpm changeset:version` to bump versions and `pnpm release:plugin` to build + publish. Alternatives: manual `npm publish` from a maintainer's machine (error-prone, no audit trail) or release-please (redundant with Changesets which is already used in the monorepo).

**7. Smoke test via stdio `tools/list` JSON-RPC.**
`scripts/test-plugin.ts` spawns the bundled `dist/plugin/server/stdio.mjs` and sends a `tools/list` request, asserting the response shape. This catches bundling regressions (missing CJS shim, wrong entrypoint) that Vitest's module-level tests can't.

## Risks / Trade-offs

- **[Bundled server drifts from source]** → `plugin-build.test.ts` asserts `dist/plugin/` layout after `buildPlugin()` runs; the Release workflow builds + smoke-tests before publishing.
- **[CJS/ESM interop breaks on dep upgrades]** → The esbuild banner is the single point of compat; `scripts/test-plugin.ts` catches interop regressions because it actually runs the bundle.
- **[Skills copied into the plugin go stale vs. `.claude/skills/`]** → Acceptable short-term because both sets are validated by the same `skills-validator` harness; long-term the plugin source may become the single source of truth.
- **[Marketplace manifest at repo root collides with Claude Code's own `.claude-plugin/` convention if this repo is ever consumed as a plugin]** → Not a real risk: this repo is the marketplace publisher, not a plugin consumer. The nested `plugin/.claude-plugin/plugin.json` is the plugin's own manifest.

## Migration Plan

1. Merge this change to `main`.
2. The `plugin.yml` workflow opens a Changesets "Version Packages" PR.
3. Merging that PR triggers `pnpm release:plugin`, which builds `dist/plugin/` and publishes `@formio/ai` to npm (prerelease tag while `pre.json` is present).
4. Users add the Form.io marketplace in Claude Code and install `formio-ai`.

Rollback: `npm deprecate @formio/ai@<version>` + revert the change on `main`. Existing installs continue to work; new installs resolve to the prior version.
