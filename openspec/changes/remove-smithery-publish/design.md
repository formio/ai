## Context

The release job publishes `@formio/mcp` and `@formio/ai` to npm, then runs, in order: the MCP Registry publish, the `.mcpb` build, the GitHub release, the Smithery publish, and the Docker Hub decision. A failing step fails the job, so the Smithery 403 also skipped the Docker Hub decision. The `.mcpb` build packs two archives: the spec-valid bundle `mcpb pack` validates, and a `.smithery.mcpb` whose manifest carries full tool definitions, because Smithery's CLI refused manifest tools without an `inputSchema`.

## Decisions

- **Remove the step, rather than make it non-fatal.** Smithery's publishing API is gone for good, so a step that cannot succeed has nothing left to protect. Keeping it as a no-op would leave a dead secret and dead code behind.
- **Build one bundle.** The Smithery variant had no other consumer. `readToolsFromServer` keeps checking that every tool has a name, a description and an `inputSchema`: the manifest still lists the tools, and an empty or broken list should still fail the build.
- **Keep the README badges for now.** The directory listing stays up after the shutdown, so the links work. `packages/mcp-server/README.md` ships in the npm package, and `pnpm check:releases` would require an `@formio/mcp` release to change it, which would also release the plugin. It can change with the next server release.
