---
'@formio/mcp': patch
'@formio/ai': patch
---

Make the local project map and the published artifacts behave the same on every run.

- **Directory mappings are written atomically and one at a time.** Each write to `~/.formio/projects.json` takes a short-lived lock file beside it, re-reads the map, applies its change and replaces the file through a `0600` temporary file and a rename, so a reader never sees a partial file and two servers recording at once both keep their entries. A lock left behind for more than 10 seconds is replaced; one that cannot be obtained fails with `CONFIG_UNREADABLE` naming the lock file.
- **A mapping applies to its subdirectories.** A directory with no mapping of its own resolves the nearest mapped folder above it. Paths are compared in canonical form: symlinks are resolved, comparison ignores case on macOS and Windows, and a Git Bash style `/c/...` path is read as `C:\...` on Windows. New writes store the canonical path; existing entries are matched as they are and nothing on disk is rewritten. A committed `formio.json` still outranks any mapping.
- **`FORMIO_INSECURE_TLS` applies only to the configured deployment.** Certificate checks are relaxed only for requests to the hosts of the resolved Project URL and Base URL; every other host is verified as usual, and `NODE_TLS_REJECT_UNAUTHORIZED` is no longer set.
- **The browser login completes only from the page it served.** Each login generates a value the page sends back with the token; `/callback` answers any other post with `403` and keeps waiting until the login's timeout. The login-form URL is embedded in the page as a JSON string.
- **The Docker image installs from the repository lockfile.** It is built from the repository root with `pnpm install --frozen-lockfile` and `pnpm deploy`, so it carries the dependency versions in `pnpm-lock.yaml`. Build it locally with `docker build -f packages/mcp-server/Dockerfile .` from the repository root.
- **The package is complete and reports its version everywhere.** The npm tarball includes `LICENSE`; `build` clears `dist` before compiling, so no module from an earlier build is packed; the `.mcpb` bundle and the plugin bundle report the `@formio/mcp` version at initialize and in `server_status`; and `server.json` declares `FORMIO_AUTH_HOST`, `FORMIO_AUTH_PORT` and `FORMIO_AUTH_TIMEOUT`.
