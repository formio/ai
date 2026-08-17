## Why

Two problems with one shape, both about the difference between *pinning* a project and *offering* one.

**A Cursor install can silently pin the server.** `plugin/.cursor-plugin/plugin.json` maps an install-time variable straight into `env.FORMIO_PROJECT_URL`. That variable takes precedence over the working-directory mapping, so a user who fills it in gets a server locked to one project and every later `project_set` call silently does nothing. The variable's own description promises the opposite:

> Optional — leave it blank and the agent will ask which project to use, then map this directory with the `project_set` tool.

Blank is safe — an empty string falls through to the mapping — so this only bites the user who follows the prompt. It is the same precedence trap that `neutralize-skills-for-multi-agent` removed from `formio-application` Step 4, still live in a manifest.

**The default-project offer was lost with the hook.** `prune-shipped-surface` deleted `plugin/hooks/`, whose `SessionStart` gate had one piece of behaviour nothing replaced: it read `FORMIO_DEFAULT_PROJECT_URL` and offered it as the recommended value the first time an agent worked in an unmapped directory. Everything else the hook did is now carried by the server — `SERVER_INSTRUCTIONS` at initialize replaces its guidance, and the resolution error replaces its `PreToolUse` deny — but no configured default is surfaced anywhere, because the hook was the only reader of that variable.

The two fix together. What the hook did through a Claude-Code-only channel, the server can do through the one configuration channel every client shares: environment variables in its own MCP config.

## What Changes

- **The server reads `FORMIO_DEFAULT_PROJECT_URL` and offers it, never applies it.** When set and a project cannot be resolved, the value is named in the resolution error as the suggested project, with an instruction to confirm it with the user and persist it with `project_set`. `SERVER_INSTRUCTIONS` mentions the same. The variable SHALL NOT change what any tool resolves.
- **The two variables keep opposite meanings, and the server says so.** `FORMIO_PROJECT_URL` pins: it takes precedence over the mapping and `project_set` cannot redirect it. `FORMIO_DEFAULT_PROJECT_URL` only suggests. They are separate variables because conflating them is what produced the Cursor bug.
- **The Cursor manifest moves its install-time variable off the pin.** `env.FORMIO_PROJECT_URL` becomes `env.FORMIO_DEFAULT_PROJECT_URL`, so filling in the prompt does what its description already claims: offers a default that `project_set` can still override per directory.
- **`FORMIO_BASE_URL` needs no equivalent.** It is already a fallback rather than a pin — a directory's mapping supplies its own base URL and wins — so a separate `FORMIO_DEFAULT_BASE_URL` would add a variable with no behavioural difference.
- **Document both variables** in the environment tables that describe them: `README.md`, `packages/mcp-server/README.md`, and `plugin/README.md`.

## Capabilities

### New Capabilities

- `default-project-offer`: the rule that a configured project may be offered without being applied, the separation between the pinning variable and the offering variable, and the requirement that the server surface the offer through channels every client has.

### Modified Capabilities

- `agent-plugin-packaging`: the Cursor manifest's install-time project variable feeds the offering variable rather than the pinning one, so an install-time answer no longer defeats `project_set`.

## Impact

- **Source:** `packages/mcp-server/src/config.ts` (read the new variable), `project-resolver.ts` (name it in the error), `server.ts` (`SERVER_INSTRUCTIONS`). No change to resolution precedence — the point is that resolution is untouched.
- **Manifests:** `plugin/.cursor-plugin/plugin.json` — the `env` entry and the variable's title/description.
- **Docs:** the environment tables in `README.md`, `packages/mcp-server/README.md`, `plugin/README.md`.
- **Behavioural:** a Cursor user who filled in the project URL previously got a pinned server; they now get a default they can override per directory. Anyone relying on the pin should set `FORMIO_PROJECT_URL` in their MCP config directly, which is unchanged and still documented.
- **Restores** the last piece of `plugin/hooks/` behaviour, for every client rather than one.
- **Depends on `prune-shipped-surface`**, which deleted the hook and removed the orphaned `userConfig.formio_default_project_url` from the Claude manifest.
