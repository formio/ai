# Form.io MCP Server

Official [Model Context Protocol](https://modelcontextprotocol.io) server for [Form.io](https://form.io). Lets an AI agent create and manage Form.io forms, resources, actions, roles, and projects — against Form.io SaaS or your own self-hosted deployment.

Also published as [`@formio/mcp`](https://www.npmjs.com/package/@formio/mcp) on npm and listed in the [official MCP Registry](https://registry.modelcontextprotocol.io/v0/servers?search=io.form/formio-mcp) as `io.form/formio-mcp`.

Images are built for `linux/amd64` and `linux/arm64`.

## Quick start

```bash
docker run -i --rm \
  -e FORMIO_PROJECT_URL=https://your-project.form.io \
  -e FORMIO_API_KEY=your-api-key \
  formio/mcp
```

The server speaks **stdio**, so the MCP client owns stdin/stdout — always run with `-i`.

## Use it from an MCP client

Works with Claude Code, Claude Desktop, Cursor, VS Code, Windsurf, Cline, and anything else that speaks MCP over stdio:

```json
{
  "mcpServers": {
    "formio-mcp": {
      "command": "docker",
      "args": ["run", "-i", "--rm", "-e", "FORMIO_PROJECT_URL", "-e", "FORMIO_API_KEY", "formio/mcp"],
      "env": {
        "FORMIO_PROJECT_URL": "https://your-project.form.io",
        "FORMIO_API_KEY": "your-api-key"
      }
    }
  }
}
```

## Configuration

| Variable | Required | Purpose |
| --- | --- | --- |
| `FORMIO_PROJECT_URL` | yes | Full project URL — `https://examples.form.io` on the hosted cloud, `https://forms.mysite.com/myproject` or `https://myproject.mysite.com` when self-hosted, depending on that deployment's project routing |
| `FORMIO_API_KEY` | recommended | Project API key. See authentication below. |
| `FORMIO_BASE_URL` | no | The deployment hosting the project. Usually leave it unset: it is derived from the project URL — `https://api.form.io` for a project on a `form.io` host, the parent path for a sub-directory-routed one. Supply it only for a path-less project URL on your own domain, whose deployment cannot be derived. Never a `*.form.io` project subdomain. |
| `FORMIO_AUTH_HOST` | no | Bind address for browser login (default `127.0.0.1`). |
| `FORMIO_AUTH_PORT` | no | Fixed port for browser login, so it can be published from a container. |
| `FORMIO_AUTH_TIMEOUT` | no | Seconds to wait for a browser login (default `900`). |
| `FORMIO_INSECURE_TLS` | no | Set to `1` to skip TLS verification. Local development only. |

## Authentication

`FORMIO_API_KEY` is the recommended path in a container — no browser, nothing interactive.

Browser login also works, but the login page is served inside the container. To use it, bind it somewhere your browser can reach and publish the port:

```bash
docker run -i --rm -p 43117:43117 \
  -e FORMIO_PROJECT_URL=https://your-project.form.io \
  -e FORMIO_AUTH_HOST=0.0.0.0 -e FORMIO_AUTH_PORT=43117 \
  formio/mcp
```

The login URL is written to stderr, and the container prints it on every attempt. `FORMIO_AUTH_HOST=0.0.0.0` exposes the login page on all interfaces for the duration of the login — only use it where that is acceptable.

Note that browser login grants the agent **the JWT of whoever signs in**, so it inherits that person's permissions. An API key is scoped to its project instead.

## Self-hosted deployments

A private hostname will not resolve inside the container — map it with `--add-host your-host:10.0.0.5`. If the deployment uses a certificate from a private CA, mount the CA and set `NODE_EXTRA_CA_CERTS`. A fully self-signed certificate cannot be trusted that way; use `FORMIO_INSECURE_TLS=1` for local development only.

## Tools

`form_list`, `form_get`, `form_create`, `form_update`, `form_revisions_list`, `form_revision_get`, `role_list`, `role_create`, `role_update`, `action_list`, `action_get`, `action_create`, `action_update`, `action_delete`, `action_types_list`, `action_type_get`, `project_export`, `project_import`, and `hello` for a no-auth smoke test.

## Links

- Source and full documentation: https://github.com/formio/ai
- Universal Agent Gateway (agentic form automation at runtime): https://hub.docker.com/r/formio/uag
- License: MIT
