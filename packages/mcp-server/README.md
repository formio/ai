## Formio MCP server

The MCP server (`@formio/mcp`) is independently usable from any MCP-aware client. From a clone of this repo:

```bash
pnpm install
pnpm --filter @formio/mcp dev
```

The server starts on port 3000. Override with the `PORT` env var.

### Transports

| Transport | Endpoint | Compatible with |
| --- | --- | --- |
| Streamable HTTP | `POST /mcp` | Claude Code, VS Copilot, modern MCP clients |
| SSE | `GET /sse` + `POST /messages` | Claude Desktop, legacy MCP clients |
| stdio | `node dist/stdio.js` | `.mcp.json` spawn-mode clients |

### Connect to Claude Code

```json
{
  "mcpServers": {
    "formio-mcp": {
      "type": "http",
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

### Connect to Claude Desktop

`claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "formio-mcp": {
      "url": "http://localhost:3000/sse"
    }
  }
}
```

### Spawn via `.mcp.json` (stdio)

```json
{
  "mcpServers": {
    "formio-mcp": {
      "command": "npx",
      "args": ["-y", "@formio/mcp"],
      "env": {
        "FORMIO_BASE_URL": "https://api.form.io",
        "FORMIO_PROJECT_URL": "https://your-project.form.io"
      }
    }
  }
}
```

In standalone (non-plugin) mode, `FORMIO_BASE_URL` and `FORMIO_PROJECT_URL` are required env vars. In plugin mode, the plugin manages both via Claude Code's user-config + per-cwd `~/.formio/projects.json` mapping.

### Run in Docker

The server ships a [`Dockerfile`](./Dockerfile) and is published to the Docker MCP Catalog as `mcp/formio`. The image speaks stdio, so the MCP client owns stdin/stdout and the container must be run with `-i`:

```bash
docker run -i --rm \
  -e FORMIO_PROJECT_URL=https://your-project.form.io \
  -e FORMIO_API_KEY=your-api-key \
  mcp/formio
```

Wired into a client, that becomes:

```json
{
  "mcpServers": {
    "formio-mcp": {
      "command": "docker",
      "args": [
        "run", "-i", "--rm",
        "-e", "FORMIO_PROJECT_URL",
        "-e", "FORMIO_API_KEY",
        "mcp/formio"
      ],
      "env": {
        "FORMIO_PROJECT_URL": "https://your-project.form.io",
        "FORMIO_API_KEY": "your-api-key"
      }
    }
  }
}
```

Passing `-e KEY` without a value forwards the variable from the client's environment, which keeps the key out of the config file.

#### Authentication in a container

`FORMIO_API_KEY` is the recommended path — no browser, nothing interactive. Browser login also works if you publish the auth port; see [Headless environments](#headless-environments) for both.

Two container-specific notes regardless of auth mode. Prefer `FORMIO_PROJECT_URL` over the `project_set` tool: `project_set` persists its per-directory mapping to `~/.formio/projects.json`, which lives inside the container and is discarded when it exits. And the `cwd` argument every tool takes refers to a path *inside* the container, not on your host.

To reuse a token across container runs, mount the cache directory — it must be writable, since the server rewrites the file when a token is refreshed or cleared:

```bash
-v "$HOME/.formio:/root/.formio"
```

#### Self-hosted deployments

Two things commonly bite when the deployment is not public:

**Hostname resolution.** A private hostname won't resolve inside the container. Map it explicitly:

```bash
docker run -i --rm --add-host forms.internal:10.0.0.5 \
  -e FORMIO_BASE_URL=https://forms.internal \
  -e FORMIO_PROJECT_URL=https://forms.internal/my-project \
  -e FORMIO_API_KEY=your-api-key \
  mcp/formio
