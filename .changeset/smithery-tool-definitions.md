---
'@formio/mcp': patch
---

Give Smithery a bundle whose tool definitions it accepts.

Declaring tools in the `.mcpb` manifest made the Smithery publish fail with a 400 — `expected object, received undefined`, once per tool. Its CLI copies `manifest.tools` verbatim into the serverCard it uploads and validates against the MCP `Tool` type, so entries need an `inputSchema`. The MCPB schema permits only `name` and `description` per tool and rejects an `inputSchema` outright, so no single manifest satisfies both.

The build now emits two archives wrapping identical server bytes: `formio-mcp.mcpb`, packed and validated by `mcpb pack` and attached to the GitHub release, and `formio-mcp.smithery.mcpb`, carrying the full definitions (input and output schemas plus annotations) for Smithery. If the MCPB schema ever admits full tool definitions the two collapse back into one.
