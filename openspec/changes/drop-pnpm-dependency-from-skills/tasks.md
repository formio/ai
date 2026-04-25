## 1. Rewrite `MCP_CONFIG.md` default command + examples
<!-- depends_on: none -->

### Red

- [ ] 1.1 Update the existing `documents default-command selection for monorepo vs external` test in `packages/mcp-server/src/__tests__/formio-application-layout.test.ts`: rename to `documents npm-based default command and placeholder warning`, DROP the `pnpm` substring assertion, KEEP the assertion that the doc contains `npx` and `@formio/mcp` and the placeholder-warning language. Run it — it should fail against the current `MCP_CONFIG.md` because the current content still leads with the pnpm branch.
- [ ] 1.2 Write failing test: `MCP_CONFIG.md` contains an escape-hatch section that shows an `npx -y tsx <path>/packages/mcp-server/src/stdio.ts` variant AND a `node <path>/packages/mcp-server/dist/stdio.js` variant for local-clone usage. Assert both command shapes appear in the doc.
- [ ] 1.3 Write failing test: the first `.mcp.json` example block inside `MCP_CONFIG.md` (the "shape" block near the top) uses `"command": "npx"` and includes `"-y"` and `"@formio/mcp"` in its `args` array. Assert by substring match within the first fenced `json` block found in the file.
- [ ] 1.4 Write failing test: the approval-preview block (second fenced `json` block in `MCP_CONFIG.md` showing what the user sees before write) also uses `"command": "npx"` and the same args shape. Assert by substring match within that block.
- [ ] 1.5 Write failing test: the Fresh-workspace merge scenario's description in `MCP_CONFIG.md` mentions that the emitted default is npm-based (contains `npx` in proximity to "default").

### Green

- [ ] 1.6 Edit `skills/formio-application/MCP_CONFIG.md` — rewrite the "Default command selection" section. Remove the "Monorepo dev (inside this repo)" bullet that emits `pnpm --filter @formio/mcp exec tsx src/stdio.ts` as a default. Replace the section with a single-default paragraph stating the skill writes `"command": "npx"` with `"args": ["-y", "@formio/mcp"]`. Keep and strengthen the placeholder-warning sentence ("`@formio/mcp` is not yet published to npm — the command will fail to spawn until the package publishes; the approval preview flags this so users can tweak the command before approving").
- [ ] 1.7 Edit `skills/formio-application/MCP_CONFIG.md` — replace the first `.mcp.json` example block (the "shape" block) so its `formio-mcp` entry uses `"command": "npx"` + `"args": ["-y", "@formio/mcp"]`. Keep the env block unchanged.
- [ ] 1.8 Edit `skills/formio-application/MCP_CONFIG.md` — replace the approval-preview example block (the second fenced `json` block) with the same npm-based command shape. Keep the surrounding approval-gate wording identical.
- [ ] 1.9 Edit `skills/formio-application/MCP_CONFIG.md` — add a new subsection titled "Escape-hatch: point at a local clone (npm-only)" that documents the two opt-in variants: (a) `"command": "npx"` + `"args": ["-y", "tsx", "<absolute-path>/packages/mcp-server/src/stdio.ts"]`, (b) `"command": "node"` + `"args": ["<absolute-path>/packages/mcp-server/dist/stdio.js"]` after `cd packages/mcp-server && npm install && npm run build`. Explicitly state both variants are manual/opt-in — the skill does NOT emit them automatically; the user edits `.mcp.json` after the skill's approval gate (or declines and writes their own).

### Refactor

- [ ] 1.10 Review implementation and refactor as needed

## 2. Update `SKILL.md` Step 3 summary
<!-- depends_on: 1 -->

### Red

- [ ] 2.1 Write failing test: `skills/formio-application/SKILL.md` body does NOT contain the phrase `monorepo pnpm-filter` anywhere.
- [ ] 2.2 Write failing test: `skills/formio-application/SKILL.md` body's Step 3 section references the npm-based default (contains `npx` in proximity to "default command" or similar default-command language).

### Green

- [ ] 2.3 Edit `skills/formio-application/SKILL.md` — in the Step 3 section's one-line "See [`MCP_CONFIG.md`](./MCP_CONFIG.md) for the file shape, merge semantics, default-command selection, approval gate, and skip rule" paragraph, rewrite the "default-command selection" sub-phrase. Drop "monorepo pnpm-filter vs. placeholder `npx -y @formio/mcp`". Replace with something like "default-command selection (a single npm-based default, `npx -y @formio/mcp`, with an opt-in escape-hatch for local clones)".

### Refactor

- [ ] 2.4 Review implementation and refactor as needed

## 3. Update `FRAMEWORK.md` contributor instruction
<!-- depends_on: none -->

### Red

- [ ] 3.1 Write failing test: `skills/formio-application/FRAMEWORK.md` does NOT contain the literal substring `pnpm test` (or any other `pnpm <subcommand>` in the "How to add a new framework" section).
- [ ] 3.2 Write failing test: `skills/formio-application/FRAMEWORK.md` contains the literal substring `npm test` in the "How to add a new framework" section.

### Green

- [ ] 3.3 Edit `skills/formio-application/FRAMEWORK.md` — in the "How to add a new framework" numbered recipe, change `Run pnpm test` → `Run npm test`. If any other pnpm references appear in this file, change them to npm equivalents.

### Refactor

- [ ] 3.4 Review implementation and refactor as needed

## 4. Verify end-to-end via Definition of Done
<!-- depends_on: 1, 2, 3 -->

### Red

- [ ] 4.1 Write failing test: a repo-wide sweep of `skills/formio-application/` contains zero occurrences of the literal substring `pnpm` EXCEPT in contexts where pnpm is explicitly named as not-the-default (e.g., a sentence like "Not pnpm" or "pnpm is no longer the default"). If the doc contains `pnpm` in any other context, the test fails. Implementation hint: grep each file in the dir, report any hit that is NOT on a line containing `not` / `no longer` / `NOT` / `not the default` case-insensitive.

### Green

- [ ] 4.2 Run `pnpm test` (maintainer command — fine for maintainer workflow) — all Vitest tests pass, including every assertion added in groups 1–3.
- [ ] 4.3 Run `pnpm lint` — no TypeScript / ESLint errors.
- [ ] 4.4 Run prettier over the touched files — `skills/formio-application/MCP_CONFIG.md`, `SKILL.md`, `FRAMEWORK.md`, and the layout test.
- [ ] 4.5 Spot-check by reading each edited skill file top-to-bottom — any time `pnpm` appears, confirm the surrounding sentence explicitly disavows it (or it lives in an escape-hatch that points at an npm-only variant). No lingering `pnpm` as a recommended command.

### Refactor

- [ ] 4.6 Review implementation and refactor as needed
