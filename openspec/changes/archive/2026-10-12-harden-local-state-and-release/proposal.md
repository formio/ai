## Why

The server's local state and its release pipeline are the last places where behaviour depends on timing or on what happens to be current upstream:

- `~/.formio/projects.json` is shared by every server process on the machine and rewritten in place with a read-modify-write. Two servers mapping directories at the same moment can lose one write, and a process reading mid-write sees a truncated file.
- A mapping is found only for the exact directory it was recorded for: a subdirectory of a mapped repository reports "not configured", `/tmp` and `/private/tmp` are different keys on macOS, and `C:\Users\me` and `c:\users\me` are different keys on Windows.
- `FORMIO_INSECURE_TLS` turns off certificate verification for every HTTPS request the process makes, not only those to the deployment it is meant for.
- The local login page accepts a token from any POST to `/callback`, and writes the login-form URL into its script as a quoted string without encoding it.
- The Docker image installs dependencies without a lockfile, so an image can differ from the one before it with no change in the repository.
- The npm tarball carries no LICENSE file; `build` does not clear `dist`, so a stale module can be packed; the `.mcpb` bundle reports version `0.0.0`; `server.json` omits `FORMIO_AUTH_HOST`, `FORMIO_AUTH_PORT` and `FORMIO_AUTH_TIMEOUT`.

## What Changes

- **`projects.json` and token-cache writes are atomic and serialized**: each write takes a short-lived lock file whose token names its host and process, re-reads the file, applies its change, and replaces the file with a temp-file-plus-rename. A running holder on this host is never broken; a dead one is at once; another host's after 3 s seen unchanged. The MCP server waits on a timer, the CLI blocks. A reader never sees a partial file, and concurrent writers never lose each other's entries.
- **Mapping lookup finds the nearest mapped ancestor within the repository**, stopping at the first directory holding `.git` as the committed `formio.json` walk does, and comparing canonical paths: the real path (`realpath`, which resolves symlinks and returns the case the filesystem stores) compared exactly, with case folded on macOS and Windows only for a stored directory that no longer exists, and a Git-Bash style `/c/...` path read as `C:\...` on Windows. Restating the pair an ancestor's mapping already supplies writes nothing. Existing entries are read as they are; nothing on disk is rewritten.
- **`FORMIO_INSECURE_TLS` applies only to requests to the resolved deployment and project hosts**, through a per-request connection setting, instead of disabling verification process-wide.
- **The login page answers only its own login URL and post**: a random value generated per login travels in the login URL the server opens and prints (`?s=<value>`); `GET /` serves the page only for that value, the page posts it back, `/callback` requires it, and any other request is answered `403` without ending the login. The login-form URL is embedded in the page script as a JSON string literal.
- **The Docker image installs from the repository lockfile.** The release workflow's tool versions (`npm`, `@smithery/cli`, `mcp-publisher`, actions) are deliberately left tracking their latest releases: they are CI for publishing, outside the skills that skills.sh scans, and the skill and manifest pins of `@formio/mcp@<version>` stay as they are.
- **The package is complete and current**: the tarball includes LICENSE, `build` clears `dist` first, the bundled `.mcpb` and plugin servers report the package version, and `server.json` lists every environment variable the server reads.
- Changeset: `patch` for `@formio/mcp`; folds into the pending 1.0 release.

## Capabilities

### New Capabilities

- `mcp-server-packaging`: what the published package and its bundles contain — LICENSE, a clean `dist`, the version every build reports, and the environment variables `server.json` declares.

### Modified Capabilities

- `project-map-routing`: writes to the map are atomic and serialized; lookup finds the nearest mapped ancestor within the repository by canonical path; reads reuse the parsed map until the file changes; remedies about an inherited mapping name the directory that holds it.
- `user-auth`: the login URL carries the per-login value, the page is served only for it, and the callback requires it; the login-form URL is embedded as a JSON string.
- `token-cache`: writes are serialized under the shared lock.
- `server-config`: `FORMIO_INSECURE_TLS` is scoped to the resolved deployment and project hosts.
- `claude-plugin-release`: the Docker image installs from the lockfile.

## Impact

- Code: `packages/mcp-server/src/atomic-file.ts` (shared lock and locked update), `project-map.ts` (atomic write, canonical lookup), `token-cache.ts` (locked writes), `project-resolver.ts` (ancestor lookup), `formio-client.ts` and `config.ts` (scoped TLS), `auth.ts` (callback value, script embedding), `cli-launch.ts` (version), `scripts/build-mcpb.ts` and `scripts/build-plugin.ts` (version define), `packages/mcp-server/package.json` (`build`, `files`), `packages/mcp-server/Dockerfile`, `.github/workflows/release.yml` (Docker build context only), `server.json`.
- Dependencies: `undici` (the module Node's `fetch` is built on) for the scoped connection setting.
- No tool, argument or schema change; `tools/list` unchanged.
