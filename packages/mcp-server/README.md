## Formio MCP server

[![npm: @formio/mcp](https://img.shields.io/npm/v/%40formio%2Fmcp?label=%40formio%2Fmcp)](https://www.npmjs.com/package/@formio/mcp)
[![Smithery](https://img.shields.io/badge/Smithery-formio%2Fmcp-blue)](https://smithery.ai/servers/formio/mcp)
[![MCP Registry](https://img.shields.io/badge/MCP%20Registry-io.form%2Fformio--mcp-blue)](https://registry.modelcontextprotocol.io/v0/servers?search=io.form/formio-mcp)

The MCP server (`@formio/mcp`) is independently usable from any MCP-aware client. It speaks **stdio**: the client spawns it and owns stdin/stdout. There is no port to open and nothing to start by hand.

From a clone of this repo, the entry point is `src/stdio.ts`:

```bash
pnpm install
pnpm --filter @formio/mcp exec tsx src/stdio.ts
```

Run that way it waits for MCP traffic on stdin, which only tells you it starts cleanly — point a client at the command instead. A built package exposes the same entry point as the `formio-mcp` bin and as `dist/stdio.js`.

### Transport

| Transport | Command | Compatible with |
| --- | --- | --- |
| stdio | `npx -y @formio/mcp` (or `node dist/stdio.js`) | Claude Code, Claude Desktop, Cursor, VS Code, Codex, Windsurf, Cline — anything that speaks MCP over stdio |

There is no HTTP or SSE transport. The server's only HTTP listener is the temporary browser-login page described under [Authentication](#authentication), which carries no MCP traffic.

### Connect a client

The same stdio entry works everywhere, but the file it goes in **and the key it goes under** both vary by client — `.mcp.json` under `mcpServers` for Claude Code, `.cursor/mcp.json` under `mcpServers` for Cursor, `.vscode/mcp.json` under **`servers`** for VS Code, and `.codex/config.toml` as TOML for Codex. There is no universal `.mcp.json`. The [root README](https://github.com/formio/ai#manual-configuration) carries the full per-client table; the JSON `mcpServers` shape is:

```json
{
  "mcpServers": {
    "formio-mcp": {
      "command": "npx",
      "args": ["-y", "@formio/mcp"],
      "env": {
        "FORMIO_PROJECT_URL": "https://your-project.form.io"
      }
    }
  }
}
```

Every tool that reaches Form.io needs a project: either `FORMIO_PROJECT_URL` in the environment, or a per-directory mapping written by the `project_set` tool (the environment wins when both exist). `FORMIO_BASE_URL` is optional and defaults to `https://api.form.io`, so set it when self-hosting. The Claude Code plugin collects both through user-config and the per-cwd `~/.formio/projects.json` mapping; other clients set the environment or call `project_set`.

The server starts without either one, so a client can connect and list the tools before anything is configured — the project URL is only demanded at the point a tool needs it, and `hello` works regardless.

### Run in Docker

The server ships a [`Dockerfile`](./Dockerfile) and is published to Docker Hub as [`formio/mcp`](https://hub.docker.com/r/formio/mcp) for `linux/amd64` and `linux/arm64`. The image speaks stdio, so the MCP client owns stdin/stdout and the container must be run with `-i`:

```bash
docker run -i --rm \
  -e FORMIO_PROJECT_URL=https://your-project.form.io \
  -e FORMIO_API_KEY=your-api-key \
  formio/mcp
```

Wired into a client — the same entry as [Connect a client](#connect-a-client), with `command` and `args` pointed at Docker — that becomes (shown in the JSON `mcpServers` shape; VS Code uses `servers` and Codex uses TOML, as noted there):

```json
{
  "mcpServers": {
    "formio-mcp": {
      "command": "docker",
      "args": [
        "run", "-i", "--rm",
        "-e", "FORMIO_PROJECT_URL",
        "-e", "FORMIO_API_KEY",
        "formio/mcp"
      ],
      "env": {
        "FORMIO_PROJECT_URL": "https://your-project.form.io",
        "FORMIO_API_KEY": "your-api-key"
      }
    }
  }
}
```

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
  formio/mcp
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

### Inspect it with MCP Inspector

The [MCP Inspector](https://github.com/modelcontextprotocol/inspector) connects to the server and lets you browse and call its tools by hand — useful for confirming a config works before wiring it into an agent. Start the web portal:

```bash
npx @modelcontextprotocol/inspector
```

It prints a URL carrying an auth token and opens a browser. The default port is 6274; if something already holds it, move both with `CLIENT_PORT=6284 SERVER_PORT=6285`.

![Importing inspector-config.json into the MCP Inspector, connecting the server, and calling form_list against a real project](https://raw.githubusercontent.com/formio/ai/main/packages/mcp-server/docs/formio-mcp-inspector.gif)

Copy [`inspector-config.example.json`](./inspector-config.example.json) to `inspector-config.json`, fill in your project URL and API key, and you have the file the next step asks for. That name is gitignored, so a filled-in copy cannot be committed by accident.

The same run, step by step:

**1. Choose Add Servers → Import from client config.**

![Add Servers menu with Import from client config highlighted](https://raw.githubusercontent.com/formio/ai/main/packages/mcp-server/docs/images/inspector-1-add-servers.jpg)

**2. Click "From file…".** The dialog takes a client config file or a client installed on this machine — there is nowhere to paste JSON.

![Import from client config dialog offering a client dropdown and a From file button](https://raw.githubusercontent.com/formio/ai/main/packages/mcp-server/docs/images/inspector-2-import-dialog.jpg)

**3. Select your `inspector-config.json`,** and the server it defines is listed as new. Confirm with "Import 1 server".

![Dialog listing formio-mcp under New servers with an Import 1 server button](https://raw.githubusercontent.com/formio/ai/main/packages/mcp-server/docs/images/inspector-3-new-servers.jpg)

**4. Enable the server with the toggle on its card.** It turns green and reports the negotiated protocol version once the container is up; the first connection is slower because Docker has to start it.

![Server card for formio-mcp showing Connected and the docker command it runs](https://raw.githubusercontent.com/formio/ai/main/packages/mcp-server/docs/images/inspector-4-connected.jpg)

**5. Open the Tools tab** for the tools this server exposes. Every server lists all 20 — including `project_set`, which is registered for every client.

![Tools tab listing hello, form_create, form_get, form_list and the rest](https://raw.githubusercontent.com/formio/ai/main/packages/mcp-server/docs/images/inspector-5-tools.jpg)

**6. Pick a tool, fill in its arguments, and press "Execute Tool".** The result appears in the middle pane and the JSON-RPC exchange in the right-hand Protocol panel. `hello` is the one tool that touches no credentials, so it isolates transport problems from auth problems; `form_list` below is a real call against a project.

![form_list results showing form definitions returned from a Form.io project](https://raw.githubusercontent.com/formio/ai/main/packages/mcp-server/docs/images/inspector-6-tool-result.jpg)

Importing writes the server into the inspector's own catalog at `~/.mcp-inspector/mcp.json`, so it is still there next time — remove it from the card when you are done. A tool that fails with a bare `fetch failed` is usually the deployment, not the server: see [Self-hosted deployments](#self-hosted-deployments) for hostname resolution and certificate trust inside a container.

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
| `form_revisions_list` | List a form's saved revisions. |
| `form_revision_get` | Fetch one revision of a form by revision id. |

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
| `project_set` | Persist a per-cwd Project URL mapping in `~/.formio/projects.json`, so one server can serve several workspaces. Registered in every client. An explicit `FORMIO_PROJECT_URL` in the server environment takes precedence over the mapping. |

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
     formio/mcp
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
| `FORMIO_PROJECT_URL` | yes\* | — | Full URL of your Form.io project. Takes precedence over any per-directory mapping written by `project_set`. Self-hosted, it is a sub-directory of the deployment or a sub-domain of your own domain (`https://myproject.example.com`), depending on how that deployment routes projects. | `https://myproject.form.io` | `https://forms.example.com/myproject` |
| `FORMIO_DEFAULT_PROJECT_URL` | no | — | A project URL to **offer**, not to apply. When set and the working directory has no mapping, the server names it as the suggested project so the agent can confirm it and persist it with `project_set`. It never changes what a tool resolves — the opposite of `FORMIO_PROJECT_URL`, which pins the server and cannot be redirected by `project_set`. |
| `FORMIO_BASE_URL` | no | `https://api.form.io` | Full base URL of your Form.io deployment — always `https://api.form.io` on the hosted cloud, never a project's `*.form.io` sub-domain. Set it when self-hosting. | `https://api.form.io` | `https://forms.example.com` |
| `FORMIO_API_KEY` | no | `undefined` | Long-lived project API key. When set, the server skips the browser login flow — the only way to authenticate on a host with no browser. | `CHANGEME` | `CHANGEME` |
| `FORMIO_LOGIN_FORM` | no | Auto-resolved | Override the portal login form URL used by the JWT login flow. | `https://formio.form.io/user/login` | `https://forms.example.com/formio/user/login` |
| `FORMIO_AUTH_HOST` | no | `127.0.0.1` | Bind address for the browser-login page. `0.0.0.0` makes it reachable from outside a container. |  |  |
| `FORMIO_AUTH_PORT` | no | ephemeral | Fixed port for the browser-login page, so a container can publish it. | `43117` | `43117` |
| `FORMIO_AUTH_TIMEOUT` | no | `900` | Seconds to wait for a browser login before failing the call. |  |  |
| `FORMIO_INSECURE_TLS` | no | `undefined` | Set to `1` to skip TLS verification. Local development only — never against production. |  |  |
| `FORMIO_FORCE_BROWSER` | no | `0` | Set to `1` to attempt the browser login even where the server detects no browser (CI, a container, SSH with no display). |  |  |

<sub>\* Not at startup — the server starts, lists every tool, and answers `hello` without it; only the tools that read or write Form.io data error, naming `project_set` and this variable. The alternative is the `project_set` tool, which maps a working directory to a project in `~/.formio/projects.json`. Resolution order: `FORMIO_PROJECT_URL`, then the mapping for the caller's `cwd`, then the error. Map a directory before any client connects with `npx -y @formio/mcp project set --project-url <url> --base-url <url> --cwd <path>`; `project get --cwd <path>` prints what resolves and which source won. It exits `0` when it resolved, `1` when nothing is mapped for that directory, and `2` when the command could not answer (a usage error, a malformed URL, an unreadable `~/.formio/projects.json`) — so a caller can tell "nothing here yet" from "this failed".</sub>

---

## Privacy Policy

Form.io's privacy policy covers the Form.io Services this server talks to: **https://form.io/privacy**

What the server itself does with data, which is the part the policy above cannot describe:

**Where your data goes.** Only to the Form.io deployment you configure. Every request targets `FORMIO_BASE_URL` / `FORMIO_PROJECT_URL` — your own SaaS project or your self-hosted server. The server sends nothing to Form.io when you are self-hosted, and there is no telemetry, analytics, or usage reporting of any kind.

**What is stored on your machine.** Two files under `~/.formio/`, both written with mode `0600`:

| File | Contents | Written when |
| --- | --- | --- |
| `mcp-tokens.json` | The JWT from the browser login, keyed by `FORMIO_BASE_URL` | You sign in through the browser |
| `projects.json` | A per-directory map of project and base URLs | `project_set` runs |

Form data and submissions are never written to disk — they pass through in memory to answer a tool call.

**Credentials.** `FORMIO_API_KEY`, when set, is read from the environment and sent to your deployment as an authentication header; it is never written to disk. The cached JWT is valid for roughly seven days, after which the server re-authenticates. Delete `~/.formio/mcp-tokens.json` to sign out immediately.

**Third parties.** The server contacts no third-party service. One exception is worth naming: the browser sign-in page is rendered from a local page that loads styling and the Form.io renderer from `cdn.form.io`, `cdn.jsdelivr.net`, and `fonts.googleapis.com`, so those hosts see your browser's IP address while that page is open. Set `FORMIO_API_KEY` to skip the browser flow entirely and avoid it.

**Retention.** The files above persist until you delete them. Data held in your Form.io project is governed by your own deployment's retention rules, and by the policy linked above for Form.io-hosted projects.

Questions about data handling: support@form.io
