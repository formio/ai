## Context

The orchestration pipeline established by `add-formio-application-orchestrator` has a silent failure between Steps 2 (Deployment) and 3 (Authenticate). Step 2 captures `FORMIO_PROJECT_URL` and `FORMIO_BASE_URL` as orchestrator state, but Step 3's lazy-auth depends on the MCP server process having those values at startup. Claude Code reads `.mcp.json` once at session start — not on every tool call. So when a user runs `formio-application` in a greenfield workspace with no `.mcp.json`, the MCP server either isn't running or was started with stale/default env, and the orchestrator's in-memory URL capture cannot flow to it.

Symptoms observed in practice: the Import step "hangs" — the MCP server either cannot authenticate (wrong project URL) or authenticates into a project different from the one the user is trying to import into.

Existing `.mcp.json` in this repo (and the template at `example/.mcp.json`):

```json
{
  "mcpServers": {
    "formio-mcp": {
      "command": "pnpm",
      "args": ["--filter", "@formio/mcp", "exec", "tsx", "src/stdio.ts"],
      "env": {
        "FORMIO_BASE_URL": "https://api.form.io",
        "FORMIO_PROJECT_URL": "https://your-project.form.io"
      }
    }
  }
}
```

Notes from the code:

- `packages/mcp-server/src/config.ts` reads `FORMIO_PROJECT_URL` (required), `FORMIO_API_KEY`, `FORMIO_LOGIN_FORM`. It does NOT currently read `FORMIO_BASE_URL`, but the env var is in the existing `.mcp.json` precedent — leave it in the written file so the server can start reading it later without another skill change.
- The skills-library uses `FORMIO_BASE_URL` as an abstract identifier in skill frontmatter (`root_url`). `FORMIO_BASE_URL` is the skill-library-ish name; `FORMIO_BASE_URL` is the MCP-env-var name. These are two different strings referring to the same concept (the platform deployment URL). The orchestrator's Step 2 captures it as `FORMIO_BASE_URL` in its internal state, then writes it to `.mcp.json` under the key `FORMIO_BASE_URL`. `MCP_CONFIG.md` documents this mapping explicitly so nobody conflates the two names.

Constraints:

- Claude Code does not reload `.mcp.json` mid-session. Writing it is necessary but not sufficient; the user must restart the session or reconnect the `formio-mcp` server for the new env to take effect.
- The skill cannot programmatically restart Claude Code. The best we can do is write the file, print a clear instruction, and pause.
- The workspace may already have a `.mcp.json` for other reasons (other MCP servers, other projects). The write must be a merge, not an overwrite.

## Goals / Non-Goals

**Goals:**

- The Import step ALWAYS reaches a correctly-configured MCP server. No silent failures, no ambiguity about which project the import lands in.
- The `.mcp.json` write is a discrete, user-visible step with an approval gate. Users see what the skill is about to add to their workspace before it touches the file.
- The write preserves any existing `formio-mcp` entry's command/args (a user may have a custom setup); only the `env` block is rewritten.
- Adding a new framework skill later does not re-break this step — the MCP Config step is framework-agnostic.

**Non-Goals:**

- Not automating the MCP restart. The user sees an instruction and runs the restart/reconnect themselves.
- Not adding new env vars beyond `FORMIO_PROJECT_URL` and `FORMIO_BASE_URL`. Other env vars (`FORMIO_API_KEY`, `FORMIO_LOGIN_FORM`) are orthogonal and unchanged.
- Not supporting multiple concurrent `formio-mcp` entries in one `.mcp.json`. If the user has some custom multi-project setup, they are on their own; the skill writes a single entry.
- Not publishing `@formio/mcp` to npm as part of this change. `MCP_CONFIG.md` documents both the monorepo pnpm-filter command and a placeholder `npx -y @formio/mcp` default; the latter is aspirational until the package ships.

## Decisions

### New `authenticate` MCP tool

