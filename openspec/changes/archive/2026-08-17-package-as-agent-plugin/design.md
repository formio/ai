## Context

Phase 0 (`neutralize-core-for-multi-agent`) made the server client-agnostic: it starts with no configuration, resolves a project by precedence, exposes `project_set` everywhere, and fails fast on a browserless host. What remains is that the *package* is Claude-shaped. `plugin/` carries one manifest, `.claude-plugin/plugin.json`, whose MCP command points at a bundled file and whose configuration comes from Claude Code's `userConfig` prompt.

Three findings from live investigation on 2026-08-11 shape this design. All were verified by running the tools, not by reading about them.

**Cursor has a first-class plugin system.** Customize → Install, project or user scope, submissions at `cursor.com/marketplace/publish` (open source, public git repo, manual review). It accepts either an Agent Plugins root `plugin.json` (skills + MCP) or a Cursor-specific `.cursor-plugin/plugin.json` (adds rules, agents, commands, hooks, and **`variables`**). `~/.cursor/plugins/local` is a local-development load path, so a plugin can be exercised before any submission.

**`variables` is Cursor's `userConfig`.** A JSON Schema in the manifest, filled in by the user at install time in the Plugins → Configure dashboard, referenced as `${VAR}` in config files. This directly contradicts the audit's gap G3, which assumed install-time prompts were a Claude-only mechanism and that we would need to build our own prompt to replace them.

**`npx skills add formio/ai` already works — and currently installs the wrong thing.** The `skills` CLI (`vercel-labs/skills`, 75+ agent identifiers) clones a repository, finds skills, and installs them into `.agents/skills/` — one write serving Cursor, Codex, and GitHub Copilot — symlinking `.claude/skills/<name>` to the same files for Claude Code, and writing a `skills-lock.json`. Verified against this repository:

- `npx skills add formio/ai -l` → **7 skills: `openspec-*` and `tdd-*`.** None of the Form.io library. Default discovery searches the repo root, `skills/`, and agent directories such as `.claude/skills/` — not `plugin/skills/`. The `formio-*` entries in `.claude/skills/` are committed symlinks, and the CLI does not follow them.
- `npx skills add formio/ai -l --full-depth` → all 18, including `formio-angular-resources` as a first-class skill (which is only safe because Phase 0 renamed its directory to match its `name`).
- A scratch repository with `.claude-plugin/marketplace.json` declaring `"source": "./plugin"` → the CLI found the skill under `plugin/skills/` **with no extra flag**. That is the fix.

## Goals / Non-Goals

**Goals:**

- One install action per client, none of which requires editing a JSON file by hand.
- One skills directory and one MCP declaration, consumed by every client that can read them.
- `npx skills add formio/ai --skill '*'` installs the Form.io library, in any of 75+ agents, in one command — and installs *only* that library. See Open Questions: this requires the repository to stop committing the OpenSpec-generated skill mirrors, because discovery is additive and `-s` does not accept globs.
- Install-time configuration wherever the platform offers it (Claude `userConfig`, Cursor `variables`), and a working no-configuration install everywhere else.

**Non-Goals:**

- A bespoke `formio-ai init` CLI. See D5.
- The `formio-setup` skill and de-Claude-ing skill prose — Phase 2. A Cursor user who installs this and asks for an app will still be told to "restart Claude Code" at one step.
- Porting the `verify-project-url` hook to Cursor's hook format. Phase 0 moved correctness into the server; the hook stays a Claude-only ergonomic shortcut.
- Performing the marketplace submissions. This change makes the artifacts submittable and records the checklist.

## Decisions

### D1 — Three manifests over one directory, not three packages

`plugin.json` (Agent Plugins), `.cursor-plugin/plugin.json` (Cursor), `.claude-plugin/plugin.json` (Claude Code), over a single `skills/` tree and a single `mcp.json`. Each client detects its own manifest by location and ignores the others; VS Code explicitly auto-detects among the Agent Plugins, Copilot, and Claude layouts.

Alternative considered — ship only the vendor-neutral `plugin.json`: rejected because it forfeits both install-time prompts. Agent Plugins deliberately defines no configuration mechanism, so a Cursor user would install a server pointing at no project and a Claude user would lose the prompt they have today. The duplication is three small manifests, not three copies of the library.

### D2 — Git-installable manifests launch the server with `npx -y @formio/mcp`

`${CLAUDE_PLUGIN_ROOT}/server/stdio.mjs` only exists after `pnpm build:plugin`. Once the marketplace source is a repository path (D3), Claude clones the repo — where that file is absent — so the command must come from npm. Cursor and Agent Plugins clients are in the same position.

The bundled server is still built and published: it is what the `@formio/ai` npm package runs and what the `.mcpb` desktop bundle needs, and it remains the only offline path. This is the one place where the npm and git install routes legitimately differ.

Trade-off: an `npx` launch costs a package resolution on first start and requires network access on a cold cache. Acceptable, and it is what every published MCP server does. An air-gapped install uses the npm package or the `.mcpb`.

### D3 — `.claude-plugin/marketplace.json` declares `"source": "./plugin"`

