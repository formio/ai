# Client verification checklist

Task group 6. These are the checks no CI can make — each needs a real client driving a real install. Record the observed result inline; a blank result means unverified, not passing.

Build first: `pnpm build:plugin && pnpm test:plugin`.

## ⚠️ Blocked until `@formio/mcp` is published

Every manifest launches the server with `npx -y @formio/mcp`, and npm's `latest` is **0.8.4** — which predates Phase 0. Measured against the published package today:

```
19 tools; project_set present: False
```

0.8.4 registers `project_set` only when `FORMIO_PLUGIN_CONTEXT=1`, and the new manifests deliberately no longer set that variable. So a plugin install right now yields a server with no `project_set` and no way to route a project except an environment variable the plugin does not set. The local build is correct — `20 tools; project_set present: True` — so this is purely a publish-ordering problem, not a defect in the manifests.

**Consequence for this checklist:** the *MCP half* of rows 6.2, 6.3, and 6.5 cannot pass until a release carrying Phase 0 lands on npm. The *skills half*, the manifest detection, and Cursor's `variables` prompt can all be verified now.

Two ways to close it:

1. **Release first** (recommended). Phase 0's changeset plus this change's are both staged, so `pnpm release` publishes `@formio/mcp` with the Phase 0 server, after which `npx -y @formio/mcp` is correct everywhere and this checklist runs clean.
2. **Verify pre-publish against the local build.** Temporarily point a client's MCP entry at `dist/plugin/server/stdio.mjs` instead of `npx`:

   ```json
   { "command": "node", "args": ["<repo>/dist/plugin/server/stdio.mjs"] }
   ```

   That proves the server behaviour but not the `npx` resolution, so it is not a substitute for re-running the checklist after release.

## Cursor (local plugin, pre-submission)

1. ✅ Already linked: `~/.cursor/plugins/local/formio-ai` → `dist/plugin` (rebuild with `pnpm build:plugin` after any change; the link follows).
2. Restart Cursor, open **Customize** in the sidebar.
3. Install `formio-ai`, choosing project scope.

| Expectation | Result |
| --- | --- |
| Plugin appears in Customize with the Form.io logo and description | |
| Install prompts for `FORMIO_BASE_URL` (defaulted to `https://api.form.io`) and `FORMIO_PROJECT_URL`, neither marked required | |
| Skipping both still installs, and a Form.io tool call then returns the `project_set` guidance rather than an opaque failure | |
| All 11 Form.io skills are listed | |
| MCP server `formio-mcp` connects and reports 20 tools | ⚠️ blocked on publish — 0.8.4 reports 19 with no `project_set` |
| `formio-angular-resources` activates on "in my Angular app, add an Angular module for Participant" | |

## Claude Code (repository-path marketplace source)

Verifies the D3 source change did not break the install that works today.

1. Remove any existing Form.io marketplace, then `/plugin marketplace add https://github.com/formio/ai.git`
2. `/plugin install formio-ai@formio`

| Expectation | Result |
| --- | --- |
| Install prompts for base URL and default project URL as before | |
| MCP server starts via `npx -y @formio/mcp` — not the bundled file, which a clone lacks | |
| 20 tools available, `project_set` among them | ⚠️ blocked on publish — see above |
| `verify-project-url` hook still fires on session start and on entering an unmapped directory | |

## skills CLI (any agent)

Run from a scratch directory, against the pushed repository rather than a local clone — discovery depends on the committed `.claude-plugin/marketplace.json`.

```bash
npx skills add formio/ai --list
npx skills add formio/ai --skill '*' -a cursor -a codex -a github-copilot -a claude-code -y
```

| Expectation | Result |
| --- | --- |
| The listing includes every Form.io skill with no `--full-depth` | Verified against a clone of the tracked tree: 10 discovered (11 once `formio-mcp-setup` is staged) |
| The listing offers **no** `openspec-*` / `tdd-*` skills | Verified after task group 10 untracked the generated mirrors — was 17 offered, now 10 |
| Install writes once to `.agents/skills/` and symlinks `.claude/skills/` | Verified on a probe repository |
| `formio-angular-resources` ships inside the `formio-angular` directory | Verified — the CLI shadows a nested skill behind its parent |

## VS Code (install from source, no review needed)

1. Command Palette → **Chat: Install Plugin From Source**
2. Enter `https://github.com/formio/ai.git`

| Expectation | Result |
| --- | --- |
| VS Code detects the plugin (it auto-detects the Agent Plugins, Copilot, and Claude layouts) | |
| Skills appear in the chat customization surface | |
| `formio-mcp` connects and reports 20 tools | ⚠️ blocked on publish — see above |

## GitHub Copilot CLI

1. `copilot plugin marketplace add formio/ai`
2. `copilot plugin install formio-ai`

| Expectation | Result |
| --- | --- |
| The marketplace is accepted from `.claude-plugin/marketplace.json`, with no `.github/plugin/marketplace.json` present | |
| Skills and the MCP server both load | |
