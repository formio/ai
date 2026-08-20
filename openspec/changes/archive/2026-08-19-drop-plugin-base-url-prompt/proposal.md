## Why

The two CLI plugin manifests prompted for `FORMIO_BASE_URL` at install time and wired the answer into the server's `env` block. That was one global value answering a per-project question, and after the resolution work it earns nothing:

- For a hosted-cloud project the prompt's own default (`https://api.form.io`) is exactly what the shape rules now derive, so the answer is redundant.
- For a sub-directory-routed deployment the base URL is derived from the project URL's parent, so the answer is redundant there too.
- The environment is now the weakest source, so the value cannot override a committed `formio.json` or a working-directory mapping. Its only remaining reach was directories with nothing recorded — precisely where per-project derivation is better than one global.
- Worst case, it actively hid a problem: a self-hosted user who answered once at install silently satisfied the base URL for EVERY project, including ones on another deployment. That is the wrong-host failure the shape-aware rules were built to surface, and the install prompt was a way to re-introduce it.

`default-project-offer` already anticipated this, recording that `FORMIO_BASE_URL` "is already a fallback rather than a pin, since a directory's mapping supplies its own."

## What Changes

- `plugin/.claude-plugin/plugin.json` drops `userConfig.formio_base_url` and the `env` block that consumed it. `plugin/.cursor-plugin/plugin.json` drops its `variables` block and the same `env` block. Both manifests now launch the server with `command` and `args` alone.
- The specs asserting those manifests carry the prompt are updated, and the Cursor requirement stops describing a `variables` schema it no longer has.
- **NOT breaking, and deliberately not labelled as such.** With nothing set, a project whose base URL cannot be derived resolves with the base URL absent and the first authenticated call fails with a message naming `project set --base-url`, the `formio.json` `baseUrl` key, and the project it applies to. A skill's preflight `project get` surfaces the same message before any tool call. The agent is never left unable to determine what is needed, so this is a behavior change with a self-describing remedy rather than a break. Contrast the precedence reorder in `committed-project-configuration`, which silently changes which project a launch targets and is genuinely breaking.
- Affects only JWT authentication on a sub-domain-routed self-hosted deployment: a one-time `project set --base-url` per directory, or a `baseUrl` key in the committed file. API-key deployments never read the base URL and are untouched.
- **The `.mcpb` desktop bundle keeps its prompt.** A desktop host has no working directory to interview in — the existing suite already records that as the reason the bundle is the one install route that still asks for a project — so for that host an install-time value is the only practical way to supply one. This is a deliberate asymmetry, not an oversight.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `claude-plugin-packaging`: the Claude manifest no longer declares `userConfig` or maps `FORMIO_BASE_URL` into the server environment.
- `agent-plugin-packaging`: the Cursor manifest no longer declares a `variables` schema; the placeholders-match-variables invariant now holds trivially over two empty sets, and the requirement's justification is corrected — it argued from `FORMIO_PROJECT_URL` taking precedence over every mapping, which the scope reorder made false.

## Impact

- `plugin/.claude-plugin/plugin.json`, `plugin/.cursor-plugin/plugin.json` — already edited in the working tree; this change makes the rest of the repository agree with them.
- `packages/mcp-server/src/__tests__/plugin-manifests.test.ts` — six assertions on the removed fields.
- `packages/mcp-server/src/__tests__/plugin-build.test.ts` — the smoke test that mutates `variables.properties.FORMIO_BASE_URL` to prove a mismatch is caught.
- `packages/skill-tests/src/shipped-surface/project-url-variables.test.ts` — four assertions on the Cursor `variables` block.
- `plugin/skills/formio-mcp-setup/SKILL.md` — states that the shipped manifests set `FORMIO_BASE_URL` from an install-time prompt, which is now false for both CLI manifests.
- `plugin/README.md`, `README.md` — the environment tables describing the install prompt.
- `scripts/build-mcpb.ts` — unchanged, deliberately.
