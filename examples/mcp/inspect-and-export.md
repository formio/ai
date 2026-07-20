# Inspect and export a project (raw MCP tools)

A skills-free run — exercises the MCP server directly from a client that has only `.mcp.json` configured (no plugin, no skill library). The agent should reach for the `form_list`, `role_list`, and `project_export` tools on its own.

## Prompt

```
Using the formio-mcp tools, show me every form and role in my Form.io project, then export the full project template and save it to ./backup/template.json.
```

## What to look for

- `form_list` and `role_list` calls against the configured `FORMIO_PROJECT_URL` — no raw `curl`.
- The first authenticated call should trigger the browser portal-login flow on a JWT cache miss (or skip it entirely when `FORMIO_API_KEY` is set).
- `project_export` output written to the local file verbatim — a portable template with `roles`, `forms`, `resources`, and `actions`.