Register `authenticate` in `packages/mcp-server/src/tools/authenticate.ts` and wire it into `registerAllTools`. The tool's implementation is thin:

```ts
server.tool(
  'authenticate',
  'Authenticate against the configured Form.io project. Idempotent — returns cached=true without opening a browser if a valid JWT is already cached. Opens a browser portal-login window if no valid token exists.',
  {},
  async () => {
    const cachedBefore = Boolean(config.jwt);
    await ensureAuthenticated(config);
    const cached = cachedBefore && Boolean(config.jwt);
    const userEmail = await tryFetchCurrentUserEmail(config);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            authenticated: Boolean(config.jwt),
            cached,
            projectUrl: config.projectUrl,
            ...(userEmail ? { userEmail } : {}),
          }),
        },
      ],
    };
  }
);
```

`tryFetchCurrentUserEmail` is a best-effort helper that calls `GET {projectUrl}/current` via `formioFetch` and pulls an email field out of the submission if it exists. Any error is swallowed — a missing email is not a failure.

**Rationale:** the `authenticate` tool surfaces the login as a named, expected operation. The agent knows "this tool may take time because the user needs to log in"; it does not mistake a pending browser window for a hung import tool. The minimal return shape confirms success without exposing the JWT.

**Idempotency:** `ensureAuthenticated` already short-circuits when `config.jwt` is set (see `packages/mcp-server/src/ensure-auth.ts`). The new tool records `cachedBefore` to let the caller distinguish a silent success from a fresh login; both states return `authenticated: true`.

**No parameters:** the tool reads the project URL from the MCP server's `FormioConfig`. The agent cannot ask the server to authenticate against a different project; to do that, the user updates `.mcp.json` (Step 3) and restarts.

**No JWT leak:** the return payload never includes the JWT. Skills that need the JWT call other tools, which attach `x-jwt-token` internally via `formioFetch`.

### Insert a new Step 3, renumber the rest

```
OLD:  1 Intent  2 Deployment  3 Authenticate  4 Import  5 Framework
NEW:  1 Intent  2 Deployment  3 MCP Config    4 Authenticate  5 Import  6 Framework
```

**Rationale:** MCP Config is a prerequisite for Authenticate (which is itself a prerequisite for Import). Inserting it between Deployment and Authenticate matches the natural dependency order. Folding it into Authenticate would violate the "one step per approval gate" pattern that the orchestrator uses everywhere else — the `.mcp.json` write is user-visible, destructive-ish (edits a config file), and carries a mandatory restart instruction. It deserves its own gate.

**Alternative considered:** make MCP Config a hidden substep of Authenticate. Rejected — users need to see the preview of what is being written to `.mcp.json` BEFORE the restart, so the step must be explicit.

### Env var naming — `FORMIO_BASE_URL` in the written file

The MCP server code does not currently read `FORMIO_BASE_URL`; it reads `FORMIO_PROJECT_URL`. The existing `.mcp.json` ships both, presumably in anticipation of a future read. The skill writes both, matching the existing precedent.

**Rationale:** match what ships. Changing to `FORMIO_BASE_URL` in the written file would diverge from `example/.mcp.json` and from the repo's own `.mcp.json`; changing the existing `.mcp.json` files would be out of scope for this change. `MCP_CONFIG.md` documents the naming duality (orchestrator state = `FORMIO_BASE_URL`; written env var = `FORMIO_BASE_URL`) so future readers do not get confused.

**Alternative considered:** rename the MCP server code to read `FORMIO_BASE_URL` and update the skill-frontmatter `root_url` identifier. Rejected as out of scope; that is a separate CLAUDE.md-terminology-cleanup change.

### `.mcp.json` merge semantics

When writing the file, use this algorithm:

