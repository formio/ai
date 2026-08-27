---
'@formio/ai': patch
---

`formio-mcp-setup` now writes the MCP configuration for the client it is actually running in, instead of writing all four every time. The host is established from the agent's own identity, then from one question naming the four clients plus "not sure"; only when neither answers does it fall back to writing `.mcp.json`, `.cursor/mcp.json`, `.vscode/mcp.json`, and `.codex/config.toml` together. A workspace's existing `.vscode/`, `.cursor/`, or `.claude/` directory is explicitly ruled out as a signal — it says somebody once opened the workspace in that editor, not what is running now. Every other skill's preflight paragraph was updated to match.
