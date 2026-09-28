---
'@formio/mcp': minor
'@formio/ai': minor
---

**Breaking: Node.js 22.12 or newer is now required.** Node 20 reached end-of-life in April 2026, and the toolchain this repository builds and tests with (Vitest 5, jsdom 30, Changesets 3) no longer runs on it.

`engines.node` is `>=22.12` in every package, the `.mcpb` manifest declares the same runtime range, both bundles (`dist/plugin/server/stdio.mjs` and the `.mcpb` server) are compiled for `node22`, CI tests on Node 22, and `@types/node` tracks 22 so no API newer than the floor type-checks. A new test holds all of them to the root `engines` field.
