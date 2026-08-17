## 1. Agent Plugins manifest and mcp.json
<!-- depends_on: none -->

### Red

- [x] 1.1 Write failing test: `plugin/plugin.json` exists, declares the Agent Plugins 1.0.0 `$schema`, `name: formio-ai`, and no top-level key outside the specification set
- [x] 1.2 Write failing test: `plugin/mcp.json` declares the same specification version, one `stdio` server named `formio-mcp`, launched via `npx -y @formio/mcp`
- [x] 1.3 Write failing test: every `${...}` placeholder under `mcpServers` is `${PLUGIN_ROOT}` or `${PLUGIN_DATA}`
- [x] 1.4 Write failing test: the npm package named in `mcp.json` args equals `packages/mcp-server/package.json` `name`, and the locally built server answers `tools/list` including `project_set` (no test spawns `npx` against the public registry)

### Green

- [x] 1.5 Author `plugin/mcp.json`
- [x] 1.6 Author `plugin/plugin.json`

### Refactor

- [x] 1.7 Review implementation and refactor as needed

## 2. Cursor plugin manifest with install-time variables
<!-- depends_on: 1 -->

### Red

- [x] 2.1 Write failing test: `plugin/.cursor-plugin/plugin.json` exists with `name`, `description`, `version`, `author`, `repository`, `license`, `logo`, and a `skills` path of `skills`
- [x] 2.2 Write failing test: the set of `${VAR}` placeholders in the manifest equals the keys of `variables.properties`
- [x] 2.3 Write failing test: `variables.properties.FORMIO_BASE_URL.default` is `https://api.form.io`, and `variables` declares no `required` entries
- [x] 2.4 Write failing test: the manifest's `skills` path resolves and its immediate children with a `SKILL.md` are exactly the library's top-level skills
- [x] 2.5 Write failing test: neither `plugin/plugin.json` nor `plugin/.cursor-plugin/plugin.json` declares a `hooks` component, while `.claude-plugin/plugin.json` still registers the hook

### Green

- [x] 2.6 Author `plugin/.cursor-plugin/plugin.json` with the `variables` schema and MCP entry
- [x] 2.7 Add the logo asset under `plugin/assets/` and reference it from the manifest

### Refactor

- [x] 2.8 Review implementation and refactor as needed

## 3. Claude manifest and marketplace source
<!-- depends_on: 1 -->

### Red

- [x] 3.1 Write failing test: `.claude-plugin/marketplace.json` declares the `formio-ai` entry with `source` equal to `./plugin`
- [x] 3.2 Write failing test: `plugin/.claude-plugin/plugin.json` launches `formio-mcp` via `npx -y @formio/mcp`, still mapping `FORMIO_BASE_URL` from `${user_config.formio_base_url}`
- [x] 3.3 Write failing test: no manifest under `plugin/` uses a `${CLAUDE_PLUGIN_ROOT}` or `${PLUGIN_ROOT}` path as an MCP `command`
- [x] 3.4 Write failing test: all three manifests declare the same `name` and `version`

### Green

- [x] 3.5 Switch the Claude manifest's MCP command to `npx -y @formio/mcp`
- [x] 3.6 Change the marketplace entry `source` to `./plugin`

### Refactor

- [x] 3.7 Review implementation and refactor as needed

## 4. Build and smoke test cover every layout
<!-- depends_on: 2, 3 -->

### Red

- [x] 4.1 Write failing test: `pnpm build:plugin` version-stamps all three manifests from `plugin/package.json`
- [x] 4.2 Write failing test: `dist/plugin/` contains all three manifests, `mcp.json`, and exactly one `skills/` tree
- [x] 4.3 Write failing test: a manifest deleted from `plugin/` is absent from `dist/plugin/` after a rebuild
- [x] 4.4 Write failing test: `pnpm test:plugin` exits non-zero when any manifest is missing or malformed, and validates the Cursor `variables`/placeholder match
- [x] 4.5 Write failing test: `npm pack` of the built plugin includes every manifest, driven by `plugin/package.json` `files`

### Green

- [x] 4.6 Extend `scripts/build-plugin.ts` to copy and version-stamp each manifest
- [x] 4.7 Extend `scripts/test-plugin.ts` to validate each layout and exercise the locally built server (not `npx`)
- [x] 4.8 Add the new manifests to `plugin/package.json` `files`

### Refactor

- [x] 4.9 Review implementation and refactor as needed

## 5. Skills CLI discovery
<!-- depends_on: 3 -->

### Red

- [x] 5.1 Write failing test: every `SKILL.md` under `plugin/skills/` is reachable without traversing a symbolic link
- [x] 5.2 Write failing test: no live skill body references `.claude/skills/`, `.cursor/skills/`, or `.github/skills/` (eval runbooks exempt)
- [x] 5.3 Write failing test: the library's top-level skills and the nested `formio-angular-resources` are all reachable from the marketplace-declared `./plugin` path

### Green

- [x] 5.4 Fix any symlink-reachable or client-path-dependent skill the Red tests surface
- [x] 5.5 Spike and record: does the marketplace declaration narrow `skills` CLI discovery to the declared path, or is it additive with `.claude/skills/`? Verify with `npx skills add <local clone> -l` against a clone that has both, and note the answer in `design.md` Open Questions

### Refactor

- [x] 5.6 Review implementation and refactor as needed

## 6. Manual client verification
<!-- depends_on: 4 -->

### Red

- [x] 6.1 Write the verification checklist as `openspec/changes/package-as-agent-plugin/client-verification.md`: per client, the install action, what must appear (skills listed, 20 MCP tools), and the observed result

