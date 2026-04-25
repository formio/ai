## Context

The `formio-application` skill was authored in the `add-mcp-config-step-to-application-skill` change with a dual-default command-selection rule:

- **Monorepo dev** → `"command": "pnpm"`, `"args": ["--filter", "@formio/mcp", "exec", "tsx", "src/stdio.ts"]`
- **External user** → `"command": "npx"`, `"args": ["-y", "@formio/mcp"]`

The monorepo branch existed so that maintainers of this repo, when running the skill against their own workspace, got a working MCP server without waiting for `@formio/mcp` to be published to npm. That use case is real — maintainers do test the skill locally — but the consequence is that the skill writes a pnpm-dependent command into `.mcp.json` on any machine where `pnpm-workspace.yaml` + `@formio/mcp` happen to be detected in an ancestor directory. That detection is fragile (it fires for any user who clones this repo into a parent of their working directory), and it hard-fails on npm-only machines.

`npm` is the baseline: it ships with Node, so assuming it is available is free. `pnpm` requires a separate install. Anything a skill emits or instructs must be runnable with npm alone.

Two follow-on facts:

- `@formio/mcp` is not published to npm yet. `npx -y @formio/mcp` resolves to nothing today. The placeholder warning is already present in `MCP_CONFIG.md` and stays — this change does NOT make the default command work; it makes the default command work once the package publishes, without the pnpm detour.
- The skills already treat the `command`/`args` pair as mergeable — if a user (or a maintainer) has written their own `.mcp.json` with pnpm, the Step 3 merge preserves those values. Nothing breaks for users who deliberately chose pnpm; we only change what the skill writes when it has no prior entry to merge with.

## Goals / Non-Goals

**Goals:**

- The skill, when emitting a `.mcp.json` from scratch, uses a command + args pair that only requires `npm` (via `npx`) to execute.
- The skill's written instructions (`FRAMEWORK.md` "run the tests") work on an npm-only machine.
- Maintainers of this repo still have a documented npm-only path to point `.mcp.json` at a local clone (for pre-publish testing), instead of having to edit the file by hand.
- Tests lock in the npm-only default so a future change cannot silently re-add pnpm to the emitted output.

**Non-Goals:**

- Not publishing `@formio/mcp` to npm. The default command will still fail to spawn until publish; the placeholder warning continues to cover that.
- Not rewriting the repository's root `.mcp.json` or its `pnpm-workspace.yaml` / turbo tooling. Maintainer dev environment stays pnpm-based.
- Not rewriting existing user `.mcp.json` files. Merge semantics already handle the preserve-existing case.
- Not adding an auto-detect-installed-package-manager step. The skill writes one default; users override if they need pnpm.

## Decisions

### Single npm-based default command

```json
{
  "command": "npx",
  "args": ["-y", "@formio/mcp"]
}
```

This becomes the sole default the skill writes when creating a fresh `formio-mcp` entry. The monorepo-detection branch is removed from the selection logic in `MCP_CONFIG.md`.

**Rationale:** npx is universal (ships with npm), the command is the standard shape for "run an npm-published MCP server," and it has no hidden assumption about the user's package manager. Until `@formio/mcp` publishes, the placeholder warning (already in place) tells the user the command will fail and why.

**Alternative considered:** keep the dual default, detect pnpm-workspace.yaml / @formio/mcp in ancestors, and pick pnpm when matched. Rejected for the reason in Context — detection misfires on any user who clones the repo alongside an unrelated workspace, and the benefit (maintainers get a working command on their machine) is easily recovered by the escape-hatch below.

### Escape-hatch: point at a local clone

For maintainers (or pre-publish adopters) who want `.mcp.json` to run the MCP server out of a local clone of this repo WITHOUT pnpm, document two npm-only variants in `MCP_CONFIG.md`:

1. **Run source directly via tsx:**
   ```json
   {
     "command": "npx",
     "args": ["-y", "tsx", "<absolute-path>/packages/mcp-server/src/stdio.ts"]
   }
   ```
2. **Run built output via node** (after `cd packages/mcp-server && npm install && npm run build`):
   ```json
   {
     "command": "node",
     "args": ["<absolute-path>/packages/mcp-server/dist/stdio.js"]
   }
   ```

Both are opt-in. Users who want them edit `.mcp.json` manually or approve an alternative preview. The skill does NOT auto-emit these — the user has to explicitly request the local-clone path.

**Rationale:** keeps the default clean (one command, no detection heuristics) while giving maintainers a documented npm-only option. `tsx` and `node` are both npm-installable on-demand, unlike pnpm which is a separate install.

### `FRAMEWORK.md` uses `npm test`