```
if ./.mcp.json exists:
  read it
  if .mcpServers.formio-mcp exists:
    preserve .mcpServers.formio-mcp.command + .mcpServers.formio-mcp.args
    overwrite .mcpServers.formio-mcp.env.FORMIO_PROJECT_URL
    overwrite .mcpServers.formio-mcp.env.FORMIO_BASE_URL
    preserve all other env keys (e.g., FORMIO_API_KEY if the user set one)
  else:
    add a new .mcpServers.formio-mcp entry with the default command/args and the two env vars
  preserve all other entries under .mcpServers (e.g., unrelated MCP servers)
  write back
else:
  create ./.mcp.json with a single .mcpServers.formio-mcp entry using the default command/args and the two env vars
```

The default command when the skill has to create a new entry:

- If the working directory or any ancestor up to the repo root contains `pnpm-workspace.yaml` AND that workspace has a `@formio/mcp` package → use the pnpm-filter command (`pnpm --filter @formio/mcp exec tsx src/stdio.ts`). This matches monorepo dev.
- Otherwise → use `npx -y @formio/mcp` as a placeholder, with a TODO note in `MCP_CONFIG.md` that this is aspirational until the package publishes. Document the fallback clearly in the preview so the user knows whether they need to tweak the command before approving.

### Approval gate + restart instruction

Before writing, print the full merged `.mcp.json` as a fenced `json` block and ask:

```
About to write .mcp.json with the configuration above.

If you approve:
  1. The file will be written.
  2. You must RESTART this Claude Code session (or run /mcp reconnect
     for the `formio-mcp` server if supported) for the new env to take
     effect.
  3. Once reconnected, re-invoke this skill (or tell me to continue) —
     I'll resume from Step 4 (Authenticate).

Proceed?
```

On approval, write the file and print the restart instruction. Then STOP — do not advance to Step 4 in the same invocation.

**Rationale:** the agent cannot reliably drive across an MCP restart boundary. Pausing is the honest behavior. The next invocation picks up at Step 4 because the cached state (URLs, template path) is on disk.

**Alternative considered:** try the Import anyway and let it fail fast, surfacing the error. Rejected — users would see a confusing failure; the explicit pause is more honest.

### Skip rule — already correctly configured

Before running the MCP Config step, inspect the existing `./.mcp.json`. If it already has a `formio-mcp` entry whose `env.FORMIO_PROJECT_URL` and `env.FORMIO_BASE_URL` exactly match the Step-2 captures, skip the step entirely. Tell the user: "Skipping MCP Config — `./.mcp.json` already points at this project." Proceed to Authenticate.

**Rationale:** users re-running the flow after a restart should not be asked to re-approve the same file.

### Where `.mcp.json` lives

The workspace root — the directory the user was in when they invoked the skill. This is the same directory the planner writes `template.json` to. Claude Code looks for `.mcp.json` in the workspace root, so writing it there is both conventionally correct and functionally correct.

Edge case: the user is already inside an Angular workspace (not the repo root). `.mcp.json` goes in the workspace root, which may be the Angular project root or a parent depending on how the user has things organized. The skill writes to `process.cwd()` and documents this behavior in `MCP_CONFIG.md`; if the user wanted it elsewhere, they say so.

## Risks / Trade-offs

- **Mid-session restart requirement** → the user MUST restart Claude Code for the new env to take effect. Some users will forget, try to continue, and get confused when Authenticate still talks to the old project. Mitigation: Step 3 prints a loud, multi-line restart instruction and explicitly refuses to continue to Step 4 in the same invocation. Step 4's opening check re-inspects `process.env.FORMIO_PROJECT_URL` (which the MCP server passes through) and compares against the captured URL; if they mismatch, it surfaces the mismatch and re-instructs a restart.
- **Merge could stomp on user customizations** → the user may have configured a custom `command` or `args` for their `formio-mcp` entry (e.g., pointed at a forked fork of the MCP server). Mitigation: merge preserves `command`/`args`; only `env.FORMIO_PROJECT_URL` and `env.FORMIO_BASE_URL` are rewritten. If the user has some clever env-var-interpolation setup that our rewrite would break, they can decline the approval gate.
- **Placeholder default command for external users** → `npx -y @formio/mcp` does not work today because the package is unpublished. External users will approve, write, restart, and the MCP server will fail to spawn. Mitigation: in the preview, explicitly flag that the command is a placeholder for external-user installs; point at the monorepo command for users who have the repo checked out; promise publishing. This is a known temporary wart, tracked as an Open Question.
- **Step-number churn across docs** → every sibling doc references step numbers. Mitigation: single pass of edits in Task Group 3; layout test asserts the new numbering explicitly so a regression is caught.
- **Spec drift vs. archived change** → the archived `add-formio-application-orchestrator` change documents a five-step flow. That record stays archived (it describes a point in time). The live spec at `openspec/specs/formio-application-skill/spec.md` — once this change archives — will reflect six steps. No inconsistency at steady state.

