# Installation instructions for AI agents

This file is for an AI assistant installing the Form.io MCP server on a user's behalf. If you are a human, read [README.md](./README.md) instead.

There are two products in this repository. Pick one based on what the user asked for.

## Which one to install

- **The user wants Form.io tools plus the skill library** (they said "install the Form.io plugin", "add Form.io to Claude Code", or want to *build applications* backed by Form.io) → install the **Claude Code plugin**, below. It bundles the MCP server, so do not install both.
- **The user wants only the MCP tools** (they named `@formio/mcp`, said "just the MCP server", or use a non-Claude-Code client such as Cursor, VS Code, Windsurf, or Cline) → install the **standalone MCP server**, below.

## Required configuration

Both paths need one value, and you must ask the user for it — do not guess:

- **`FORMIO_PROJECT_URL`** (required) — the full URL of the Form.io project to target, e.g. `https://api.form.io/my-project`, or `https://your-host/project-name` when self-hosted.
- **`FORMIO_BASE_URL`** (optional) — the parent of the project URL. Defaults to `https://api.form.io`. Set it only when self-hosting or using Form.io Enterprise.

Do **not** set `FORMIO_API_KEY` unless the user explicitly provides one. Authentication defaults to a browser-based portal-login flow triggered on the first authenticated tool call, which is the intended path and requires no stored secret. Never invent an API key value or commit one to a file.

`FORMIO_INSECURE_TLS=1` disables TLS certificate verification. Only set it if the user explicitly asks, for local development against a self-signed certificate. Never enable it otherwise.

## Option A — Claude Code plugin

Run these **inside Claude Code** (they are slash commands, not shell commands):

```
/plugin marketplace add https://github.com/formio/ai.git
/plugin install formio-ai@formio
```

Claude Code prompts for the Project URL and Base URL during install, so you do not need to write any config file — the plugin registers its own MCP server. Claude Code must be restarted before the server becomes available.

## Option B — standalone MCP server

The server is published as [`@formio/mcp`](https://www.npmjs.com/package/@formio/mcp) and listed in the official MCP Registry as `io.form/formio-mcp`. If the client can install from that registry, prefer it — it needs no hand-written config.

Otherwise write this block into the client's MCP config file, replacing the project URL with the user's:

```json
{
  "mcpServers": {
    "formio-mcp": {
      "command": "npx",
      "args": ["-y", "@formio/mcp"],
      "env": {
        "FORMIO_PROJECT_URL": "https://your-project.form.io"
      }
    }
  }
}
```

Config file locations:

| Client | Path |
| ------ | ---- |
| Claude Code | `.mcp.json` in the project root |
| Claude Desktop | macOS `~/Library/Application Support/Claude/claude_desktop_config.json`, Windows `%APPDATA%\Claude\claude_desktop_config.json` |
| Cursor | `.cursor/mcp.json` (project) or `~/.cursor/mcp.json` (global) |
| VS Code (Copilot) | `.vscode/mcp.json` |
| Windsurf | `~/.codeium/windsurf/mcp_config.json` |
| Cline | `cline_mcp_settings.json` |

Merge into any existing `mcpServers` object rather than overwriting the file.

## Verifying the install

Call the `hello` tool — it needs no authentication and confirms the server is reachable. Then call `form_list`, which triggers the login flow on first use.

If `form_list` fails with a missing-configuration error, `FORMIO_PROJECT_URL` is unset or wrong. Requires Node.js 20 or newer.
