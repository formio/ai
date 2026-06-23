---
'@formio/mcp': patch
'@formio/ai': patch
---

Check cached JWT expiry locally before use. The MCP server now decodes a cached
token's `exp` claim and clears expired tokens — both from the on-disk cache and
the in-process cache — before attempting any request, triggering re-auth instead
of thrashing on failing calls with a known-dead token.
