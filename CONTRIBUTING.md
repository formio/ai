# Contributing

Thanks for contributing to `@formio/ai` — the Form.io agentic coding toolset.

## Setup

Requirements: Node.js >= 20, [pnpm](https://pnpm.io) 10 (the repo pins `packageManager: pnpm@10.33.2` — `corepack enable` picks it up automatically).

```sh
git clone https://github.com/formio/ai.git
cd ai
pnpm install
```

## Repository layout

This is a pnpm + Turborepo monorepo shipping three things:

- `packages/mcp-server/` — the `@formio/mcp` Model Context Protocol server (`form_*`, `role_*`, `action_*`, `project_*` tools).
- `plugin/` — the `@formio/ai` Claude Code plugin, bundling the MCP server plus the skill library at `plugin/skills/`.
- `packages/skill-tests/` — structural tests for the skill library, plus executable tests that run the `formio-sdk` skill's doc examples against the real `@formio/js`.

## Definition of Done

Every change must pass all three before it is complete:

```sh
pnpm test     # all Vitest tests
pnpm lint     # type-check, no TypeScript errors
pnpm format   # Prettier
```

CI runs the same checks (plus `pnpm build` and `pnpm format:check`) on every pull request.

TDD is the expected workflow: write a failing test first, then the minimum implementation to make it pass.

## Code conventions

- **TypeScript strict, no `any`** — use `unknown` with type guards, generics, or explicit types.
- **Functional style** — pure functions over mutable classes, `const` over reassignment, side effects at the edges.
- **Single responsibility** — one thing per function/module/tool; extend by adding new modules (the `registerAllTools` registry is the extension point) rather than modifying existing ones.
- **No backward-compatibility shims** unless explicitly required — make breaking changes cleanly.

## Working on skills

Skills live at `plugin/skills/<skill>/SKILL.md` (frontmatter `description` is the routing surface; the body is the playbook). Conventions:

- Descriptions must fit a 1,024-character budget and end with a `Not for:` clause pointing at sibling skills — enforced by `packages/skill-tests/src/skill-descriptions/`.
- Some skills ship an eval harness under `plugin/skills/<skill>/evals/` (see each `evals/README.md` for the run loop). Use it to measure whether a skill change helped or regressed.
- To add a framework implementor (e.g. `formio-react`), add the skill directory and register it as a row in `plugin/skills/formio-application/FRAMEWORK.md` — no orchestrator changes needed.

## Testing the plugin locally

```sh
pnpm build:plugin   # build the plugin bundle into dist/plugin/
pnpm test:plugin    # verify the bundle
```

`examples/` ships copy-paste prompts for exercising the skills library end to end (see `examples/README.md`); the `.claude/skills/` symlinks at the repo root load the live `plugin/skills/` sources, so a fresh Claude Code session here tests uncommitted skill changes directly.

## Versioning and releases

Releases are driven by [changesets](https://github.com/changesets/changesets). If your change affects a published package (`@formio/mcp`, `@formio/ai`), include a changeset:

```sh
pnpm changeset
```

Pick the bump level and describe the change. On merge to `main`, the release workflow opens/updates a "Version Packages" PR; merging that PR publishes to npm.

## Pull requests

- Branch from `main`; keep PRs focused on one change.
- Include the changeset when a published package is affected.
- All CI checks must pass.

## Questions

Open a [GitHub issue](https://github.com/formio/ai/issues) or see [form.io](https://form.io) for product documentation and support.