This single edit does three things: it unblocks `skills` CLI discovery (verified), it lets Claude Code install from the repository without waiting for an npm publish, and it doubles as a GitHub Copilot CLI marketplace, which reads the same filename.

Alternative considered — move the canonical library to a root `skills/` directory, which the CLI searches by default: rejected as churn. It would move ~150 files, rewrite every path in `CLAUDE.md`, the build script, the eval harnesses, and both test packages, to buy the same discovery the marketplace declaration already buys.

Alternative considered — keep the npm source and tell developers to pass `--full-depth`: rejected. An easy button with a required flag is not an easy button, and the flag also pulls in the repository's internal tooling.

### D4 — Skills install to `.agents/skills/`, never per client

The CLI's own behavior, and the right default: `.agents/skills/` is the one path Cursor, Codex, and Copilot all read, and the only path Codex reads. Claude Code gets a symlink to the same files, so an update is one write. Nothing in the library may depend on being read from a client-specific directory — which the spec asserts, since a stray `.claude/skills/` reference in a skill body would silently break every other client.

### D5 — No `formio-ai init` CLI yet

The CLI's job would have been: prompt for configuration, write the right MCP config file, copy skills to the right directory. Each of those now has a platform owner — `variables` and `userConfig` for the prompt, plugin manifests for the MCP wiring, the `skills` CLI for the skills. Building our own would mean maintaining a fourth installer that duplicates all three.

Where a CLI would still earn its place, and what to watch for:

- **Clients with no plugin system** (Windsurf, Cline, JetBrains Junie): the `skills` CLI covers their skills; MCP is one documented file. Two steps, not zero.
- **The review gap**: Cursor and Codex both gate on manual review, so between publishing and listing, `npx skills add` plus a one-liner is the install path. That is the documented fallback, not a reason to build tooling.
- **Enterprise / air-gapped**: no public `npx`. The npm package and `.mcpb` already cover it.

Revisit if a real client hits a case none of the three covers. The scriptable MCP one-liners each client already ships — `cursor --add-mcp`, `claude mcp add`, `codex mcp add`, `code --add-mcp` — are what a CLI would call anyway, so documenting them costs nothing and keeps the option open.

### D7 — The skills bootstrap the server; no hosted endpoint, no init CLI

Two install routes, deliberately different in kind:

- **Plugin install** where a marketplace exists. One step, wires skills and MCP together, and carries an install-time prompt for the project URL.
- **`npx skills add formio/ai`** everywhere else. Skills only — the string `mcp` appears nowhere in that CLI, and a bare install writes exactly `.agents/skills/`, the `.claude/skills/` symlinks, and `skills-lock.json`.

The second route needs the server connected somehow, and the skills themselves are the best-placed thing to do it: they are already installed, they know they need tools, and they run inside the client that has to be configured. Hence the preflight contract and `formio-mcp-setup`.

Alternative considered — document a `.mcp.json` the reader writes by hand: rejected on the evidence. **There is no universal `.mcp.json`.** Claude Code reads a root `.mcp.json` with `mcpServers`; Cursor reads `.cursor/mcp.json`; VS Code reads `.vscode/mcp.json` under a **`servers`** key; Codex is TOML-only (`~/.codex/config.toml` or a project `.codex/config.toml`) and its documentation states there is no `.mcp.json` support and no compatibility layer. A documented `echo '{…}' > .mcp.json` silently does nothing in three of the four.

Alternative considered — host `.well-known/agent-skills/index.json` on form.io so the install becomes `npx skills add https://form.io`: rejected. The CLI does implement it (`WellKnownProvider`, paths `.well-known/agent-skills` then `.well-known/skills`, `index.json`, entries validated against `https://schemas.agentskills.io/discovery/0.2.0/schema.json` with `sha256:` digests), and it would give a curated index — but it costs a hosted endpoint, CI-generated archives, digests kept in sync, and a second source of truth, to buy something the repository route already provides. Note also that a bare domain does not resolve: `isWellKnownUrl` requires an `http://` or `https://` prefix, so `npx skills add form.io` is parsed as a git repository and fails with `fatal: repository 'form.io' does not exist`.

Alternative considered — a `formio-ai init` CLI: still rejected, and now for a second reason. Beyond D5's argument that the platforms own the prompt and the wiring, the setup skill does the same job without asking the developer to install another tool first.

### D8 — Setup writes every client's configuration rather than detecting the client

`formio-mcp-setup` writes all four files in one pass. Detection would mean asking the agent to identify its own host — unreliable, and unnecessary, because a config file for a client that is not present is inert. A Cursor-only user carries three harmless files they can commit for teammates on other agents or ignore.

The files carry no configuration at all, which is only possible because of Phase 0: the server starts bare and raises an actionable error naming `project_set`, so there is nothing to substitute and no secret to leak into a committed file.

The reload step is the unavoidable cost. Every client reads MCP configuration at session start, so the flow is always detect → preview → write → reload → re-ask, and the skill must hand control back rather than pretend the original request completed.

