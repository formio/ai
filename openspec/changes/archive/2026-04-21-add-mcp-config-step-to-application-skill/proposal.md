## Why

`formio-application`'s Import step hangs today when the target Form.io project is not the same project the MCP server was spawned against at Claude Code session start. The flow is: `project_import` is an MCP tool call, the MCP server authenticates against `FORMIO_PROJECT_URL` from its startup env, and if that env points at a DIFFERENT project (or no project at all — the common case for a greenfield workspace), the tool call either fails or authenticates into the wrong place. The orchestrator captured the right URLs in Step 2 (Deployment), but those captured URLs never reach the MCP server process because Claude Code reads `.mcp.json` at session start, not at tool-call time.

The missing glue is a discrete step that writes `.mcp.json` to the workspace with the captured URLs BEFORE any MCP tool is called. Once `.mcp.json` is on disk, the user restarts/reconnects Claude Code, the MCP server respawns with the right env, and the subsequent Authenticate + Import steps work.

There is a second, related failure in the same flow. Today, MCP authentication is lazy — it only runs on the first authenticated tool call. When the agent tries to run `project_import` and the user is not yet logged in, the import tool call blocks while a browser window opens for portal login. From the agent's side, the tool call appears to hang or error; the agent does not know that what is actually happening is "waiting for user to finish the browser login flow." Result: the agent gives up or reports a spurious error, even though the user is mid-login in another window.

The fix for that is a new first-class MCP tool whose single job is to authenticate. Call it explicitly from Step 4 (Authenticate) instead of piggybacking on lazy-auth during Step 5 (Import). The agent sees one specific tool that may take time, not an import tool that "mysteriously fails."

## What Changes

- **NEW Step 3 in `formio-application`: MCP Config.** Inserted between Deployment (Step 2) and Authenticate (now Step 4). Writes a `.mcp.json` in the workspace root containing a `formio-mcp` server entry whose `env` block has:
  - `FORMIO_PROJECT_URL` — from Step 2's captured Project URL.
  - `FORMIO_BASE_URL` — from Step 2's captured Base URL (the existing `.mcp.json` precedent uses `FORMIO_BASE_URL` as the env var name for the platform deployment URL; keep that name for consistency with what already ships).

- **Step renumbering.** The old Steps 3, 4, 5 (Authenticate, Import, Framework) become 4, 5, 6. All references in `SKILL.md`, `INTENT.md`, `DEPLOYMENT.md`, `IMPORT.md`, `FRAMEWORK.md`, and the layout test are updated.

- **NEW sibling doc `skills/formio-application/MCP_CONFIG.md`.** Documents:
  - The `.mcp.json` shape this step writes.
  - Collision handling: if `.mcp.json` already exists, merge into the existing file (preserve command/args of any existing `formio-mcp` entry; just update the `env` block). If there is no `formio-mcp` entry, add one with a default command.
  - Default command selection: inside the monorepo (detected by the presence of a `pnpm-workspace.yaml` plus a `@formio/mcp` workspace package), use the existing `pnpm --filter @formio/mcp exec tsx src/stdio.ts` pattern; otherwise fall back to `npx -y @formio/mcp` (placeholder until the package is published — noted as a known limitation).
  - The approval gate: before writing, preview the final merged `.mcp.json` and wait for user approval.
  - The reconnect instruction: after writing, tell the user to restart Claude Code (or run `/mcp` to reconnect the `formio-mcp` server if that is supported in their Claude Code version) so the MCP server respawns with the new env. Pause the flow here; the user resumes by re-invoking the skill or by telling the agent to continue. The skill must not proceed to Authenticate/Import in the same session if the MCP server is still pointing at the old env — authentication will succeed but against the wrong project.

- **Step 4 (Authenticate) updated** to note explicitly that this step only works after Step 3 has been accepted AND the MCP server has been reconnected. If the user tries to skip Step 3, surface a warning. Step 4 now calls the NEW `authenticate` MCP tool explicitly instead of relying on lazy-auth during Step 5.

