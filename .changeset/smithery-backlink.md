---
'@formio/mcp': patch
---

Add the Smithery backlink to the server README.

Smithery's validation step scans the README, homepage, or a custom URL for a link back to the listing and reported finding none, which costs listing score. The badge now sits in `packages/mcp-server/README.md`, which is the file packed into the `.mcpb` as its README — so the link travels with the bundle rather than depending on the scanner reaching GitHub.
