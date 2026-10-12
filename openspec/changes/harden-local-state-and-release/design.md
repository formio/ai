## Context

- `project-map.ts` writes `~/.formio/projects.json` with a read-modify-write and `fs.writeFileSync` in place; lookups key by `path.resolve(cwd)` exact match. The token cache was made atomic in #93; the map was not.
- `formio-client.ts` sets `process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'` at import time when `FORMIO_INSECURE_TLS` is true.
- `auth.ts` serves a login page whose script posts `{ token }` to `/callback`; `/callback` accepts the first non-empty token. The page embeds the login-form URL as `'${loginFormUrl}'`.
- `.github/workflows/release.yml` installs `npm@latest`, downloads `mcp-publisher` from `releases/latest`, runs `npx @smithery/cli@latest`, and references actions by tag. The Docker build context is `packages/mcp-server`, where there is no lockfile, so `npm install` resolves the caret ranges at build time.
- The npm `files` are `dist` and `README.md`; LICENSE is at the repository root only. `build` is `tsc -p tsconfig.build.json`, which never removes outputs. `cli-launch.ts` reads the version from `../package.json`, which the esbuild bundles (`.mcpb`, plugin) do not contain, so they fall back to `0.0.0`.

## Goals / Non-Goals

**Goals:** no lost or partial map writes across processes; a mapping applies under its directory and survives path spelling differences; certificate settings confined to the deployment they are for; a login completes only with the page's own post; a release that repeats the previous one when the repository has not changed; a complete package that reports its version.

**Non-Goals:** changing resolution precedence; rewriting existing map entries; the planner, skills, or tool surface.

## Decisions

**1. Lock file + atomic rename for the map.**
Writers create `projects.json.lock` with `fs.openSync(path, 'wx')`, retrying every 50 ms for up to 5 s; a lock whose mtime is older than 10 s is removed and retried (a crashed writer). Under the lock: re-read, apply, write `projects.json.<pid>.<random>.tmp` (mode 0600), `renameSync` over the map, then remove the lock (in `finally`). Readers take no lock — rename makes every read see a complete file. The token cache's writer from #93 is reused for the temp-file-and-rename step.
*Alternative:* advisory `flock` — rejected, not available in Node without a native addon, and not on Windows.

**2. Canonical, ancestor-aware lookup.**
`canonicalDir(dir)`: on Windows convert `/x/...` to `X:\...`; `fs.realpathSync.native` when the path exists (resolves symlinks and, on macOS and Windows, returns the stored case), else `path.resolve`; then lower-case on `darwin` and `win32`. Lookup canonicalizes the query, walks from it to the filesystem root, and at each level matches against the canonical form of every stored key (computed once per read). The nearest match wins. Writes store the canonical form. Nothing on disk is migrated: old keys are canonicalized on read.
*Alternative:* stop the walk at a `.git` boundary like the committed-file walk — rejected; a user who maps a repository root and opens a nested worktree or a non-git folder under it expects the mapping to apply, and a nearer mapping still wins.

**3. Scoped certificate setting via a dispatcher.**
Node's `fetch` accepts a `dispatcher`. One `undici.Agent({ connect: { rejectUnauthorized: false } })` is created lazily and passed only for requests whose host equals the resolved project or Base URL host, and only when `FORMIO_INSECURE_TLS` is true. `undici` is added as a dependency at the major Node 22 bundles, so the `Agent` and `fetch` agree. `NODE_TLS_REJECT_UNAUTHORIZED` is no longer touched.

**4. Per-login value on the callback.**
`crypto.randomBytes(16).toString('hex')` per login, embedded in the page with `JSON.stringify`, sent back as `{ token, state }`, compared with `crypto.timingSafeEqual`. A mismatch is `403` and the server keeps listening; the login still ends at its timeout. The login-form URL is embedded with `JSON.stringify` as well.

**5. Pinned release tools.**
Actions referenced as `uses: owner/repo@<40-hex> # vX.Y.Z`. `npm@<x.y.z>`, `@smithery/cli@<x.y.z>`, and `mcp-publisher` from `releases/download/v<x.y.z>/...` with `sha256sum -c` against values written in the workflow. Versions are the ones in use at the time of the change; updating them is a reviewed edit. A test reads the workflow and fails on `@latest`, `/latest/`, or a non-SHA action reference.

**6. Docker from the lockfile.**
The build context moves to the repository root; the builder stage runs `corepack enable`, `pnpm install --frozen-lockfile --filter @formio/mcp...`, builds, and `pnpm deploy --filter @formio/mcp --prod /out` for the runtime stage. The image's entrypoint is unchanged.

**7. Package contents and version.**
`files` adds `LICENSE`; a `prepack` copies the root LICENSE into the package directory (and the copy is ignored by git), so the tarball always carries the current text. `build` becomes `node -e "fs.rmSync('dist',{recursive:true,force:true})" && tsc -p tsconfig.build.json` (cross-platform). `cli-launch.ts` reads a build-time constant (`__FORMIO_MCP_VERSION__`, set by esbuild `define` in both bundle scripts) and falls back to `package.json` for the `tsc` build. `server.json` gains the three `FORMIO_AUTH_*` entries, and a test compares the variables read in `src` with those declared.

## Risks / Trade-offs

- [A lock left by a crashed writer] → Abandoned after 10 s; writes are milliseconds.
- [Case-folding on a case-sensitive macOS volume] → Two directories differing only by case would share a mapping; such volumes are rare and the nearer explicit mapping still wins.
- [undici version drift from Node's bundled copy] → Pinned to the bundled major; the scoped dispatcher is exercised in tests against a local HTTPS server with a self-signed certificate.
- [Pinned tools age] → Updating a pin is a reviewed one-line change; the test keeps it pinned.

## Migration Plan

No on-disk changes: old map entries are canonicalized on read. Ships under the pending 1.0 release; rollback is a revert.

## Open Questions

None.
