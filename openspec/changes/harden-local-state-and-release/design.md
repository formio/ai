## Context

- `project-map.ts` writes `~/.formio/projects.json` with a read-modify-write and `fs.writeFileSync` in place; lookups key by `path.resolve(cwd)` exact match. The token cache was made atomic in #93; the map was not.
- `formio-client.ts` sets `process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'` at import time when `FORMIO_INSECURE_TLS` is true.
- `auth.ts` serves a login page whose script posts `{ token }` to `/callback`; `/callback` accepts the first non-empty token. The page embeds the login-form URL as `'${loginFormUrl}'`.
- The Docker build context is `packages/mcp-server`, where there is no lockfile, so `npm install` resolves the caret ranges at build time.
- The npm `files` are `dist` and `README.md`; LICENSE is at the repository root only. `build` is `tsc -p tsconfig.build.json`, which never removes outputs. `cli-launch.ts` reads the version from `../package.json`, which the esbuild bundles (`.mcpb`, plugin) do not contain, so they fall back to `0.0.0`.

## Goals / Non-Goals

**Goals:** no lost or partial map writes across processes; a mapping applies under its directory and survives path spelling differences; certificate settings confined to the deployment they are for; a login completes only with the page's own post; a Docker image built from the tested lockfile; a complete package that reports its version.

**Non-Goals:** changing resolution precedence; rewriting existing map entries; the planner, skills, or tool surface.

## Decisions

**1. Lock file + atomic rename for the map.**
Writers create `projects.json.lock` with `fs.openSync(path, 'wx')` and write an owner token into it — the process id and a random UUID, unique to that acquisition — retrying every 50 ms for up to 5 s. A lock whose mtime is older than 3 s was left by a crashed writer; it is broken by renaming it to a unique `projects.json.lock.<uuid>.stale` and then unlinking that file. Of several waiters that judge one lock stale, only one rename succeeds; the others get `ENOENT` and go back to acquiring. The breaker then checks that the file it moved is the lock it judged (same token, still older than 3 s); if another writer took the lock between the check and the rename, that lock is linked back into place (`fs.linkSync`, which fails if a third writer already holds the name). Under the lock: re-read, apply, write `projects.json.<pid>.<random>.tmp` (mode 0600), `renameSync` over the map, then release in `finally`: the holder unlinks the lock only while it still holds its own token, so a writer that outlived the stale limit leaves a successor's lock alone. Readers take no lock — rename makes every read see a complete file. The token cache's writer from #93 is reused for the temp-file-and-rename step.
The stale limit (3 s) is below the wait (5 s), so a waiter that meets a crashed writer's lock clears it within its own wait rather than failing first. A write holds the lock for milliseconds.
The wait stays synchronous (`Atomics.wait` between attempts): `project set` and the tools share one writer, and the CLI is synchronous throughout.
On Windows a rename over a file another process briefly holds open (a scanner, an indexer, a reader) fails with `EPERM`, `EBUSY` or `EACCES`; the atomic writer retries such a rename up to five times with a growing pause of 20 ms per attempt, and an `EPERM` from the exclusive create of the lock (a lock file still being deleted) is treated as a held lock.
*Alternative:* advisory `flock` — rejected, not available in Node without a native addon, and not on Windows.

**2. Canonical, ancestor-aware lookup within a repository.**
`canonicalDir(dir)` is the canonical path in its true case: on Windows convert `/x/...` to `X:\...`; `path.resolve`; then `fs.realpathSync.native` on the part of the path that exists (resolves symlinks and, on a case-insensitive volume, returns the stored case), with any part not yet created appended as given. It is what a write stores as the key, what messages show, and what directories are compared by — exactly, because the real path already carries the stored case where the volume folds case and keeps `Foo` and `foo` apart where it does not. A stored key whose directory no longer exists has no real path to ask for, so on `darwin` and `win32` it alone is compared case-insensitively. Lookup walks from the query's canonical path toward the root and stops at the first directory, the start included, that contains `.git` — the same boundary as the committed `formio.json` walk — so a mapping recorded above a repository does not reach into it; without any `.git` the walk runs to the filesystem root. The nearest match wins and is reported under its stored key. A write stores `canonicalDir` and replaces any stored key naming the same directory under these rules, so no twin is left and a case-twin directory's entry is kept. Nothing on disk is migrated: old keys are compared on read and keep their spelling.
A directory with no entry of its own that restates the pair its governing ancestor's mapping supplies is reported unchanged, naming that ancestor, and nothing is written; a different pair is recorded as the directory's own entry. An ancestor's `forced` flag is never copied onto a child entry: a child is forced only by `project set --force` for that directory.
*Read cache.* A reader keeps the parsed map and the comparison index of its stored keys keyed by the file's `mtimeMs`, `size` and `ino` (the same fingerprint `readCacheSnapshot` uses for the token cache) and reuses them until the file changes; every write renames a new file into place, so it changes the fingerprint. Writes read afresh under the lock. The index records whether each stored directory existed when the file was read, so a stored directory created or removed later is compared under the new rule once the map next changes or the process restarts.
*Alternative:* walk to the filesystem root regardless of `.git` — rejected: a mapping on a parent folder such as `~/code` would govern every repository cloned beneath it, which is the failure the committed-file boundary already prevents.