- **NEW MCP tool: `authenticate`.** Registered in `packages/mcp-server/src/tools/authenticate.ts`, wired into `registerAllTools`. Behavior:
  - Runs `ensureAuthenticated(config)` — reuses the existing auth flow; no new code paths for the login itself.
  - **Idempotent.** If the MCP server already has a valid JWT cached for the project URL, the tool returns immediately with `{ authenticated: true, cached: true, projectUrl, userEmail? }` — no browser window opens.
  - **Surfaces the browser login as a known, named operation.** When no cached token is valid, the tool call visibly "takes time" while the user logs in. The agent knows this is expected for this specific tool, so it does not mistake the delay for an error.
  - **Return shape is minimal and non-sensitive.** `{ authenticated: boolean, cached: boolean, projectUrl: string, userEmail?: string }`. The JWT never leaves the server process. `userEmail` is best-effort — populated from `GET /current` when the JWT is valid, omitted if the platform does not return an email field.
  - **Input shape is empty** (no parameters). The tool reads the configured project URL from the MCP server's `FormioConfig`; the agent does not pass it. Forcing a re-auth (bypass cache) is out of scope for this change — idempotent semantics only. A future `{ force: boolean }` parameter is called out as an Open Question.

- **MODIFIED `formio-application` description** — add a clause that the skill writes `.mcp.json` before touching the MCP server, so the orchestration is deterministic and does not depend on a pre-existing MCP configuration being correct.

## Capabilities

### New Capabilities

<!-- None. The new step lives inside the existing `formio-application-skill` capability. -->

### Modified Capabilities

- `formio-application-skill`: the five-step orchestration becomes a six-step orchestration with an inserted MCP Config step (new Step 3). A new sibling doc `MCP_CONFIG.md` is required. The Deployment step's output (captured URLs) now flows into the MCP Config step's `.mcp.json` write, not directly into the Authenticate step. The skill's description updates to mention the `.mcp.json` write as a discrete, user-visible action.

## Impact

- **Skills library:** `skills/formio-application/` gains `MCP_CONFIG.md`. `SKILL.md` body + description updated for the six-step flow. `INTENT.md`, `DEPLOYMENT.md`, `IMPORT.md`, `FRAMEWORK.md` updated only where they reference step numbers. Step 4's sibling doc (currently a paragraph inside `IMPORT.md`) gets a reference to the new `authenticate` tool.
- **MCP server:** one new tool file — `packages/mcp-server/src/tools/authenticate.ts` — plus one edit to `packages/mcp-server/src/tools/index.ts` to register it. No changes to `ensure-auth.ts`, `auth.ts`, or `config.ts` — the new tool reuses the existing auth flow.
- **Tests:** `packages/mcp-server/src/__tests__/formio-application-layout.test.ts` is extended with assertions for the six-step ordering, the presence of `MCP_CONFIG.md`, the MCP config doc's required topics (`.mcp.json` shape, collision handling, reconnect instructions, approval gate wording, `FORMIO_PROJECT_URL` + `FORMIO_BASE_URL` named explicitly). The existing five-step test is updated to six steps.
- **User-facing behavior:** when a user runs `formio-application` to build a new app, after Deployment captures URLs, they now see a preview of the `.mcp.json` that will be written, approve it, write, get told to restart Claude Code / reconnect, and resume. This adds one explicit gate + one explicit restart to the flow, in exchange for the Import step actually working reliably.
- **Backward-compat:** no shims. The old five-step numbering in any archived change files stays as-is (archived). New main spec reflects six steps.
- **Tests:** new tests for the `authenticate` tool (`packages/mcp-server/src/__tests__/authenticate.test.ts`) covering (a) cached-JWT short-circuit returns `cached: true`, (b) no-token path calls the auth flow and returns `cached: false`, (c) return shape matches spec.
- **Follow-ups (tracked in design Open Questions):** eventually the MCP server should be publishable as `@formio/mcp` on npm so the default command can drop the monorepo-specific `pnpm filter` path. Until then, `MCP_CONFIG.md` documents both monorepo and external-user cases. A `{ force: boolean }` parameter for `authenticate` is deferred; if beta users need a way to refresh stale-but-not-expired tokens mid-session, revisit.
