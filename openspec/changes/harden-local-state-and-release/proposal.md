## Why

The server's local state and its release pipeline are the last places where behaviour depends on timing or on what happens to be current upstream:

- `~/.formio/projects.json` is shared by every server process on the machine and rewritten in place with a read-modify-write. Two servers mapping directories at the same moment can lose one write, and a process reading mid-write sees a truncated file.
- A mapping is found only for the exact directory it was recorded for: a subdirectory of a mapped repository reports "not configured", `/tmp` and `/private/tmp` are different keys on macOS, and `C:\Users\me` and `c:\users\me` are different keys on Windows.
- `FORMIO_INSECURE_TLS` turns off certificate verification for every HTTPS request the process makes, not only those to the deployment it is meant for.
- The local login page accepts a token from any POST to `/callback`, and writes the login-form URL into its script as a quoted string without encoding it.
- The release job installs `npm@latest`, `@smithery/cli@latest` and the latest `mcp-publisher` at run time, and references actions by tag; the Docker image installs dependencies without a lockfile. A release can therefore differ from the one before it with no change in the repository.
- The npm tarball carries no LICENSE file; `build` does not clear `dist`, so a stale module can be packed; the `.mcpb` bundle reports version `0.0.0`; `server.json` omits `FORMIO_AUTH_HOST`, `FORMIO_AUTH_PORT` and `FORMIO_AUTH_TIMEOUT`.

## What Changes

- **`projects.json` writes are atomic and serialized**: each write takes a short-lived lock file, re-reads the map, applies its change, and replaces the file with a temp-file-plus-rename. A reader never sees a partial file, and concurrent writers never lose each other's entries.
- **Mapping lookup finds the nearest mapped ancestor**, comparing canonical paths: symlinks resolved (`realpath`), case-insensitive comparison where the filesystem is (macOS, Windows), and a Git-Bash style `/c/...` path read as `C:\...` on Windows. Existing entries are read as they are; nothing on disk is rewritten.
- **`FORMIO_INSECURE_TLS` applies only to requests to the resolved deployment and project hosts**, through a per-request connection setting, instead of disabling verification process-wide.
- **The login page accepts only the post it was served for**: the page carries a random value generated per login, `/callback` requires it, and any other post is answered `403` without ending the login. The login-form URL is embedded in the page script as a JSON string literal.
- **The release is reproducible**: actions are referenced by commit SHA, `npm`, `@smithery/cli` and `mcp-publisher` are pinned to versions recorded in the workflow (the publisher download is verified against a recorded checksum), and the Docker image installs from the repository lockfile.
- **The package is complete and current**: the tarball includes LICENSE, `build` clears `dist` first, the bundled `.mcpb` and plugin servers report the package version, and `server.json` lists every environment variable the server reads.
- Changeset: `patch` for `@formio/mcp`; folds into the pending 1.0 release.

## Capabilities

### New Capabilities

- `mcp-server-packaging`: what the published package and its bundles contain — LICENSE, a clean `dist`, the version every build reports, and the environment variables `server.json` declares.

### Modified Capabilities

- `project-map-routing`: writes to the map are atomic and serialized; lookup finds the nearest mapped ancestor by canonical path.
- `user-auth`: the login page's callback requires the per-login value; the login-form URL is embedded as a JSON string.
- `server-config`: `FORMIO_INSECURE_TLS` is scoped to the resolved deployment and project hosts.
- `claude-plugin-release`: release tools and actions are pinned; the Docker image installs from the lockfile.

## Impact

- Code: `packages/mcp-server/src/project-map.ts` (lock, atomic write, canonical lookup), `project-resolver.ts` (ancestor lookup), `formio-client.ts` and `config.ts` (scoped TLS), `auth.ts` (callback value, script embedding), `cli-launch.ts` (version), `scripts/build-mcpb.ts` and `scripts/build-plugin.ts` (version define), `packages/mcp-server/package.json` (`build`, `files`), `packages/mcp-server/Dockerfile`, `.github/workflows/release.yml`, `server.json`.
- Dependencies: `undici` (the module Node's `fetch` is built on) for the scoped connection setting.
- No tool, argument or schema change; `tools/list` unchanged.