**3. Scoped certificate setting via a dispatcher.**
Node's `fetch` accepts a `dispatcher`. One `undici.Agent({ connect: { rejectUnauthorized: false } })` is created lazily and passed only for requests whose host equals the resolved project or Base URL host, and only when `FORMIO_INSECURE_TLS` is true. `undici` is added as a dependency at the major Node 22 bundles, so the `Agent` and `fetch` agree. `NODE_TLS_REJECT_UNAUTHORIZED` is no longer touched.

**4. Per-login value on the callback.**
`crypto.randomBytes(16).toString('hex')` per login, embedded in the page with `JSON.stringify`, sent back as `{ token, state }`, compared with `crypto.timingSafeEqual`. A mismatch is `403` and the server keeps listening; the login still ends at its timeout. The login-form URL is embedded with `JSON.stringify` as well.
Which requests the login server answers on `GET /` and `POST /callback` depends on where it is bound. Bound to loopback (the default, or `FORMIO_AUTH_HOST` naming a loopback address) it answers only a `Host` of `localhost`, `127.0.0.1` or `[::1]` at its own port. Bound to every interface (`0.0.0.0` / `::`) the user has opted into access from another host — a devcontainer or Codespaces forwarded port is served under a name such as `<name>-<port>.app.github.dev` and a port the server cannot know — so the `Host` header is not checked, and the per-login value on `/callback` is what ties a post to this login. Bound to a specific other host it answers that host or a loopback name at any port, since forwarding may remap the port. A refused request is `403` and the login keeps waiting.

**5. Release tools stay unpinned.** *(Maintainer decision, 2026-10-12.)*
The release workflow keeps installing `npm`, `@smithery/cli` and `mcp-publisher` at their latest releases and referencing actions by tag. skills.sh scans only the skill directories, so these pins would not affect its results; the pins that do — `@formio/mcp@<version>` in `formio-mcp-setup` and the plugin manifests — are unchanged.

**6. Docker from the lockfile.**
The build context moves to the repository root; the builder stage runs `corepack enable`, `pnpm install --frozen-lockfile --filter @formio/mcp...`, builds, and `pnpm deploy --filter @formio/mcp --prod /out` for the runtime stage. The image's entrypoint is unchanged.

**7. Package contents and version.**
`files` adds `LICENSE`; a `prepack` copies the root LICENSE into the package directory (and the copy is ignored by git), so the tarball always carries the current text. `build` becomes `node -e "fs.rmSync('dist',{recursive:true,force:true})" && tsc -p tsconfig.build.json` (cross-platform). `cli-launch.ts` reads a build-time constant (`__FORMIO_MCP_VERSION__`, set by esbuild `define` in both bundle scripts) and falls back to `package.json` for the `tsc` build. `server.json` gains the three `FORMIO_AUTH_*` entries, and a test compares the variables read in `src` with those declared.

## Risks / Trade-offs

- [A lock left by a crashed writer] → Abandoned after 3 s, inside the 5 s wait; writes are milliseconds.
- [A breaker moves a lock taken a moment earlier] → It checks the moved file and links it back. If a third writer creates a lock in the microseconds between that move and the link-back, two writers can hold locks at once; this needs a crashed writer and three simultaneous writers.
- [A stored directory created or deleted after the map was read] → The cached index compares it under the old rule until the map file next changes or the process restarts.
- [undici version drift from Node's bundled copy] → Pinned to the bundled major; the scoped dispatcher is exercised in tests against a local HTTPS server with a self-signed certificate.

## Migration Plan

No on-disk changes: old map entries are canonicalized on read. Ships under the pending 1.0 release; rollback is a revert.

## Open Questions

None.
