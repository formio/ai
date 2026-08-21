# Installation instructions for AI agents

This file is for an AI assistant installing the Form.io MCP server on a user's behalf. If you are a human, read [README.md](./README.md) instead.

This repository ships a skill library and an MCP server. They are usually installed together.

## Which route to use

- **The agent you are installing into has a plugin marketplace** (Claude Code, Cursor, GitHub Copilot CLI, VS Code, Codex) → install the **plugin**, below. One step, and it carries the skills *and* the MCP server. Do not then also run the skills installer; the plugin already includes them.
- **Anything else, or you are not sure** → run `npx skills add formio/ai`. That installs the skill library to `.agents/skills/`, which every skills-capable agent reads. It installs **skills only** — no MCP configuration — so also follow the *Connect the MCP server* section below, or simply let the bundled `formio-mcp-setup` skill do it on the user's first Form.io request.

## Required configuration

**None.** Do not block the install to collect values, and do not guess them.

The server starts with no configuration at all, lists its tools, and raises an actionable error naming the `project_set` tool the first time a tool actually needs a project. So the correct flow is: install, then let the agent ask which project to use.

Two values exist if the user volunteers them or asks to pin a project:

- **`FORMIO_PROJECT_URL`** — the full URL of the Form.io project, e.g. `https://myproject.form.io`, or `https://your-host/project-name` when self-hosted.
- **`FORMIO_BASE_URL`** — the parent of the project URL. Defaults to `https://api.form.io`. Set it only when self-hosting or using Form.io Enterprise.

Do **not** set `FORMIO_API_KEY` unless the user explicitly provides one. Authentication defaults to a browser-based portal-login flow triggered on the first authenticated tool call, which is the intended path and requires no stored secret. Never invent an API key value or commit one to a file.

`FORMIO_INSECURE_TLS=1` disables TLS certificate verification. Only set it if the user explicitly asks, for local development against a self-signed certificate. Never enable it otherwise.

## Option A — plugin install

Every client with a marketplace reads this repository's plugin. The commands differ per client; in Claude Code they are slash commands, not shell commands:

```
/plugin marketplace add https://github.com/formio/ai.git
/plugin install formio-ai@formio
```

In Cursor, add the plugin from its Customize panel; in GitHub Copilot CLI, `copilot plugin marketplace add formio/ai` then `copilot plugin install formio-ai`; in VS Code, *Chat: Install Plugin From Source* with the repository URL.

The plugin registers its own MCP server, so no config file is needed. Install-time prompts are the Base URL and nothing else — Claude Code and Cursor both ask for it, and it is not required, because the agent asks for a project when one is first needed and records it for that working directory. The client must be reloaded before the server becomes available.

## Option B — standalone MCP server

The server is published as [`@formio/mcp`](https://www.npmjs.com/package/@formio/mcp) and listed in the official MCP Registry as `io.form/formio-mcp`. If the client can install from that registry, prefer it — it needs no hand-written config.

Otherwise write this block into the client's MCP config file, replacing the project URL with the user's:

```json
{
  "mcpServers": {
    "formio-mcp": {
      "command": "npx",
      "args": ["-y", "@formio/mcp@0.11.0"],
      "env": {
        "FORMIO_PROJECT_URL": "https://your-project.form.io"
      }
    }
  }
}
```

Config file locations, and the top-level key each one expects — they are not all the same, so check both columns:

| Client | Path | Top-level key |
| ------ | ---- | ------------- |
| Claude Code | `.mcp.json` in the project root | `mcpServers` |
| Claude Desktop | macOS `~/Library/Application Support/Claude/claude_desktop_config.json`, Windows `%APPDATA%\Claude\claude_desktop_config.json` | `mcpServers` |
| Cursor | `.cursor/mcp.json` (project) or `~/.cursor/mcp.json` (global) | `mcpServers` |
| VS Code (Copilot) | `.vscode/mcp.json` | **`servers`** — not `mcpServers` |
| Codex / ChatGPT | `.codex/config.toml` (project) or `~/.codex/config.toml` (global) | TOML `[mcp_servers.formio-mcp]` |
| Windsurf | `~/.codeium/windsurf/mcp_config.json` | `mcpServers` |
| Cline | `cline_mcp_settings.json` | `mcpServers` |

Merge into the existing object rather than overwriting the file. For VS Code, put the server under `servers`. For Codex, write TOML instead of JSON:

```toml
[mcp_servers.formio-mcp]
command = "npx"
args = ["-y", "@formio/mcp@0.11.0"]
```

There is no universal `.mcp.json`: a root `.mcp.json` is read by Claude Code only. Writing one file per client is the reliable approach when you do not know which client the user runs.

## Connect the MCP server

The skills installer never writes MCP configuration — it handles skills only. There is no universal MCP config file either, so either let the `formio-mcp-setup` skill handle it (it writes every client's file, asks for approval, and explains the reload), or write the file for the client you know you are in, using the table above.

Whichever way, the entry is the same command with no environment block required:

```json
{ "command": "npx", "args": ["-y", "@formio/mcp@0.11.0"] }
```

After writing any MCP configuration, tell the user to reload: MCP servers are read at session start, not at tool-call time.

If the user has volunteered a project URL, you can record it before the reload so the first tool call works:

```sh
npx -y @formio/mcp@0.11.0 project set --project-url <url> --base-url <url> --cwd <absolute path>
npx -y @formio/mcp@0.11.0 project get --cwd <absolute path>
```

`project get` prints what the server resolves and which source supplied it. Empty output is not an answer: the `project` command shipped in 0.9.0, and an older `@formio/mcp` ignores these arguments, starts its stdio server, reads end-of-input and exits 0 with no output — a silent no-op that reads as success. Do not invent either URL — if the user has not given them, skip this and let the agent ask when a project is first needed.

## Verifying the install

Call the `hello` tool — it needs no authentication and confirms the server is reachable. Then call `form_list`, which triggers the login flow on first use.

If `form_list` fails with a missing-configuration error, `FORMIO_PROJECT_URL` is unset or wrong. Requires Node.js 20 or newer.
