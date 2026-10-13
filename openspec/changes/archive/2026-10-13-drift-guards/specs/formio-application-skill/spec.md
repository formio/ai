## REMOVED Requirements

### Requirement: New `authenticate` MCP tool

**Reason**: The server registers no `authenticate` tool; the first tool call that needs a token starts the browser-based portal login on its own, and every skill documents that behaviour.
**Migration**: None — no skill or client calls the tool.
