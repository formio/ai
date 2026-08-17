## Context

`prune-shipped-surface` deleted `plugin/hooks/`. Everything the hook did is now carried by the server — `SERVER_INSTRUCTIONS` at initialize replaces its `SessionStart` guidance, the resolution error replaces its `PreToolUse` deny, and per-call `cwd` resolution is strictly better than a `CwdChanged` event — with one exception. The hook read `FORMIO_DEFAULT_PROJECT_URL` and offered it as the recommended project the first time an agent worked in an unmapped directory. Nothing reads that variable now.

Separately, `plugin/.cursor-plugin/plugin.json` wires its install-time project answer into `env.FORMIO_PROJECT_URL`, which **pins** the server. Its own description tells the user the opposite — that they can leave it blank and map directories with `project_set` later. A user who fills it in gets a server that ignores every `project_set` call, with no visible cause.

Both are the same confusion: a project URL that *suggests* and a project URL that *pins* were treated as one thing.

## Goals / Non-Goals

**Goals:**

- A configured default project can be offered to the agent without changing what any tool resolves.
- The two variables are impossible to confuse, in behaviour and in prose.
- An install-time prompt cannot silently defeat `project_set`.
- The offer reaches every client, not the one that happens to support hooks.

**Non-Goals:**

- Changing resolution precedence. `FORMIO_PROJECT_URL` then mapping then error stays exactly as Phase 0 defined it; this change adds a variable that deliberately sits outside that order.
- Reinstating hooks in any form.
- An offering counterpart for the base URL. `FORMIO_BASE_URL` is already a fallback — a directory's mapping carries its own base URL and wins — so a second variable would differ in name only.

## Decisions

### 1. Offer through the error and the instructions, not through resolution

The tempting shortcut is to have `resolveProjectConfig` fall back to `FORMIO_DEFAULT_PROJECT_URL` when no mapping exists. Rejected: that makes it a pin with a friendlier name. The user would get silent writes to whichever project was configured at install time, which is the failure this change exists to remove.

Instead the value travels through the two surfaces that already tell an agent what to do about a missing project — the resolution error and the server's `instructions`. Both already exist and both reach every client. Resolution stays untouched, which is the property worth protecting: a tool call resolves identically whether or not the variable is set, and that is asserted by test.

### 2. Two variables, opposite meanings, stated wherever either appears

`FORMIO_PROJECT_URL` pins. `FORMIO_DEFAULT_PROJECT_URL` suggests. Keeping them separate is the fix; naming one as a "default" of the other would reintroduce the ambiguity.

The requirement extends to prose, because the Cursor bug was a documentation failure as much as a wiring one — the description promised `project_set` would work while the wiring guaranteed it would not. Any surface that collects a project URL now has to say which variable it sets.

### 3. `env` is the portable channel

The hook worked only where hooks work. Environment variables in a server's own MCP configuration are supported by `.mcp.json`, `.cursor/mcp.json`, `.vscode/mcp.json`, and `.codex/config.toml` alike, so a default configured that way is available everywhere.

One honest limit: only some clients can *prompt* for it at install time — Cursor through `variables`, Claude Code through `userConfig`. Elsewhere the user sets it in their MCP config by hand, or skips it and answers the agent's question once. That asymmetry is in the clients, not in the server, and the server behaves identically either way.

## Risks / Trade-offs

- **A Cursor user who relied on the pin loses it.** → They set `FORMIO_PROJECT_URL` in their MCP configuration directly, which is unchanged and documented. Called out as behavioural in the proposal. The population is small: pinning was never the documented intent of that prompt, which described a default.
- **Two similar variable names invite confusion.** → Mitigated by requiring the distinction in every table that documents either, and by the `project_set` description naming only the pinning one as the value it cannot override.
- **The offer is advisory, so an agent may ignore it.** → Accepted. That is the same contract as the rest of `SERVER_INSTRUCTIONS`, and the failure mode is one extra question rather than a write to the wrong project.
