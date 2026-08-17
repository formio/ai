## Context

`@formio/mcp` is already transport- and vendor-neutral in the ways that matter (stdio, env-var config, no Anthropic dependency), but three pieces of it were built for the Claude Code plugin specifically:

- `FORMIO_PLUGIN_CONTEXT=1`, set only by `plugin/.claude-plugin/plugin.json`, decides three things at once: whether `project_set` is registered (`src/tools/index.ts`), whether the per-cwd project map is consulted (`src/project-resolver.ts`), whether `cwd` is a required or optional tool parameter (`buildCwdSchema`, evaluated **once at module load**), and whether `FORMIO_BASE_URL` is required or defaulted (`src/config.ts`).
- The login flow in `src/auth.ts` binds a port, launches a browser, and waits out `FORMIO_AUTH_TIMEOUT` before failing. On a host with no browser — a Codex cloud task, the Copilot coding agent, a devcontainer, CI — the wait is pure dead time, and the error only arrives at the end.
- `plugin/skills/formio-angular/resources/SKILL.md` declares `name: formio-angular-resources` in a directory named `resources`, with a 2,334-character description. Claude Code never registers it (the parent loads it by path), so neither problem is visible today. Cursor, Codex, and Copilot discover skills by recursive scan; there the directory/name mismatch and the 2.3×-over-budget description are specification violations.

Phase 0 fixes those three, plus the CI gap that let the third one exist. It deliberately ships no new packaging: the Agent Plugins bundle, `.agents/skills/` distribution, and the `formio-setup` skill land in Phases 1–2, and they all assume a server that can start with nothing and acquire its project at runtime.

## Goals / Non-Goals

**Goals:**

- One binary, one behavior, regardless of which agent launched it — no host-mode branching anywhere in the server.
- Per-directory project routing (`project_set` + `~/.formio/projects.json`) available to every client, with the Claude plugin's current behavior preserved exactly.
- Every unresolved-project failure is an actionable tool error, never a startup crash and never an opaque HTTP error.
- A browserless host learns in milliseconds what to do instead (API key, or a published auth port).
- The skill library is machine-verified against the Agent Skills specification in CI, so Phase 1 can package it without auditing it by hand.

**Non-Goals:**

- Any new distribution layout (`plugin.json`, `mcp.json`, `.agents/skills/`, `.codex-plugin/`) — Phase 1.
- The `formio-setup` skill, per-client MCP config guidance, and de-Claude-ing skill prose — Phase 2.
- A device-code or remote-callback login flow. Phase 0 only *detects* browserlessness and points at API-key auth; a genuinely remote-friendly flow is a later change.
- Rewriting the stale `api-skills-validation` spec, whose `packages/mcp-server/src/skills-validator.ts` no longer exists in source (only in `dist/`). Noted here so it is not mistaken for coverage; cleaning it up is its own change.
- Reworking the Claude `verify-project-url` hook. It keeps working as-is; it becomes an optimization rather than the mechanism.

## Decisions

### D1 — Precedence, not a renamed flag

The audit doc first sketched renaming `FORMIO_PLUGIN_CONTEXT` to `FORMIO_PROJECT_MAP` and defaulting it on. Rejected: a flag that is always on is not a flag, and it still leaves two code paths to test.

Instead, resolution is a fixed precedence: **environment project URL wins; otherwise the map entry for `cwd`; otherwise an actionable error.**

Why this is safe for both existing modes:

- The Claude plugin passes no `FORMIO_PROJECT_URL` (only `FORMIO_BASE_URL`), so the map stays authoritative there — identical to today.
- A standalone `.mcp.json` / `.cursor/mcp.json` / Codex TOML launch sets `FORMIO_PROJECT_URL`, so it stays pinned to that project even if a stale map entry exists for the directory — which is the current standalone behavior, and the deterministic choice for CI and hosted runners.

Alternative considered — map wins over env: rejected, because a leftover `project_set` from an earlier session would silently redirect a pinned, scripted launch.

### D2 — `cwd` becomes uniformly optional-but-absolute

`buildCwdSchema()` currently returns a *required* string in plugin mode and an *optional, ignored* one otherwise, and it is evaluated at module load, so the schema cannot reflect anything learned later. One schema replaces both: optional, and when present it must be absolute. Requiredness is enforced where it is actually knowable — at resolution time, by the error that fires when neither the environment nor a map entry supplies a project.

This is a visible schema change for plugin users (a previously required parameter becomes optional), but the failure mode is unchanged: omit `cwd` with no env project and the call still fails, now with a better message.

### D3 — Browserless detection is a positive check with an escape hatch

Detection runs *before* `app.listen`, and errs toward "assume a browser exists". Signals: `CI` truthy; `SSH_CONNECTION`/`SSH_TTY` with no display; `/.dockerenv` or a `container` env var. `FORMIO_FORCE_BROWSER=1` skips the check entirely, which covers both a false positive and the container-with-published-port case where the operator knows better than the heuristic.

A bare missing `DISPLAY` / `WAYLAND_DISPLAY` is deliberately not a signal, on any platform. Because the check precedes `app.listen`, a false positive costs the user the stderr login URL — the one recourse on a host that cannot launch a browser itself — and a display variable is absent in ordinary working setups (a systemd user unit, a `tmux` session older than the graphical login) as readily as on a headless server. The environments that really are browserless carry `CI`, an SSH variable, or a container marker; the display variable is kept only as the corroborating half of the SSH test.