The recipe step `Run pnpm test` becomes `Run npm test`. Since the root `package.json` defines a `test` script (`turbo run test`), `npm test` routes through the same turbo orchestration pnpm does. The command is equivalent from the contributor's perspective.

**Rationale:** matches the npm-only stance of the rest of the change. Contributors who happen to use pnpm are free to keep typing `pnpm test`; the instruction just names the lowest-common-denominator command.

**Alternative considered:** write the instruction framework-agnostically ("run the test suite"). Rejected — contributors benefit from the concrete command; naming one default is clearer.

### Test assertion renamed and narrowed

The existing test `documents default-command selection for monorepo vs external` in `formio-application-layout.test.ts` asserts that `MCP_CONFIG.md` contains both `pnpm` and (npx | @formio/mcp). The new test asserts only the npm side:

- `MCP_CONFIG.md` MUST contain `npx` and reference `@formio/mcp`.
- `MCP_CONFIG.md` MUST continue to flag the placeholder status until publish.
- `MCP_CONFIG.md` MUST NOT mention `pnpm` as a supported DEFAULT (the word may appear elsewhere in context — e.g., a one-line aside explaining why the default is npx — but not in a recommended command).

The test renames to `documents npm-based default command and placeholder warning` for clarity.

**Rationale:** the test's job is to lock in the new stance. Allowing `pnpm` to appear anywhere in the doc would let a future contributor silently re-add the pnpm default. An explicit not-contain assertion is too strict (the doc may legitimately explain why pnpm was removed), so the assertion instead checks that pnpm is not presented as a COMMAND. Simplest form: require npx and the placeholder warning; drop the pnpm requirement entirely.

## Risks / Trade-offs

- **Default command still does not work today** → `@formio/mcp` is unpublished. Users who approve the default `.mcp.json` and restart Claude Code will hit `npm ERR! 404 Not Found - @formio/mcp`. Mitigation: the placeholder warning in the approval preview is loud and clear; users see it before approving. The fix is publishing the package, tracked elsewhere.
- **Maintainer friction** → maintainers who previously got a working pnpm-based command for free now have to edit `.mcp.json` by hand to point at their local clone. Mitigation: the escape-hatch paragraph in `MCP_CONFIG.md` spells out the two npm-only variants. Copy-paste cost is one block.
- **`npm test` routing through turbo on a fresh clone** → a contributor who runs `npm test` on a freshly cloned repo without `node_modules` will get "sh: turbo: command not found". Mitigation: the root package.json requires `npm install` first; this is a standard Node-repo expectation, not a skill-specific concern. Not fixed in this change.
- **Root `.mcp.json` drift** → the root `.mcp.json` stays pnpm-based while the skill's default becomes npm-based. A contributor reading the root file might assume that shape is the canonical default. Mitigation: `MCP_CONFIG.md` is clear that the root file is a maintainer dev artifact, not the skill's emit. Optionally, a later change can add a comment to the root `.mcp.json` explaining the divergence; out of scope here.

## Migration Plan

1. Edit `skills/formio-application/MCP_CONFIG.md` — remove monorepo pnpm branch from default-command selection; update both `.mcp.json` example blocks to use `npx` command + `-y @formio/mcp` args; add the escape-hatch paragraph documenting the two npm-only local-clone variants.
2. Edit `skills/formio-application/SKILL.md` — update the Step 3 summary's default-command selection phrasing; drop the "monorepo pnpm-filter vs. placeholder" mention.
3. Edit `skills/formio-application/FRAMEWORK.md` — change `Run pnpm test` → `Run npm test`.
4. Edit `packages/mcp-server/src/__tests__/formio-application-layout.test.ts` — rename the test, remove the `pnpm` substring assertion, keep the npx + placeholder assertions.
5. Run `pnpm test && pnpm lint` (maintainer workflow — fine for maintainers to keep using pnpm locally).
6. Update the live spec at `openspec/specs/formio-application-skill/spec.md` as part of archive.

Rollback: revert the PR. No runtime state.

## Open Questions

- **Root `.mcp.json` rewrite?** Stays pnpm-based today because maintainers run against their local workspace. If the `@formio/mcp` package publishes, revisit whether to flip the root to npx too so "it works the same as what we ship." Tracked as a follow-up.
- **Auto-comment the root `.mcp.json`?** Could add a leading `// ...` explaining the pnpm-vs-skill-default divergence, but JSON doesn't support comments. `JSON-with-comments` parsers sometimes accept them; Claude Code may or may not. Not attempted here.
- **Detect installed package manager at skill-execution time?** E.g., if `pnpm` is on PATH, optionally offer it. Rejected for scope — keeps the skill deterministic and avoids shell-probing from the skill layer.