### D6 — Hooks stay Claude-only

Agent Plugins 1.0.0 has no hooks component; Cursor's hook format is its own. Rather than port `verify-project-url` three ways, it stays declared only in the Claude manifest. Phase 0 is what makes this safe: every project-scoped tool now fails with an error naming `project_set`, so a client without hooks gets guidance at the moment it matters instead of a silent misroute.

## Risks / Trade-offs

- **Changing the marketplace source changes how Claude installs** (npm tarball → git clone) → the smoke test asserts the git-reachable manifests never point at build output, and D2 removes the only path that depended on it. Worth a manual `/plugin install` from a clean marketplace add before release.
- **The `skills` CLI may still surface `openspec-*` / `tdd-*`** even with the marketplace path declared — discovery looked additive in probing, and this was not verified for a repo that has both. Task group 5 spikes it; if additive, the README documents `-s 'formio-*'` and the proposal's follow-up note stands.
- **Cursor rejects a `variables`/placeholder mismatch at submission** → asserted in the spec and in the smoke test, so a mismatch fails CI rather than a review cycle.
- **Two manifest formats will drift** (a field added to one, forgotten in the other) → the build syncs `version` across all three and the smoke test asserts identical `name` and `version`.
- **`npx` cold start on first tool call** → a few seconds, once per machine. Documented; the npm package remains for anyone who wants the bundle.
- **A preflight is an instruction, not a guarantee** → an agent may call a tool before reading it and hit "tool not found". That failure is self-explanatory and the preflight catches the retry, but it is not deterministic the way a plugin install is. Mitigated by keeping the preflight at the top of each body and by the tool-not-found error being clear on its own.
- **The preflight duplicates ~8 lines across 11 skills** → accepted. A shared reference file would break for anyone who installs a single skill, since sibling skills are not guaranteed to be present.
- **Dropping the OpenSpec mirrors from version control changes the contributor workflow** → a fresh clone has no `/opsx:*` skills until someone runs the OpenSpec CLI. Documented in `CONTRIBUTING.md`; the CLI is already a stated prerequisite in `CLAUDE.md`.
- **Agent Plugins 1.0.0 is days old** → the Claude layout keeps working unchanged, and VS Code already accepts either, so a client that lags loses nothing.

## Migration Plan

1. Add `plugin/mcp.json` and `plugin/plugin.json`; extend the build to copy and version-stamp them.
2. Add `plugin/.cursor-plugin/plugin.json` with `variables`, plus the logo asset.
3. Switch the Claude manifest's MCP command to `npx -y @formio/mcp`; verify `/plugin install` still works from a clean marketplace add.
4. Change `.claude-plugin/marketplace.json` to `"source": "./plugin"`; verify `npx skills add formio/ai -l` lists the Form.io library.
5. Load `dist/plugin/` from `~/.cursor/plugins/local` and confirm Cursor shows the skills and the 20 MCP tools, with `variables` prompting on install.
6. Extend `scripts/test-plugin.ts` to validate every layout; update `plugin/package.json` `files`.
7. Documentation: install matrix, per-client one-liners, Phase 1 status in the audit doc.
8. Ship a minor release, then work the submission checklist.

Rollback is a revert plus a marketplace-source restore; nothing here writes state outside the repository.

## Open Questions

- ~~Does declaring the marketplace source narrow `skills` CLI discovery to the declared paths, or is it additive?~~ **Answered: additive, and there is no filter to work around it.**
  - A probe repository with both a marketplace-declared `plugin/skills/` and a `.claude/skills/` found *both* skills.
  - Against this repository the declaration works as intended: all 11 Form.io skills are discovered with no `--full-depth`. But so are the 7 committed `openspec-*` / `tdd-*` skills — 17 offered in total.
  - `-s 'formio-*'` was the planned mitigation. It does not work: the CLI answers `No matching skills found for: formio-*`. `-s` takes exact names, not globs. The alternatives are an eleven-name literal list or `--skill '*'`, which installs the internal tooling into the developer's editor.
  - **Therefore a clean one-command install requires the repository to stop committing the OpenSpec-generated skill mirrors** (`.claude/skills/openspec-*`, `.claude/skills/tdd-*`, and the `.cursor/skills/` and `.github/skills/` copies), leaving contributors to regenerate them with the OpenSpec CLI. That is a contributor-workflow change, so it is a maintainer decision rather than something this change makes unilaterally. **Blocks task group 7** — the documented command depends on the answer.
  - Incidental finding: the CLI shadows a nested skill behind its parent, so `formio-angular-resources` installs as part of the `formio-angular` directory rather than as a separate entry. That is the desired outcome and needs no change.
- Should the Cursor manifest also declare `commands` for the orchestrators (`/formio-build-app`), which Cursor supports and Agent Plugins does not? Deferred: it duplicates skill triggers, and Phase 2 may reshape those entry points anyway.
- Does the Copilot CLI need `.github/plugin/marketplace.json` as well, or does it genuinely read `.claude-plugin/marketplace.json` in all versions? Cheap to ship both; confirm before adding a second file to keep in sync.
