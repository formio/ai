## Why

The MCP server and skill library are Claude-Code-shaped in three places that block every other agent (Cursor, Codex, Copilot, VS Code, Gemini CLI, Kiro): per-directory project routing is gated behind `FORMIO_PLUGIN_CONTEXT`, the browser login flow hangs for its full timeout in environments that have no browser, and one skill violates the Agent Skills open standard hard enough that spec-conformant clients may reject it. This is Phase 0 of the multi-agent portability work — it neutralizes the core so the later packaging phases have something portable to package.

## What Changes

- **BREAKING** Remove `FORMIO_PLUGIN_CONTEXT`. Per-cwd project routing becomes available to every client, governed by explicit precedence instead of a mode flag: a `FORMIO_PROJECT_URL` in the environment wins when set; otherwise the `~/.formio/projects.json` entry for the caller's `cwd` is used; otherwise the tool fails with an actionable error naming `project_set`.
- **BREAKING** `FORMIO_BASE_URL` gets one behavior for all clients — it defaults to `https://api.form.io` rather than being required in plugin context and defaulted elsewhere.
- Register `project_set` unconditionally, so any client can map a working directory to a project. Its `cwd` parameter and description stop branching on plugin mode.
- Detect browserless environments (CI, SSH without a display, containers) *before* starting the local login server, and fail fast with guidance to set `FORMIO_API_KEY` — or `FORMIO_AUTH_HOST` / `FORMIO_AUTH_PORT` for a container with a published port. `FORMIO_FORCE_BROWSER=1` overrides the detection. A missing display variable alone is not a signal: it does not distinguish a headless host from an agent started outside a graphical session, and failing on it would withhold the stderr login URL that already works there.
- Rename `plugin/skills/formio-angular/resources/` to `plugin/skills/formio-angular/formio-angular-resources/` so the directory name matches the skill's declared `name`, as the Agent Skills spec requires, and trim its 2,334-character `description` to the spec's 1,024-character maximum. It stays a nested sub-skill loaded by path.
- Add an Agent Skills conformance suite to `packages/skill-tests/` covering **every** `SKILL.md` in the library (nested ones included): name/directory agreement, name charset rules, description length, and an allow-list of frontmatter keys.

Out of scope for this change: the Agent Plugins bundle, `.agents/skills/` distribution, the `formio-setup` skill, de-Claude-ing skill prose, and documentation rewrites. Those are Phases 1–3.

## Capabilities

### New Capabilities

- `project-map-routing`: client-neutral per-directory project resolution — precedence between environment and project map, unconditional `project_set` registration, and the actionable errors raised when no project can be resolved.
- `agent-skills-conformance`: automated validation that every skill in the library satisfies the Agent Skills open standard, enforced in CI.

### Modified Capabilities

- `server-config`: the environment-variable contract — `FORMIO_PLUGIN_CONTEXT` removed, `FORMIO_BASE_URL` default unified, `FORMIO_PROJECT_URL` explicitly not required at startup (aligning the spec with the behavior directory crawlers already depend on).
- `user-auth`: adds a browserless-environment precondition ahead of the login server, so a no-browser host gets an immediate, actionable error instead of a timeout, and narrows the "browser opens automatically" requirement to hosts that passed the check.
- `skill-description-budget`: the 1,024-character budget applies to every `SKILL.md` in the library; the nested-sub-skill exemption is removed because non-Claude clients discover nested skills recursively.
- `formio-angular-skill`: the sub-skill's directory path changes to `formio-angular-resources/`.

## Impact

- **Code**: `packages/mcp-server/src/config.ts`, `project-resolver.ts`, `tools/index.ts`, `tools/project_set.ts`, `auth.ts`; tests for each.
- **Plugin packaging**: `plugin/.claude-plugin/plugin.json` (drop `FORMIO_PLUGIN_CONTEXT` from the MCP env block), `plugin/hooks/verify-project-url.mjs` and `plugin/hooks/hooks.json` (unchanged in behavior, but the hook's rationale comment references the flag).
- **Skills**: `plugin/skills/formio-angular/formio-angular-resources/**` (directory rename plus every relative link into it from `formio-angular/*.md`), its eval harness paths, and the description trim.
- **Tests / CI**: new conformance suite in `packages/skill-tests/`; `packages/skill-tests/src/skill-descriptions/helpers.ts` stops filtering to top-level skills.
- **Docs**: `README.md` environment-variable table and the `project_set` row; `packages/mcp-server/README.md`; the initiative notes' G10 entry (records the precedence design chosen over the `FORMIO_PROJECT_MAP` flag first sketched there).
- **Not affected**: tool names and schemas other than `project_set`'s `cwd`, the Form.io HTTP surface, token caching, and the Claude plugin's user-config prompts.
