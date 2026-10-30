## 1. The release publishes nothing to Smithery
<!-- depends_on: none -->

### Red

- [x] 1.1 `release-channels.test.ts`: no step of `.github/workflows/release.yml` publishes to Smithery or reads `SMITHERY_API_KEY`
- [x] 1.2 `mcpb-build.test.ts`: `pnpm build:mcpb` produces `dist/formio-mcp.mcpb` and no `dist/formio-mcp.smithery.mcpb` (replacing 1.12)

### Green

- [x] 1.3 Remove the "Publish the bundle to Smithery" step from the release workflow, and Smithery from its comments
- [x] 1.4 Build one bundle in `scripts/build-mcpb.ts`: remove `packSmithery` and its paths

### Refactor

- [x] 1.5 Remove `smithery.yaml`; update the comments that cite Smithery in the build script and the tests
