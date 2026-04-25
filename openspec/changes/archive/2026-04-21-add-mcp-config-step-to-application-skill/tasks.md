## 1. Author `MCP_CONFIG.md` sibling doc
<!-- depends_on: none -->

### Red

- [x] 1.1 Write failing test: `skills/formio-application/MCP_CONFIG.md` exists and has no YAML frontmatter. Place assertion under `packages/mcp-server/src/__tests__/formio-application-layout.test.ts` (extend the existing file).
- [x] 1.2 Write failing test: `MCP_CONFIG.md` contains the literal substrings `FORMIO_PROJECT_URL` and `FORMIO_BASE_URL`.
- [x] 1.3 Write failing test: `MCP_CONFIG.md` documents the `FORMIO_BASE_URL` ↔ `FORMIO_BASE_URL` naming mapping (orchestrator-state key vs. env-var key).
- [x] 1.4 Write failing test: `MCP_CONFIG.md` documents collision handling — contains language about preserving existing `command` and `args` on merge, preserving unrelated env keys, and preserving unrelated `mcpServers` entries.
- [x] 1.5 Write failing test: `MCP_CONFIG.md` documents the default-command selection rule (pnpm-filter for monorepo detection, `npx -y @formio/mcp` for external users) and explicitly flags the placeholder nature of the external-user default.
- [x] 1.6 Write failing test: `MCP_CONFIG.md` describes the approval-gate wording — preview the merged `.mcp.json`, wait for user approval, write, print restart/reconnect instructions, halt.
- [x] 1.7 Write failing test: `MCP_CONFIG.md` documents the skip rule (existing entry already matches captured URLs).
- [x] 1.8 Write failing test: `MCP_CONFIG.md` mentions both "restart Claude Code" and the `/mcp` reconnect phrase as the two supported resume paths.

### Green

- [x] 1.9 Author `skills/formio-application/MCP_CONFIG.md` covering: (a) the `.mcp.json` shape this step writes, with an example block showing the `formio-mcp` entry, (b) the `FORMIO_BASE_URL` ↔ `FORMIO_BASE_URL` mapping paragraph, (c) the collision-handling algorithm, (d) the default-command selection rule with both monorepo and external-user paths, (e) the approval-gate wording and preview format, (f) the restart/reconnect instructions, (g) the skip rule for already-configured workspaces, (h) a note suggesting `.mcp.json` belongs in `.gitignore` for public repos.

### Refactor

- [x] 1.10 Review implementation and refactor as needed

## 2. Add Step 3 (MCP Config) to `formio-application` SKILL.md
<!-- depends_on: 1 -->

### Red

- [x] 2.1 Write failing test: `skills/formio-application/SKILL.md` body contains section header `Step 3 — MCP Config` (or equivalent) between `Step 2 — Deployment` and the old Authenticate section.
- [x] 2.2 Write failing test: `SKILL.md` body lists SIX steps in order: Step 1 Intent, Step 2 Deployment, Step 3 MCP Config, Step 4 Authenticate, Step 5 Import, Step 6 Framework (update the existing step-order test accordingly).
- [x] 2.3 Write failing test: `SKILL.md` body references `MCP_CONFIG.md` by relative link.
- [x] 2.4 Write failing test: `SKILL.md` frontmatter `description` contains the literal substring `.mcp.json` and mentions the restart pause (e.g., contains `restart` or `reconnect`).
- [x] 2.5 Write failing test: `SKILL.md` body Step 3 section documents that the skill halts after writing so the user can restart — contains the phrase `halt` or `stop` or `pause` together with `restart` or `reconnect`.
- [x] 2.6 Write failing test: `SKILL.md` body documents that Step 3 is skipped on the modify-existing branch.

### Green

- [x] 2.7 Edit `skills/formio-application/SKILL.md` — insert the new `### Step 3 — MCP Config` section between the current Step 2 and Step 3 (Authenticate) section. The new section must: (a) reference `MCP_CONFIG.md`, (b) summarize the approval gate + restart pause, (c) state that the skill halts this invocation after writing, (d) state the skip rule for existing-matching workspaces, (e) state that the modify-existing branch skips this step entirely.
- [x] 2.8 Renumber the remaining steps: old Step 3 → Step 4 (Authenticate), old Step 4 → Step 5 (Import), old Step 5 → Step 6 (Framework). Update the body's opening "The five steps" heading to "The six steps" (or similar). Update the `- **One step at a time, left to right.**` stance bullet to reflect the new order. Update the `Inputs you expect` table and any references to step numbers.
- [x] 2.9 Edit the frontmatter `description` — add a clause naming the `.mcp.json` write and the restart pause. Keep the existing plain-language build-an-app / extend-an-app trigger clauses and the `Not for:` clauses.
- [x] 2.10 Update the "Links" section at the bottom of the SKILL body to include `MCP_CONFIG.md`.

### Refactor

- [x] 2.11 Review implementation and refactor as needed

## 3. Update remaining sibling docs + layout test for six-step ordering
<!-- depends_on: 2 -->

### Red

- [x] 3.1 Update the existing `names the five steps in order via section headers` test in `formio-application-layout.test.ts` to assert six steps (Intent, Deployment, MCP Config, Authenticate, Import, Framework) in order, using the same `^#+\s+Step N` anchor pattern.
- [x] 3.2 Write failing test: `INTENT.md` modify-existing branch text describes skipping Steps 2–5 (was Steps 2–4 before this change).
- [x] 3.3 Write failing test: `DEPLOYMENT.md` references Step 3 (MCP Config) or `MCP_CONFIG.md` as the next step after capture (so a reader knows where the captured URLs flow next).
- [x] 3.4 Write failing test: `IMPORT.md` references Step 5 numbering (formerly Step 4) at least once — or uses framework-agnostic phrasing that does not pin a specific step number.
- [x] 3.5 Write failing test: `FRAMEWORK.md` references Step 6 numbering (formerly Step 5) at least once — or uses framework-agnostic phrasing that does not pin a specific step number.

