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

**1. Lock file + atomic rename for the map and the token cache.**
One helper in `atomic-file.ts`, `updateFileLocked({ filePath, read, update, write, lockFailure, lock, sleep })`, is the locked read-modify-write for every file several processes share: `projects.json` (`writeProjectEntry`, `removeProjectEntry`) and `mcp-tokens.json` (`saveToken`, `clearToken`, `signOut`). The same module holds the file fingerprint (`fingerprintOf`, `sameFingerprint`) and `errorCode`, once.
A writer creates `<file>.lock` with `fs.openSync(path, 'wx')` and writes an owner token into it — JSON `{ host: os.hostname(), pid, id: <random UUID> }`, unique to that acquisition — retrying every 50 ms for up to 5 s. Whether a held lock is abandoned is decided from that token, never from the file's mtime: a holder on this host is asked with `process.kill(pid, 0)` (success or `EPERM` means running), so a running local holder is never broken and a dead one, or the waiter's own pid, is abandoned at once; a holder on another host, or a token that cannot be parsed, is abandoned once this waiter has seen the same token unchanged for 3 s on its own `performance.now()` clock. Every attempt checks the deadline, including one that just broke a lock.
Breaking happens only under a breaker lock, `<file>.lock.break`, taken with the same exclusive create and token: only its holder removes a lock it did not take. Without it, two waiters that judged one lock abandoned could each move "the lock" in turn — the second moving the lock the first had just taken — and both proceed; the multi-process test lost an entry that way about half the time. Holding it, the breaker re-reads the lock, moves it to a unique `<file>.lock.<uuid>.stale` only if it is still the judged token, removes the moved file if it holds that token, and otherwise links it back (`fs.linkSync`). If another lock took the place first (`EEXIST`), the moved file is left under its `.stale` name and the breaker waits again. A breaker lock whose holder is gone by the same rules is removed. Under the lock: re-read, apply, write `<file>.<pid>.<random>.tmp` (mode 0600), rename over the file, release in `finally` — only while the lock still holds the writer's own token. Readers take no lock — rename makes every read see a complete file.
The waiting logic is written once, as a generator that yields each pause, and driven by a sleep strategy: `BLOCKING_SLEEP` (`Atomics.wait`) for the synchronous CLI (`project set`, `project logout`), `TIMER_SLEEP` (`setTimeout`) for the MCP server (`project_set`, token saves and clears), whose event loop keeps serving while it waits. The read, change and write never pause, so a lock is never held across a wait.
On Windows a rename over a file another process briefly holds open (a scanner, an indexer, a reader) fails with `EPERM`, `EBUSY` or `EACCES`; the atomic writer retries such a rename up to five times with a growing pause of 20 ms per attempt, an `EPERM` from the exclusive create of the lock (a lock file still being deleted) is treated as a held lock, and the same codes while taking the lock are retried within the wait. Elsewhere those codes mean the directory cannot be written, and are reported at once.
*Alternative:* advisory `flock` — rejected, not available in Node without a native addon, and not on Windows. *Alternative:* judging staleness by the lock file's mtime — rejected: a running writer on this host can hold a lock longer than any fixed age, and another host's clock sets the mtime.

**2. Canonical, ancestor-aware lookup within a repository.**
`canonicalDir(dir)` is the canonical path in its true case: on Windows convert `/x/...` to `X:\...`; `path.resolve`; then `fs.realpathSync.native` on the part of the path that exists (resolves symlinks and, on a case-insensitive volume, returns the stored case), with any part not yet created appended as given. It is what a write stores as the key, what messages show, and what directories are compared by — exactly, because the real path already carries the stored case where the volume folds case and keeps `Foo` and `foo` apart where it does not. A stored key whose directory no longer exists has no real path to ask for, so on `darwin` and `win32` it alone is compared case-insensitively. Lookup walks from the query's canonical path toward the root and stops at the first directory, the start included, that contains `.git` — the same boundary as the committed `formio.json` walk — so a mapping recorded above a repository does not reach into it; without any `.git` the walk runs to the filesystem root. The nearest match wins and is reported under its stored key. A write stores `canonicalDir` and replaces any stored key naming the same directory under these rules, so no twin is left and a case-twin directory's entry is kept. Nothing on disk is migrated: old keys are compared on read and keep their spelling.
A directory with no entry of its own that restates the pair its governing ancestor's mapping supplies is reported unchanged, naming that ancestor, and nothing is written; a different pair is recorded as the directory's own entry. An ancestor's `forced` flag is never copied onto a child entry: a child is forced only by `project set --force` for that directory.
*Read cache.* A reader keeps the parsed map and the comparison index of its stored keys keyed by the file's `mtimeMs`, `size` and `ino` (the same fingerprint `readCacheSnapshot` uses for the token cache) and reuses them until the file changes; every write renames a new file into place, so it changes the fingerprint. Writes read afresh under the lock. The index records whether each stored directory existed when the file was read, so a stored directory created or removed later is compared under the new rule once the map next changes or the process restarts.
*Alternative:* walk to the filesystem root regardless of `.git` — rejected: a mapping on a parent folder such as `~/code` would govern every repository cloned beneath it, which is the failure the committed-file boundary already prevents.

