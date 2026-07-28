---
'@formio/mcp': patch
---

Register the server in the official MCP Registry as `io.form/formio-mcp`. Adds the `mcpName` field that the registry uses to verify npm ownership, a root `server.json` describing the stdio transport and supported environment variables, and a release-workflow step that publishes to the registry after npm.
