# Form.io AI — basic example app

This directory exercises the local `formio-ai` plugin inside Claude Code without publishing to npm. It points Claude Code at the built plugin in `dist/plugin/` via a local marketplace, enables the plugin, and loads environment variables from a sibling `.env` file.

## Prerequisites

- Node.js 20+
- pnpm 10+
- [Claude Code](https://docs.anthropic.com/claude/code) installed
- A Form.io project URL (e.g. `https://your-project.form.io`)

## Build the plugin

From the repository root:

```sh
pnpm install
pnpm build:plugin
```

This bundles the MCP server into `dist/plugin/server/stdio.mjs`, writes the manifest to `dist/plugin/.claude-plugin/plugin.json`, and copies the runtime skills into `dist/plugin/skills/`.

## Configure environment variables

Copy the example file and set your project URL:

```sh
cd examples/basic-app
cp .env.example .env
# edit .env and set FORMIO_PROJECT_URL
```

Variables:

| Name | Required | Purpose |
| ---- | -------- | ------- |
| `FORMIO_PROJECT_URL` | yes | The full URL of your Form.io project |
| `FORMIO_API_KEY` | no | Long-lived API key; skips the browser login flow |
| `FORMIO_LOGIN_FORM` | no | Override the portal login form path (default `/user/login`) |

## Register the marketplace and start Claude Code

The marketplace file lives at the repository root (`.claude-plugin/marketplace.json`) so its `./dist/plugin` source path is valid. Register it once from the repo root:

```sh
cd /path/to/formio-ai
claude
# inside Claude Code:
/plugin marketplace add .
```

Then launch from the example app:

```sh
cd examples/basic-app
claude
```

Claude Code reads `.claude/settings.json` (which enables `formio-ai@formio`) and resolves the plugin through the `formio` marketplace you registered. The MCP server is launched automatically and its skills are registered.

If Claude Code reports "plugin not found in marketplace" after a schema change, re-add the marketplace so it rescans:

```
/plugin marketplace remove formio
/plugin marketplace add .
```

Use these exact identifiers when checking plugin state in Claude Code:

- Plugin ID: `formio-ai@formio`
- Marketplace name: `formio`

### Shortcut: skip the marketplace

For ad-hoc testing, load the built plugin directly without registering a marketplace:

```sh
claude --plugin-dir /dist/plugin
```

## Example prompts to try

- "List the forms in this Form.io project."
- "Create a resource named `employee` with fields `firstName`, `lastName`, and `email`."
- "Show me the submissions for the form called `contact`."
- "Using the formio-form skill, generate a JSON schema for a registration form with name, email, and password fields."

The first prompt that requires authentication will trigger the browser login flow unless `FORMIO_API_KEY` is set.