## Migration Plan

1. Edit `skills/formio-application/SKILL.md` — renumber phases, add the MCP Config step, update description.
2. Author `skills/formio-application/MCP_CONFIG.md` — the new sibling doc.
3. Edit sibling docs (`INTENT.md`, `DEPLOYMENT.md`, `IMPORT.md`, `FRAMEWORK.md`) — update any step-number references.
4. Update `packages/mcp-server/src/__tests__/formio-application-layout.test.ts` — six-step ordering, `MCP_CONFIG.md` assertions, renumber other assertions.
5. Run `pnpm test && pnpm lint` (no `pnpm format` root script — prettier via workspace invocation).
6. Update the live spec (`openspec/specs/formio-application-skill/spec.md`) as part of archive.

Rollback: revert the PR. No runtime state, no DB, no infra.

### Step 4 (Authenticate) calls the new tool explicitly

Step 4's body in `SKILL.md` + `IMPORT.md` changes from "trigger MCP lazy-auth on the first tool call" to "call the `authenticate` MCP tool explicitly, then proceed to Step 5 on success." This removes the ambiguity where the user (and the agent) could not tell whether the hang-on-import was a login flow or an error.

**Rationale:** naming the operation fixes the observability problem without changing the underlying auth logic. `ensureAuthenticated` stays exactly as it is.

## Open Questions

- **Publish `@formio/mcp` to npm so the default command stops being a placeholder.** Needs version, README, publish cadence, release engineering. Out of scope for this change; flagged as a hard dependency for external users.
- **Reconcile `FORMIO_BASE_URL` vs. `FORMIO_BASE_URL` naming across the repo.** Picking one and renaming everywhere is a separate, larger change. This proposal uses `FORMIO_BASE_URL` in the written file (matches existing `.mcp.json`) and `FORMIO_BASE_URL` in the orchestrator's internal state (matches the skills-library `root_url` convention). Document the mapping; do not change either name today.
- **Should Step 3 offer to auto-`git-ignore` the written `.mcp.json`?** Writing the URL to a file the user may commit could leak infrastructure. Recommendation: add a one-line note suggesting `.mcp.json` belongs in `.gitignore` for public repos, but do not modify `.gitignore` automatically — that is the user's call. Tracked here; implement if beta feedback demands it.
- **What if `/mcp reconnect` is supported in the user's Claude Code version?** A newer Claude Code may let the user reconnect without a full restart. `MCP_CONFIG.md` documents both paths and defers to whichever the user's version supports. Do not detect version programmatically.
- **`authenticate` tool `{ force: boolean }` parameter.** Not in this change. If a user has a cached-but-stale JWT that `validateToken` deems valid (e.g., Form.io rotated signing keys while the token was in flight), the user currently has no way to force re-auth short of clearing the cache by hand. Add a `force` param only if beta feedback warrants it.
- **Reusing `authenticate` from skills beyond `formio-application`.** The tool is general — any skill that wants to confirm auth before a sensitive sequence can call it. Document this in the tool's description so other skills adopt it naturally; do not bake specific callers into the tool itself.
