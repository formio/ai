## Why

Proposals 1–8 are merged, and the maintainer built an application end to end on 2026-10-13 with the local plugin build and found it working. The open Version Packages PR (#89) already folds every pending changeset into `@formio/mcp` 1.0.0 and `@formio/ai` 1.0.0 and moves every `@formio/mcp@0.14.1` pin to 1.0.0. What remains is to make local plugin testing one command, refresh the README screenshots that still show retired tool names, verify the release candidate the way each proposal was verified, and publish. The agent submission tools (#82) and PDF-first forms (#83) land after 1.0.

## What Changes

- **`pnpm build:plugin:local`** builds the plugin and writes `dist/plugin-local`, whose manifests launch the plugin's own bundled server (`node --use-system-ca <path>/server/stdio.mjs`) instead of `npx @formio/mcp@<published>`, so `claude --plugin-dir dist/plugin-local` tests unreleased skills against the server built from the same commit. `CONTRIBUTING.md` documents it.
- **README screenshots:** the MCP Inspector images and walkthrough that show `hello` and `form_revisions_list` are retaken against the 1.0 server.
- **Release verification, recorded in `design.md`:** the live suite against `https://form.test/sandbox`, the routing eval, and the planner eval, each on the release candidate. The routing eval surfaced an ambiguous clause in `formio-application`'s description (a framework-neutral "also track X" in an Angular workspace split graders 3–2); the clause is reworded and the eval re-run.
- **Changelog correction:** the 1.0 headline's tools/list figure is updated to the current size and budget.
- **Release:** the Version Packages PR is reviewed (versions, pins, changelog) and merged; the release workflow publishes npm, the MCP Registry, the bundles, Smithery, Docker Hub, and the GitHub release; each channel is checked afterwards.
- **Directory listing:** the Anthropic plugin directory entry (claude.ai/directory/manage), which tracks `main`, is published at 1.0.0 — a maintainer action.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `agent-plugin-packaging`: a local build that launches the bundled server.
- `claude-plugin-release`: a major release is verified before it is published.

## Impact

- `scripts/` (local build), root `package.json`, `CONTRIBUTING.md`, README images.
- No change to the tool surface or the skills' behaviour.
- The release publishes every automated channel at 1.0.0.
