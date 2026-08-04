---
'@formio/mcp': patch
---

Declare the server's tools in the `.mcpb` manifest.

Directories that ingest the bundle read `manifest.tools` rather than launching the server: Smithery's listing reported no tools at all, because the manifest left discovery to runtime (`tools_generated: true`, no `tools` key). The list is now generated during the build by running the freshly bundled server and calling `tools/list`, so it stays accurate without being maintained by hand — a tool added in code appears on the next build. The build fails if the server lists nothing, rather than shipping a manifest that quietly claims no tools.