### Green

- [x] 3.6 Edit `INTENT.md` — update the modify-existing branch description to skip Steps 2–5 (Deployment, MCP Config, Authenticate, Import). Update the build-new branch description to flow through all six steps.
- [x] 3.7 Edit `DEPLOYMENT.md` — at the end of the "What to stash for later steps" section (or equivalent), add one line naming Step 3 (MCP Config) / `MCP_CONFIG.md` as the next consumer of the captured URLs.
- [x] 3.8 Edit `IMPORT.md` and `FRAMEWORK.md` — update any explicit step-number references to the new numbering OR rewrite to use relative phrasing ("this step", "the previous step", "the next step") so future step-renumbering changes do not re-break them.

### Refactor

- [x] 3.9 Review implementation and refactor as needed

## 4. New `authenticate` MCP tool
<!-- depends_on: none -->

### Red

- [x] 4.1 Write failing test: `packages/mcp-server/src/__tests__/authenticate.test.ts` asserts the `authenticate` tool is registered by `registerAllTools` with an empty input schema.
- [x] 4.2 Write failing test: when `config.jwt` is pre-populated (cached-JWT case), calling the tool returns a JSON payload with `authenticated: true, cached: true, projectUrl: <configured>` and no `jwt` field. Mock `ensureAuthenticated` so the test does not try to open a real browser; assert it is still invoked (idempotent check goes through it).
- [x] 4.3 Write failing test: when no JWT is cached, calling the tool invokes `ensureAuthenticated` which sets `config.jwt`; return payload has `authenticated: true, cached: false`.
- [x] 4.4 Write failing test: return payload contains `userEmail` when the `GET /current` call returns a submission with an email field (mock `formioFetch`).
- [x] 4.5 Write failing test: return payload omits `userEmail` when `GET /current` throws; the tool still returns `authenticated: true` and does not error.

### Green

- [x] 4.6 Create `packages/mcp-server/src/tools/authenticate.ts` — `registerAuthenticateTool(server, config)` that: (a) captures `cachedBefore = Boolean(config.jwt)`, (b) `await ensureAuthenticated(config)`, (c) computes `cached = cachedBefore && Boolean(config.jwt)`, (d) best-effort calls a local `tryFetchCurrentUserEmail(config)` helper (same file) that does a `formioFetch('current', ...)` and extracts `data.email` or an equivalent field, swallowing any error, (e) returns a single text content block whose text is the JSON-serialized `{ authenticated, cached, projectUrl, ...(userEmail ? { userEmail } : {}) }` object.
- [x] 4.7 Wire `registerAuthenticateTool` into `packages/mcp-server/src/tools/index.ts` alongside the other `register*Tool` calls.

### Refactor

- [x] 4.8 Review implementation and refactor as needed

## 5. Wire Step 4 of `formio-application` to call the new tool
<!-- depends_on: 2, 4 -->

### Red

- [x] 5.1 Write failing test: `skills/formio-application/SKILL.md` body's Step 4 section contains the literal substring `authenticate` (the tool name) AND references it as a tool to call, not a passive lazy-auth trigger.
- [x] 5.2 Write failing test: `skills/formio-application/IMPORT.md` (or wherever the Step 4 narrative lives) instructs the skill to call the `authenticate` tool explicitly before proceeding to Step 5 and interprets `cached: true` as a silent success.
- [x] 5.3 Write failing test: `IMPORT.md` no longer describes "the first tool call triggers auth" / "lazy-auth" as the Step 4 mechanism — those phrasings must be gone.

### Green

- [x] 5.4 Edit `skills/formio-application/SKILL.md` Step 4 section — describe calling the `authenticate` tool explicitly. State that `cached: true` is a silent success and the skill proceeds immediately; `cached: false` is the "browser login just completed" case and the skill logs a one-sentence acknowledgement before proceeding.
- [x] 5.5 Edit `skills/formio-application/IMPORT.md` Step 4 narrative — replace lazy-auth language with explicit-tool-call language. Keep the headless-environment fallback and the three error branches; they continue to apply to the Step 5 `project_import` call.

### Refactor

- [x] 5.6 Review implementation and refactor as needed

## 6. Verify end-to-end via Definition of Done
<!-- depends_on: 1, 2, 3, 4, 5 -->

### Red

- [x] 6.1 Write failing test: all files under `skills/formio-application/` parse as valid markdown (no YAML frontmatter regression on `MCP_CONFIG.md`, parent `SKILL.md` frontmatter still valid YAML folded scalar).

### Green

- [x] 6.2 Run `pnpm test` — all Vitest tests pass, including the new MCP-config assertions, the new `authenticate` tool tests, and the updated six-step ordering test.
- [x] 6.3 Run `pnpm lint` — no TypeScript / ESLint errors.
- [x] 6.4 Run prettier over the touched files (no root `pnpm format` script — invoke prettier directly on `skills/formio-application`, `packages/mcp-server/src/tools/authenticate.ts`, `packages/mcp-server/src/__tests__/authenticate.test.ts`, and `packages/mcp-server/src/__tests__/formio-application-layout.test.ts`).
- [x] 6.5 Spot-check by reading `skills/formio-application/SKILL.md` top-to-bottom — six-step narrative reads as one coherent document; Step 4 names the `authenticate` tool; no dangling references to "five steps" or to lazy-auth as the Step 4 mechanism.

### Refactor

- [x] 6.6 Review implementation and refactor as needed
