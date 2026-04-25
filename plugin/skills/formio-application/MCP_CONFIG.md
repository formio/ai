# MCP_CONFIG — Write `.mcp.json` for the target Form.io project

This document is loaded by the parent `formio-application` skill during Step 4. It is **not** a standalone skill — no frontmatter.

## What this step does

Writes a `.mcp.json` file in the workspace root (the user's current working directory) so that Claude Code, on the next session start or MCP reconnect, spawns the `formio-mcp` server against the correct Form.io project. Without this step, the MCP server runs against whatever env Claude Code was started with — usually nothing, or a stale project URL — and Step 5 (Import) either fails or imports into the wrong project.

This step exists for the "no plugin" path only. See the skip rule below — when the `@formio/ai` Claude Code plugin is providing the MCP server, `.mcp.json` is redundant and this step is skipped entirely.

## Skip rule — plugin mode

**If the `formio-mcp` server is already provided by the `@formio/ai` Claude Code plugin, skip this step entirely. Do NOT write `.mcp.json`, do NOT prompt for approval, do NOT halt for a restart.**

Detection: the plugin installs the MCP server under a plugin-namespaced name and ships a verify-project-url hook that gates Form.io tool calls on a cwd→projectUrl mapping in `~/.formio/projects.json`. If any of the following are true, you are in plugin mode:

- MCP tools are visible under the `mcp__plugin_formio-ai_formio-mcp__*` namespace (e.g., `mcp__plugin_formio-ai_formio-mcp__project_set`, `mcp__plugin_formio-ai_formio-mcp__project_import`).
- The verify-project-url hook injected a "No project mapped for `<cwd>`" message, or `project_set` succeeded earlier in the conversation — both prove the plugin's server is live.
- `~/.formio/projects.json` exists and is being consulted by the gate (the hook lives at `plugin/hooks/verify-project-url.mjs`).

Under plugin mode, per-cwd routing is handled entirely by `project_set({ cwd, projectUrl })` writing `~/.formio/projects.json`. The plugin's MCP server reads that mapping at tool-call time — no env-var plumbing, no restart, no `.mcp.json` needed. Step 3 (Deployment) already called `project_set`, so routing is live and the skill proceeds directly to Step 5 (Import) in the same invocation.

Tell the user:

> Plugin detected — skipping `.mcp.json` write. The plugin's MCP server picks up the project mapping you just set via `project_set`. Continuing to Step 5 (Import).

The rest of this document describes the "no plugin" path — user-authored `.mcp.json` with explicit env vars. Only follow it when plugin-mode detection above fails.

## Env-var naming — read this first

There are two names for the platform deployment URL in this repo:

| Where                                                        | Name                  | Why                                                                                                          |
| ------------------------------------------------------------ | --------------------- | ------------------------------------------------------------------------------------------------------------ |
| Orchestrator internal state (set in Step 2, `DEPLOYMENT.md`) | `FORMIO_BASE_URL` | Matches the skills-library convention — the platform deployment URL the `formio-api` skill documents under its platform-scope references. |
| Written into `.mcp.json` `env` block                         | `FORMIO_BASE_URL`     | Matches the existing `.mcp.json` / `example/.mcp.json` precedent that already ships in this repo.            |

They are two names for the **same concept** (the platform deployment URL, e.g., `https://form.io`). This step performs the mapping: it reads `FORMIO_BASE_URL` from orchestrator state and writes it under the key `FORMIO_BASE_URL`. `FORMIO_PROJECT_URL` is the same name in both places.

## `.mcp.json` shape

The skill writes (or merges into) a file like this:

```json
{
  "mcpServers": {
    "formio-mcp": {
      "command": "npx",
      "args": ["-y", "@formio/mcp"],
      "env": {
        "FORMIO_BASE_URL": "<FORMIO_BASE_URL from Step 2>",
        "FORMIO_PROJECT_URL": "<FORMIO_PROJECT_URL from Step 2>"
      }
    }
  }
}
```

Any other `mcpServers` entries the user already had (unrelated MCP servers) are preserved as-is.

## Default command selection

The skill writes a single npm-based default:

```
command: "npx"
args:    ["-y", "@formio/mcp"]
```

This is a **placeholder** default until `@formio/mcp` publishes to npm — the command will fail to spawn until the package is published. The approval preview flags this so the user can tweak the command before approving. Once `@formio/mcp` publishes, the default JustWorks and no warning is needed.

If an existing `./.mcp.json` already has a `formio-mcp` entry with custom `command` / `args`, preserve them — the user has chosen their setup deliberately; only the `env` block needs rewriting.

### Escape-hatch: point at a local clone (npm-only)

For contributors who have this repo cloned and want `.mcp.json` to point at their local checkout (e.g., testing unreleased changes), edit the emitted `.mcp.json` by hand after the approval gate. Two npm-only variants:

- Run the TypeScript source directly:
  ```json
  "command": "npx",
  "args": ["-y", "tsx", "<absolute-path>/packages/mcp-server/src/stdio.ts"]
  ```
- Run the compiled build (after `cd packages/mcp-server && npm install && npm run build`):
  ```json
  "command": "node",
  "args": ["<absolute-path>/packages/mcp-server/dist/stdio.js"]
  ```

Both are opt-in — the skill does NOT emit these automatically. The user edits `.mcp.json` after the skill's approval gate (or declines and writes their own).

## Collision handling (merge semantics)

Before writing, read the existing `./.mcp.json` if one is present. Apply this merge:

1. If `.mcpServers.formio-mcp` exists in the file:
   - **Preserve** its `command` field.
   - **Preserve** its `args` array.
   - **Preserve** all `env` keys that are NOT `FORMIO_PROJECT_URL` or `FORMIO_BASE_URL` (e.g., `FORMIO_API_KEY`, `FORMIO_LOGIN_FORM`, `FORMIO_INSECURE_TLS` — the user may have set these intentionally).
   - **Rewrite** `env.FORMIO_PROJECT_URL` to the Step-2 captured Project URL.
   - **Rewrite** `env.FORMIO_BASE_URL` to the Step-2 captured Base URL (= orchestrator `FORMIO_BASE_URL`).
2. If `.mcpServers.formio-mcp` does NOT exist:
   - Add a new entry with the default command (per "Default command selection" above) and the two env vars.
3. **Preserve** all other entries under `.mcpServers` (unrelated MCP servers like `github`, `slack`, etc.).

If `./.mcp.json` does not exist, create it with a single `formio-mcp` entry using the default command.

## Skip rule

If the merge would produce identical content to what is already on disk — specifically, `./.mcp.json` already has a `formio-mcp` entry whose `env.FORMIO_PROJECT_URL` and `env.FORMIO_BASE_URL` match the Step-2 captures exactly — skip this step entirely. Tell the user:

> Skipping MCP Config — `./.mcp.json` already points at this project. Continuing to Step 4.

When the step is skipped, no restart is required. The skill proceeds to Step 4 (Authenticate) in the same invocation.

## Approval gate — preview then write

Before writing, print the FULL merged `.mcp.json` as a fenced `json` block. If the default command was chosen because no existing entry was found, include a one-line flag in the preview noting that this is the npm placeholder default until `@formio/mcp` publishes:

````
About to write ./.mcp.json:

```json
{
  "mcpServers": {
    "formio-mcp": {
      "command": "npx",
      "args": ["-y", "@formio/mcp"],
      "env": {
        "FORMIO_BASE_URL": "https://form.io",
        "FORMIO_PROJECT_URL": "https://mycompany.form.io"
      }
    }
  }
}
````

(Command default: `npx -y @formio/mcp` — placeholder until the package publishes to npm. If you run the MCP server differently, edit the
command/args after writing — the env block is what matters for routing.)

If you approve:

1. The file will be written.
2. You must restart Claude Code (restart this session, or run `/mcp` to
   reconnect the `formio-mcp` server if supported in your Claude Code
   version) for the new env to take effect.
3. Once reconnected, re-invoke this skill (or tell me to continue) — I'll
   resume from Step 4 (Authenticate).

Proceed?

```

On decline, do not touch the file; exit the step without advancing.

## After approval — write, then halt

Write the merged file. Print the restart/reconnect instruction (same text as in the preview). **Halt the current invocation.** Do NOT advance to Step 4 in the same session — Claude Code's MCP servers are spawned at session start; the new env will only take effect after a restart or `/mcp` reconnect.

If the step was skipped (see Skip rule), there is no halt — the session continues to Step 4.

## `.gitignore` note

`.mcp.json` contains the Project URL, which may identify your Form.io deployment. For public repositories, add `.mcp.json` to `.gitignore`. Do not modify `.gitignore` automatically from this skill — that is the user's call. Surface the suggestion in the approval preview as a one-line tip.

## Where the file goes

`process.cwd()` — the directory the user was in when they invoked the skill. Claude Code looks for `.mcp.json` in the workspace root, which is the same directory.
```
