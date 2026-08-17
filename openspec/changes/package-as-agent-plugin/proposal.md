## Why

A developer who has never heard of this toolset should be able to install it into whatever coding agent they already use, in one step, and start building. Today that step exists only for Claude Code (`/plugin install formio-ai@formio`). Everyone else hand-writes an MCP config file and copies a skills directory — which is exactly the friction that stops adoption.

Two things landed while Phase 0 was in flight, and together they remove almost all of that work:

- **[Agent Plugins 1.0.0](https://agent-plugins.org/)** (2026-08-06) — a vendor-neutral manifest for packaging Agent Skills plus MCP servers. Launch clients: ChatGPT/Codex, Cursor, GitHub Copilot, Kiro, VS Code.
- **Cursor's plugin marketplace** — a one-click **Install** with project-or-user scope, and a `variables` block that prompts for configuration at install time. That is the analogue of Claude Code's `userConfig`, which the audit had written off as Claude-only (gap G3).

Separately, `npx skills add <repo>` (the `skills` CLI, 75+ agents) is a real agent-agnostic installer for the skill library — verified against this repository. But it currently installs the **wrong skills**: default discovery does not look in `plugin/skills/`, so it finds only the repo's internal `openspec-*` and `tdd-*` tooling. Anyone who tries it today gets a broken result. That is a live defect against a public repo, not just a missing feature.

This change is Phase 1 of the multi-agent portability work and depends on Phase 0 (`neutralize-core-for-multi-agent`), which made the server start with no configuration and acquire its project at runtime — the precondition for a manifest that cannot prompt.

## What Changes

- Emit an **Agent Plugins 1.0.0** conformant bundle: root `plugin.json` (`$schema`, `name`, `version`, `description`, `author`, `homepage`, `repository`, `license`, `keywords`) plus `mcp.json` declaring the `formio-mcp` stdio server.
- Add a **Cursor plugin manifest** at `.cursor-plugin/plugin.json`, using `variables` to prompt for `FORMIO_BASE_URL` and `FORMIO_PROJECT_URL` at install time and referencing them as `${VAR}` in the MCP config. Neither is required — Phase 0 made "install now, pick a project later" a working flow.
- **BREAKING (install path, not API):** the git-installable manifests launch the server with `npx -y @formio/mcp` instead of the bundled `${CLAUDE_PLUGIN_ROOT}/server/stdio.mjs`. A git-cloned plugin has no build output, so a bundled-server path cannot resolve. The bundled server remains the mechanism for the npm package and the `.mcpb` desktop bundle.
- Change `.claude-plugin/marketplace.json` to declare `"source": "./plugin"` instead of the npm package. This is what makes `npx skills add formio/ai` discover the Form.io skills (verified: the `skills` CLI reads skill paths declared in a plugin marketplace manifest), and it lets Claude Code install from the repository without waiting on an npm publish.
- Ship `.agents/skills/` as the canonical install target in consumer projects via the `skills` CLI — one write serves Cursor, Codex, and GitHub Copilot, with Claude Code symlinked to it.
- Document two install routes: a plugin install per client with a marketplace, and `npx skills add formio/ai` for everything else.
- Extend the build and its smoke test to emit and validate every manifest layout, and schema-validate both Agent Plugins manifests.
- **Make the skills self-bootstrapping.** Add a `formio-mcp-setup` skill and a short preflight block to every skill body: before its first Form.io tool call, a skill checks whether the MCP tools exist, and if they do not, it stops and runs setup rather than improvising. Setup writes the MCP configuration for every client at once — `.mcp.json`, `.cursor/mcp.json`, `.vscode/mcp.json` (whose key is `servers`, not `mcpServers`), and `.codex/config.toml` — behind an approval gate, then tells the user how to reload. There is no universal `.mcp.json`: Codex is TOML-only and documents no JSON fallback, Cursor reads `.cursor/mcp.json`, and VS Code uses a different top-level key. Writing all four sidesteps client detection entirely.
- **Stop committing the OpenSpec-generated skill mirrors** (`.claude/skills/openspec-*`, `.claude/skills/tdd-*`, and the `.cursor/skills/` and `.github/skills/` copies) so a developer running `npx skills add formio/ai` receives the Form.io library and nothing else. Contributors regenerate them with the OpenSpec CLI, already a documented prerequisite.

Two install routes come out of this, and both are documented: a plugin install for clients with a marketplace (one step, skills plus MCP plus an install-time prompt), and `npx skills add formio/ai` for everyone else (skills only, with the setup skill connecting the server on first use). Neither requires hosting anything beyond the GitHub repository.

Explicitly **not** in this change: a bespoke `formio-ai init` CLI (see `design.md` D5 — the platforms and the setup skill now do that work), a `.well-known/agent-skills` endpoint (see D7), de-Claude-ing the rest of the skill prose (Phase 2 — the preflight blocks are the exception, because they are what makes a skills-only install work at all), and the marketplace submissions themselves (tracked as a checklist, gated on human review).

## Capabilities

### New Capabilities

- `agent-plugin-packaging`: the Agent Plugins 1.0.0 bundle and the Cursor plugin manifest — required fields, `mcp.json` shape, `variables` declaration, directory layout, and which components each client consumes.
- `skills-cli-distribution`: the repository is installable with `npx skills add formio/ai` such that exactly the Form.io skills are discovered, in every supported agent, with the nested sub-skill included.
- `formio-mcp-setup-skill`: the preflight contract every skill carries, and the setup skill that connects the MCP server for any client without being told which client it is in.

### Modified Capabilities

- `claude-plugin-packaging`: the manifest set grows beyond `.claude-plugin/`, the marketplace entry becomes a repository path, and the Claude manifest's MCP command changes to `npx`.
- `claude-plugin-release`: the release pipeline gains the new manifests as published artifacts and records the per-marketplace submission state.

## Impact

- **Packaging**: new `plugin/plugin.json`, `plugin/mcp.json`, `plugin/.cursor-plugin/plugin.json`; edits to `plugin/.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json`; a logo asset under `plugin/assets/`.
- **Build**: `scripts/build-plugin.ts` copies and version-stamps every manifest; `scripts/test-plugin.ts` validates each layout.
- **Tests**: new suites in `packages/mcp-server/src/__tests__/` for manifest conformance and layout invariants.
- **Skills**: new `plugin/skills/formio-mcp-setup/`; a preflight section added to every existing `SKILL.md` body (descriptions untouched, so the 1,024-character budget is unaffected).
- **Repository hygiene**: `.gitignore` gains the OpenSpec-generated skill mirrors; those paths leave version control.
- **Docs**: `README.md` quickstart and install matrix, `plugin/README.md`, `llms-install.md`, the initiative notes' Phase 1 status, `CONTRIBUTING.md` (OpenSpec regeneration, release notes).
- **Not affected**: the MCP server's own code, tool names and schemas, the skill library's content (Phase 2 owns its prose), and the `.mcpb` / Docker / MCP Registry channels.
- **Resolved during implementation**: the repository's `openspec-*` and `tdd-*` skills live in `.claude/skills/` and were therefore also offered by the `skills` CLI — discovery is additive and the CLI's `-s` flag takes exact names rather than globs, so the leak cannot be filtered at install time. Task group 10 removes those generated mirrors from version control instead.