```

**Private or self-signed certificates.** The image trusts only the standard CA bundle. A certificate your host trusts — via the macOS keychain, say — will still fail inside the container, surfacing as a bare `fetch failed` from the tool. There are two cases, and they behave differently:

*Issued by a private CA.* Mount the CA certificate and point Node at it:

```bash
-v /path/to/rootCA.pem:/certs/rootCA.pem:ro -e NODE_EXTRA_CA_CERTS=/certs/rootCA.pem
```

*A fully self-signed server certificate* — one where subject and issuer are identical and there is no `CA:TRUE` basic constraint. `NODE_EXTRA_CA_CERTS` **cannot** fix this, even if you mount the server's own certificate: Node requires a trust anchor to be a CA, and rejects the chain with `DEPTH_ZERO_SELF_SIGNED_CERT`. Confirm which case you have with:

```bash
echo | openssl s_client -connect your-host:443 -servername your-host 2>/dev/null \
  | openssl x509 -noout -subject -issuer
```

If subject and issuer match, your only option is `FORMIO_INSECURE_TLS=1`, which skips verification entirely. Use it **for local development only** — never against a production deployment.

#### Building the image locally

The build context is this directory, not the repo root — the package compiles standalone because its `tsconfig` extends nothing above it and none of its dependencies are workspace packages:

```bash
docker build -t formio-mcp packages/mcp-server
```

---

## MCP server tools

The bundled `@formio/mcp` server exposes these tools. Skills prefer these over raw HTTP whenever an operation is covered.

### Forms

| Tool | Purpose |
| --- | --- |
| `form_create` | Create a new form. Use the `formio-form` skill first to build the JSON definition. |
| `form_get` | Fetch a single form definition by ID or path. |
| `form_list` | List forms with optional filtering and pagination. |
| `form_update` | Update an existing form. Call `form_get` first, edit with `formio-form`, then update. |

### Roles

| Tool | Purpose |
| --- | --- |
| `role_create` | Create a new project role. |
| `role_list` | List all project roles. |
| `role_update` | Full-replacement update of a role. Include all fields you want preserved. |

### Actions

| Tool | Purpose |
| --- | --- |
| `action_types_list` | List all action types available on the server. |
| `action_type_get` | Get an action type's settings schema. |
| `action_create` | Attach a new action to a form. |
| `action_list` | List actions on a form. |
| `action_get` | Get a single action by ID. |
| `action_update` | Update an action. |
| `action_delete` | Detach an action from a form. |

### Project

| Tool | Purpose |
| --- | --- |
| `project_export` | Export the project's complete template (roles, resources, forms, actions) as a portable JSON document. Use before `project_import` to snapshot. |
| `project_import` | Import a template JSON — additively merges roles, resources, forms, and actions in one call. **Same-machine-name items are overwritten in place; everything else is preserved.** |
| `project_set` | Plugin-mode only — persist a per-cwd Project URL mapping in `~/.formio/projects.json`. Never exposed standalone (the standalone server binds to `FORMIO_PROJECT_URL` via env instead). |

### Diagnostic

| Tool | Purpose |
| --- | --- |
| `hello` | Smoke-test tool. Returns a static greeting; useful for verifying MCP wiring before any authenticated call. |

---

## Authentication

The MCP server supports two authentication modes:

- **JWT mode (default).** A short-lived local Express server renders the Form.io portal login form; the user signs in once, the JWT comes back via a `/callback` endpoint, and `formioFetch` attaches `x-jwt-token` on every subsequent request. The flow is implicit — the **first authenticated tool call** triggers it on a cache miss. No explicit `authenticate` tool exists.
- **API-key mode.** Set `FORMIO_API_KEY`. All requests attach `x-token`; the browser flow is skipped entirely.

The JWT is cached in `~/.formio/mcp-tokens.json` (mode `0600`), keyed by `FORMIO_BASE_URL` — one token covers every project on the same deployment. Tokens are valid for roughly seven days; on a cache hit the server checks expiry locally, then revalidates against the server, and falls back to a fresh login if either check fails.

> **What the agent is granted.** JWT mode hands the agent **the JWT of whoever logs in**, so the agent acts with that person's permissions for the token's lifetime — sign in as an administrator and the agent inherits administrator access to the deployment. An API key is scoped to its project instead. Prefer API-key mode for unattended or shared environments, and sign in as a least-privileged user when using JWT mode.

### Headless environments

By default the login page is served on an ephemeral port bound to `127.0.0.1` and the server shells out to `open`/`start`/`xdg-open`, which assumes a desktop browser on the same machine.

Where that assumption doesn't hold — a container, an SSH session, CI — you have three options:

1. **Set `FORMIO_API_KEY`** and skip the browser entirely. Simplest for unattended use.
2. **Complete the login manually.** The login URL is written to stderr on **every** login attempt, before any browser launch is tried — not only when something fails. If the launch does fail, that is reported as an additional line rather than swallowed. The URL also appears in the timeout error, which the client surfaces as tool output, so it reaches you even if you never see the server's logs.

   stderr is used because with stdio transport **stdout carries the MCP protocol itself** — writing anything else there corrupts the stream.
3. **Bind somewhere reachable.** Set `FORMIO_AUTH_HOST=0.0.0.0` and `FORMIO_AUTH_PORT` to a fixed, published port, then open the URL from your own machine:

   ```bash
   docker run -i --rm -p 43117:43117 \
     -e FORMIO_PROJECT_URL=https://your-project.form.io \
     -e FORMIO_AUTH_HOST=0.0.0.0 -e FORMIO_AUTH_PORT=43117 \
     mcp/formio
   ```

   `FORMIO_AUTH_HOST=0.0.0.0` exposes the login page on every interface for the duration of the login. Only use it where that is acceptable.

If no login arrives within `FORMIO_AUTH_TIMEOUT` seconds (default 900) the call fails with an error naming these options, rather than hanging until the client gives up.

### Login-form auto-resolution

When `FORMIO_LOGIN_FORM` is unset, the server probes these candidates on the first login attempt and caches the first one that responds (1.5-second timeout per candidate):

1. `${FORMIO_BASE_URL}/formio/user/login` (portal-base)
2. `${FORMIO_PROJECT_URL}/admin/login` (project admin)
3. `${FORMIO_PROJECT_URL}/user/login` (project user)

The probe runs lazily — only when the local auth page is actually served.

---

## Environment variables

| Name | Required | Default | Purpose | Hosted SaaS example | Self-hosted example |
| --- | :-: | --- | --- | --- | --- |
| `FORMIO_BASE_URL` | yes | — | Full base URL of your Form.io deployment. | `https://api.form.io` | `https://forms.example.com` |
| `FORMIO_PROJECT_URL` | yes\* | — | Full URL of your Form.io project. In plugin mode, only used as the pre-filled default offered when prompting for an unmapped cwd. | `https://myproject.form.io` | `https://forms.example.com/myproject` |
| `FORMIO_API_KEY` | no | `undefined` | Long-lived project API key. When set, the server skips the browser login flow. | `CHANGEME` | `CHANGEME` |
| `FORMIO_LOGIN_FORM` | no | Auto-resolved | Override the portal login form URL used by the JWT login flow. | `https://formio.form.io/user/login` | `https://forms.example.com/formio/user/login` |
| `FORMIO_PLUGIN_CONTEXT` | no | `0` | Set by the plugin manifest. When `1`, the server enables `project_set` and reads `FORMIO_PROJECT_URL` from `~/.formio/projects.json` per cwd instead of env. |  |  |

\* In plugin context, `FORMIO_PROJECT_URL` is captured per-cwd by the `project_set` tool and persisted to `~/.formio/projects.json`. The `verify-project-url` `SessionStart`/`PreToolUse` hook offers `formio_default_project_url` (from plugin user-config) as the default the first time you enter a workspace.