## Why

The skills under `skills/formio-application/` currently emit MCP-server commands and test instructions that assume `pnpm` is installed on the user's machine. Concrete offenders:

- `skills/formio-application/MCP_CONFIG.md` — the default `.mcp.json` example uses `"command": "pnpm"` with `--filter @formio/mcp exec tsx src/stdio.ts`. The "Default command selection" section presents a "monorepo pnpm-filter" path as one of two defaults. When `formio-application` runs Step 3 for a user who only has npm installed, the written `.mcp.json` fails at the shell level before the MCP server ever starts — `pnpm: command not found`.
- `skills/formio-application/SKILL.md` — the Step 3 summary references "monorepo pnpm-filter vs. placeholder `npx -y @formio/mcp`" as the default-command selection, implicitly telling readers that pnpm is a supported default.
- `skills/formio-application/FRAMEWORK.md` — the "How to add a new framework" recipe ends with `Run pnpm test`, forcing contributors (even external readers who only want to understand the structure) to have pnpm.

Users adopting the Form.io MCP skill library should not need to install a second package manager. `npm` ships with Node; `pnpm` does not. The skills should be npm-only — any command they emit into `.mcp.json`, any instruction they give the user, any example they show should work on a machine where the only package manager installed is `npm`.

(Out of scope: the repository's own `pnpm-workspace.yaml` and turbo-based monorepo tooling. Maintainers of this repo still use pnpm locally; that is a dev-environment concern, not a skill-user concern. This change touches only what the skills emit and instruct.)

## What Changes

- **`skills/formio-application/MCP_CONFIG.md`** — rewrite the default-command selection so the single default is `npx -y @formio/mcp`. Drop the "Monorepo dev (inside this repo)" pnpm-filter branch as a default. For users who have the repo cloned locally and want to point `.mcp.json` at their clone (e.g., to test unreleased changes), document an npm-only alternative (`npx -y tsx <absolute-path>/packages/mcp-server/src/stdio.ts` or `node <absolute-path>/packages/mcp-server/dist/stdio.js` after a local build). No example or recommended default in this document references `pnpm` anywhere.
- **`skills/formio-application/MCP_CONFIG.md`** — update the two `.mcp.json` example blocks (the "shape" block and the "approval preview" block) to use `"command": "npx"` with `"args": ["-y", "@formio/mcp"]`. Keep the `env` block with `FORMIO_PROJECT_URL` and `FORMIO_BASE_URL` unchanged.
- **`skills/formio-application/MCP_CONFIG.md`** — keep the existing "placeholder until published" warning. The warning already correctly notes that `@formio/mcp` is not yet on npm, so the default will fail to spawn until the package publishes. This change does not fix that; it only removes the pnpm escape-hatch that was there before.
- **`skills/formio-application/SKILL.md`** — update the Step 3 summary's "default-command selection" phrasing. Drop the "monorepo pnpm-filter vs. placeholder" framing. Replace with an npm-based default phrasing that matches MCP_CONFIG.md.
- **`skills/formio-application/FRAMEWORK.md`** — change `Run pnpm test` to `Run npm test` in the "How to add a new framework" section. (Contributors are still free to use pnpm locally — the framework registry has no build-step dependency on a specific manager — but the instruction must be runnable on an npm-only machine.)
- **`packages/mcp-server/src/__tests__/formio-application-layout.test.ts`** — update the `documents default-command selection for monorepo vs external` test so it no longer requires `pnpm` to appear in `MCP_CONFIG.md`. The new assertion: the doc MUST contain `npx` AND reference `@formio/mcp` (or the future `@formio/mcp`) AND flag the placeholder nature until the package is published. Rename the test to `documents npm-based default command` to match the new scope.

## Capabilities

### New Capabilities

<!-- None. Scope is documentation + one test assertion. -->

### Modified Capabilities

- `formio-application-skill`: the existing requirement "New sibling doc MCP_CONFIG.md" is narrowed — the default-command selection clause changes from "monorepo path vs. `npx -y @formio/mcp` placeholder for external users" to "a single npm-based default (`npx -y @formio/mcp`), with a documented npm-only escape-hatch for contributors pointing at a local clone."

## Impact

- **Skills library:** three files edited (`MCP_CONFIG.md`, `SKILL.md`, `FRAMEWORK.md`). No new files, no deleted files, no layout changes.
- **MCP server:** no code changes.
- **Tests:** one assertion in `formio-application-layout.test.ts` updated. No new tests added — the existing coverage for `.mcp.json` shape, collision handling, approval gate, etc., still applies unchanged.
- **User-facing behavior:** users running `formio-application` Step 3 on an npm-only machine now receive a `.mcp.json` with a `command` that at least tries to run via npm. When `@formio/mcp` ships to npm, the default JustWorks; in the meantime the placeholder warning is still surfaced so users know the command will fail and why.
- **Backward-compatibility note:** users whose existing `.mcp.json` was previously written with the pnpm-filter default will continue to work if they have pnpm installed. This change does NOT rewrite any already-written `.mcp.json` on anyone's machine; it only changes what the skill WRITES going forward. The merge semantics (preserve existing `command`/`args`) continue to apply, so users who manually chose pnpm keep their choice.
- **Root `.mcp.json` left alone:** the `/Users/...` repo root `.mcp.json` uses pnpm because this repo is a pnpm workspace. That file is a dev-environment artifact for maintainers of the MCP server itself, not an emit of the skills. It stays pnpm-based.
- **Follow-ups (out of scope):** publishing `@formio/mcp` to npm so the default command actually works. Tracked from the earlier `add-mcp-config-step-to-application-skill` change's Open Questions — no change here.