**3. Scoped certificate setting via a dispatcher.**
Node's `fetch` accepts a `dispatcher`. One `undici.Agent({ connect: { rejectUnauthorized: false } })` is created lazily and passed only for requests whose host equals the resolved project or Base URL host, and only when `FORMIO_INSECURE_TLS` is true. `undici` is added as a dependency at the major Node 22 bundles, so the `Agent` and `fetch` agree. `NODE_TLS_REJECT_UNAUTHORIZED` is no longer touched.

**4. Per-login value in the login URL and on the callback.**
`crypto.randomBytes(16).toString('hex')` per login. It travels in the login URL the server opens and prints, `http://<host>:<port>/?s=<value>`; `GET /` serves the page only when `s` matches (compared with `crypto.timingSafeEqual`; a missing, different or repeated `s` is `403` with a short page that does not carry the value, and the login keeps waiting). The page embeds the value with `JSON.stringify` and posts it back as `{ token, state }`; `/callback` requires it the same way. The login still ends at its timeout. The login-form URL is embedded with `JSON.stringify` as well.
No `Host` header is checked. A devcontainer or Codespaces forwarded port reaches the server under a name such as `<name>-<port>.app.github.dev` and a port it cannot know, so a `Host` rule either refuses those logins or has to be switched off for them; the value in the URL ties a request to this login wherever it arrives from. `onReady` reports `{ port, url }`.

**5. Release tools stay unpinned.** *(Maintainer decision, 2026-10-12.)*
The release workflow keeps installing `npm`, `@smithery/cli` and `mcp-publisher` at their latest releases and referencing actions by tag. skills.sh scans only the skill directories, so these pins would not affect its results; the pins that do — `@formio/mcp@<version>` in `formio-mcp-setup` and the plugin manifests — are unchanged.

**6. Docker from the lockfile.**
The build context moves to the repository root; the builder stage runs `corepack enable`, `pnpm install --frozen-lockfile --filter @formio/mcp...`, builds, and `pnpm deploy --filter @formio/mcp --prod /out` for the runtime stage. The image's entrypoint is unchanged.

**7. Package contents and version.**
`files` adds `LICENSE`; a `prepack` copies the root LICENSE into the package directory (and the copy is ignored by git), so the tarball always carries the current text. `build` becomes `node -e "fs.rmSync('dist',{recursive:true,force:true})" && tsc -p tsconfig.build.json` (cross-platform). `cli-launch.ts` reads a build-time constant (`__FORMIO_MCP_VERSION__`, set by esbuild `define` in both bundle scripts) and falls back to `package.json` for the `tsc` build. `server.json` gains the three `FORMIO_AUTH_*` entries, and a test compares the variables read in `src` with those declared.

## Risks / Trade-offs

- [A lock left by a crashed writer] → On this host, abandoned at once (its pid is gone); from another host, after 3 s seen unchanged, inside the 5 s wait. A running local holder is never broken, so a hung writer makes others fail after 5 s naming the lock file.
- [A breaker moves a lock taken a moment earlier] → Only the breaker-lock holder moves locks, and it re-reads first, so this needs a holder judged abandoned (another host, 3 s) that releases between the re-read and the move. The moved lock is linked back; if a third writer took the place first, the moved file is left as `.stale` and two writers can hold locks at once.
- [A breaker that crashes holding the breaker lock] → Removed by the same holder rules; two waiters removing it at once can each take it, which needs that crash and simultaneous waiters.
- [A pid reused on this host] → A lock naming a pid now used by an unrelated process is waited on until the 5 s limit; the error names the lock file to delete.
- [A stored directory created or deleted after the map was read] → The cached index compares it under the old rule until the map file next changes or the process restarts.
- [undici version drift from Node's bundled copy] → Pinned to the bundled major; the scoped dispatcher is exercised in tests against a local HTTPS server with a self-signed certificate.

## Migration Plan

No on-disk changes: old map entries are canonicalized on read. Ships under the pending 1.0 release; rollback is a revert.

## Open Questions

None.