The error text is ordered by likely usefulness — `FORMIO_API_KEY` first, then `FORMIO_AUTH_HOST`/`FORMIO_AUTH_PORT`, then the override — because for cloud agents the API key is nearly always the right answer.

Alternative considered — try to launch and treat launch failure as the signal: rejected, because `open`/`xdg-open` frequently exits 0 having done nothing useful, which is exactly how the current dead-time failure happens.

### D4 — Rename the sub-skill directory rather than promoting or hiding it

Three options existed for the `resources/` violation:

1. Promote it to a top-level skill (`plugin/skills/formio-angular-resources/`). Rejected: it would join the top-level routing surface, where it would compete with `formio-angular` and `formio-application` for triggers — precisely the collision the description guards exist to prevent.
2. Demote it to a plain reference document with no frontmatter. Rejected: it is a real skill with its own triggers, eval harness, and phase cadence; flattening it would lose implicit invocation on Angular-explicit extension requests in the clients that support nested skills.
3. **Rename the directory to match the declared name, keep it nested.** Chosen: conformant under recursive discovery, unchanged for Claude Code (parent loads it by path, just a different path), and no routing-surface change.

The 2,334 → ≤1,024 description trim goes with it. The cut is drawn at trigger-bearing content versus narration: trigger phrases, boundary rule, and `Not for:` clause stay; the feature-shape enumeration and two-phase cadence narration move into the body, which loads on activation anyway. Re-run the sub-skill's own eval harness before and after to confirm activation behavior held.

### D5 — Conformance checks live in `packages/skill-tests`, in TypeScript

The spec ships a reference validator (`skills-ref`), but adding an external binary or a second language runtime to CI for four rules is not worth it — and the prior attempt at an out-of-band validator (`skills-validator.ts`) has already rotted out of the source tree while its spec still describes it. Four assertions in Vitest, next to the existing `skill-descriptions` suite and sharing its frontmatter helper, cannot rot without turning CI red.

The enumeration helper grows a second scope (recursive) rather than being switched wholesale, because the routing and collision guards are genuinely top-level-only concerns.

## Risks / Trade-offs

- **Dropping `FORMIO_PLUGIN_CONTEXT` is breaking for any launcher that sets it** → It is set in exactly one place in this repo (`plugin/.claude-plugin/plugin.json`), and the new precedence makes the plugin's behavior identical without it. The variable becomes inert rather than an error, so a stale external launcher degrades to correct behavior instead of failing. Document the removal in the README env table.
- **`project_set` exposed everywhere invites env/map drift** → Env precedence makes the drift harmless-by-construction: a pinned launch ignores the map. Worth a one-line note in the `project_set` description so an agent does not "fix" a pinned project by writing a map entry that will never be read.
- **Browserless heuristics produce false positives** (e.g. a Linux desktop session started without `DISPLAY` exported, a container that *does* have a reachable browser) → `FORMIO_FORCE_BROWSER=1`, named in the error text itself, so the user is told the way out at the moment they hit it.
- **The directory rename touches many relative links** (`formio-angular/*.md`, the sub-skill's `references/*.md`, evals, `CLAUDE.md`, READMEs) → A repo-wide search assertion for `formio-angular/resources/` is part of the spec, so a missed link fails CI rather than 404-ing for a user.
- **Trimming the description could change activation** → Both existing eval harnesses run before and after; the trim is content-preserving by design (narration moves to the body).
- **`cwd` going from required to optional weakens a guardrail for plugin users** → The resolution error names `cwd` and `project_set` explicitly, and the Claude hook still front-runs the mapping, so the guidance arrives earlier than the schema error did.

## Migration Plan

1. Land the server changes (config → resolver → tool registry → auth) with tests; the plugin still sets `FORMIO_PLUGIN_CONTEXT` at this point and behavior must be unchanged.
2. Remove `FORMIO_PLUGIN_CONTEXT` from `plugin/.claude-plugin/plugin.json` and the hook's rationale comment; run `pnpm build:plugin && pnpm test:plugin`.
3. Rename the sub-skill directory with `git mv` (preserves history), update every link, trim the description, re-run both eval harnesses.
4. Add the conformance suite; expect it to pass only after step 3.
5. Update the README env-var table, the `project_set` row, and `packages/mcp-server/README.md` (G10 records D1 in place of the `FORMIO_PROJECT_MAP` sketch).
6. Ship as a minor version with a changeset that calls out the removed variable. Rollback is a revert: nothing in this change writes new on-disk state, and `~/.formio/projects.json` keeps the same shape.

## Open Questions

- Should `FORMIO_INSECURE_TLS` and `FORMIO_FORCE_BROWSER` be surfaced in the Claude plugin's `userConfig`, or stay env-only? Leaning env-only — both are escape hatches, and Phase 1 removes `userConfig` from the portable path anyway.
- Does any downstream consumer parse the current unmapped-project error text? Assumed no (it is a human/agent-facing message), but worth a grep of the skills library for the old wording while implementing.