### Green

- [ ] 6.2 Cursor: load `dist/plugin/` from `~/.cursor/plugins/local`, confirm the skills list, the 20 tools, and that `variables` prompts on install; record the result
- [ ] 6.3 Claude Code: `/plugin marketplace add` from a clean state then `/plugin install formio-ai@formio` against the repository-path source; confirm the `npx` server starts and the hook still fires
- [x] 6.4 `npx skills add formio/ai -l` from a scratch directory: confirm the Form.io library is what a developer gets, with no extra flag
- [ ] 6.5 VS Code: *Chat: Install Plugin From Source* with the repository URL; confirm skills and MCP load

### Refactor

- [ ] 6.6 Review implementation and refactor as needed

## 7. Documentation
<!-- depends_on: 4, 5, 9, 10 -->

### Red

- [x] 7.1 Write failing test: the README quickstart shows `npx skills add formio/ai` followed by a plain-language prompt, and instructs the reader to hand-write no MCP configuration file
- [x] 7.2 Write failing test: the README install matrix has a row naming the one-step plugin install for Claude Code, Cursor, Copilot CLI, VS Code, and Codex, plus a row for any other skills-capable agent
- [x] 7.3 Write failing test: the README states the two routes are alternatives, that a plugin install includes both halves, and that the `skills` CLI installs skills only

### Green

- [x] 7.4 Rewrite the README "Getting Started" as the quickstart plus the install matrix
- [x] 7.5 Update `llms-install.md`: drop the MCP-only framing for non-Claude clients, name `.agents/skills/`, and point an installing agent at `formio-mcp-setup`
- [x] 7.6 Retitle and update `plugin/README.md` to document which components each client consumes
- [x] 7.7 Update the initiative notes (untracked since `prune-shipped-surface`): mark the Phase 1 rows, correct G3 (Cursor `variables` and Claude `userConfig` are install-time prompts), correct G4 (the preflight replaces the hook for clients without one), and record both install routes
- [x] 7.8 Update `CONTRIBUTING.md`: the OpenSpec skill mirrors are generated rather than committed, with the command that recreates them

### Refactor

- [x] 7.9 Review implementation and refactor as needed

## 8. Release and submissions
<!-- depends_on: 6, 7 -->

### Red

- [x] 8.1 Write failing test: a status and owner is recorded for each review-gated channel (Cursor marketplace, Codex directory, awesome-copilot, GitHub MCP Registry, Docker MCP catalog, Cursor MCP directory, Cline marketplace)

### Green

- [x] 8.2 Add a changeset describing the new install paths and the marketplace-source change
- [x] 8.3 Fill in the submission checklist with owners and current status; confirm the release workflow neither automates nor fails on review-gated channels

### Refactor

- [x] 8.4 Review implementation and refactor as needed

## 9. The formio-mcp-setup skill and preflight contract
<!-- depends_on: none -->

### Red

- [x] 9.1 Write failing test: `plugin/skills/formio-mcp-setup/SKILL.md` exists, its directory name matches its `name`, and it passes the Agent Skills conformance suite
- [x] 9.2 Write failing test: its description triggers on a missing Form.io MCP server, on "install/connect the Form.io MCP server", and on preflight handoff, and carries a `Not for:` clause
- [x] 9.3 Write failing test: it documents all four client configurations — `.mcp.json` and `.cursor/mcp.json` under `mcpServers`, `.vscode/mcp.json` under `servers`, `.codex/config.toml` as TOML `[mcp_servers.formio-mcp]`
- [x] 9.4 Write failing test: every configuration snippet launches `npx -y @formio/mcp` and contains no project URL, base URL, or API key
- [x] 9.5 Write failing test: every path it writes is workspace-relative — none targets a home directory
- [x] 9.6 Write failing test: it previews file contents behind an approval gate, names the reload step for Claude Code, Cursor, VS Code, and Codex, and ends by asking the user to re-issue the request
- [x] 9.7 Write failing test: it describes an alternative for environments where `npx` cannot reach the public registry
- [x] 9.8 Write failing test: every other `SKILL.md` body contains a preflight section naming `project_set` and `formio-mcp-setup`, forbidding a raw-HTTP workaround; `formio-mcp-setup` itself is exempt from pointing at itself
- [x] 9.9 Write failing test: every skill description is byte-identical to its pre-change value, proving the preflight went into bodies only

### Green

- [x] 9.10 Author `plugin/skills/formio-mcp-setup/SKILL.md` with the four configurations, the approval gate, the per-client reload guidance, and the offline fallback
- [x] 9.11 Add the preflight section to every other skill body
- [x] 9.12 Confirm the conformance and description-budget suites still pass over the enlarged library

### Refactor

- [x] 9.13 Review implementation and refactor as needed

## 10. Remove the generated OpenSpec skill mirrors
<!-- depends_on: none -->

### Red

- [x] 10.1 Write failing test: no path under `.claude/skills/openspec-*`, `.claude/skills/tdd-*`, `.cursor/skills/`, or `.github/skills/` is tracked by git
- [x] 10.2 Write failing test: `.gitignore` covers each of those paths
- [x] 10.3 Write failing test: the `.claude/skills/formio-*` symlinks into `plugin/skills/` are still tracked

### Green

- [x] 10.4 `git rm -r --cached` the generated mirrors and add the `.gitignore` entries
- [x] 10.5 Verify `npx skills add <local clone> --list` now offers the Form.io library and no `openspec-*` / `tdd-*` skill, and record the count in `client-verification.md`

### Refactor

- [x] 10.6 Review implementation and refactor as needed
