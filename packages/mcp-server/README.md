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