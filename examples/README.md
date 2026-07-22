# Example prompts

Copy-paste prompts for exercising the Form.io skills library in a Claude Code session. Each subfolder targets a skill entry point; each file is one self-contained prompt plus notes on what it should exercise.

- [`apps/`](./apps/) — full application builds and extensions through the `formio-application` orchestrator (plan → import → framework scaffold).
- [`forms/`](./forms/) — single-form and wizard builds through the `formio-form-builder` orchestrator (intent → schema → saved form, optional embed handoff).
- [`embed/`](./embed/) — embedding already-saved forms with the `formio-form` skill and the `@formio/js` renderer.
- [`api/`](./api/) — direct REST-surface work through the `formio-api` skill (backed by the MCP server's first-party tools).
- [`mcp/`](./mcp/) — raw MCP tool calls with NO skill involved; verifies the `@formio/mcp` server standalone (plain `.mcp.json`, no plugin).

## How to run one

1. Start a **fresh** Claude Code session at the repository root (skill descriptions are snapshotted at session start; the `.claude/skills/` symlinks load the live `plugin/skills/` sources).
2. Make sure the MCP server targets the Form.io project you want to test against — standalone mode requires `FORMIO_PROJECT_URL` in the root `.mcp.json` (`FORMIO_BASE_URL` defaults to `https://api.form.io`).
3. Paste the prompt from the example file. Prompts open with the skill's slash tag (e.g. `/formio-application`) so activation is explicit; drop the tag to test description-based triggering instead.

Generated workspaces land where the prompt says (conventionally a sibling folder under `examples/` — gitignored, disposable).
