## Why

Smithery shuts down its connection services on October 31, 2026 (https://smithery.ai/future): its API, CLI, accounts and hosted server URLs stop working, and only a public, non-proxied directory remains. Publishing updates through its API is already refused, so the release workflow's Smithery step failed the `@formio/ai` 1.1.0 release with `403 {"error":"Updating servers has been removed. Contact support@smithery.ai."}` and skipped the Docker Hub decision after it. It will fail every release from now on.

## What Changes

- The release workflow no longer publishes the `.mcpb` bundle to Smithery, and no longer reads `SMITHERY_API_KEY`.
- `scripts/build-mcpb.ts` builds one bundle, `dist/formio-mcp.mcpb`. The `.smithery.mcpb` variant, which existed only to satisfy Smithery's manifest validation, is no longer built.
- `smithery.yaml` is removed.
- The Smithery badges in the READMEs stay: the directory listing remains, frozen at its last version. Removing the badge from `packages/mcp-server/README.md` would need an `@formio/mcp` release, so it can go with the next one.

## Capabilities

### New Capabilities

### Modified Capabilities

- `claude-plugin-release`: Smithery is no longer one of the channels the workflow publishes on every release.

## Impact

- `.github/workflows/release.yml`, `scripts/build-mcpb.ts`, `smithery.yaml`.
- Tests: `packages/mcp-server/src/__tests__/mcpb-build.test.ts`, a new `release-channels.test.ts`, and the comment in `release-waits-for-npm.test.ts`.
- No published package changes: the npm tarballs and the `.mcpb` attached to the GitHub release are as before.
