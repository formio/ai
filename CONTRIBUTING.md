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
- `plugin/` — the `@formio/ai` agent plugin, bundling the MCP server plus the skill library at `plugin/skills/`. Everything here ships to a consumer's own project, so maintainer tooling belongs outside it.
- `packages/skill-tests/` — structural tests for the skill library, plus executable tests that run the `formio-sdk` skill's doc examples against the real `@formio/js`.

## Generated files

Some agent-facing files in this repository are generated rather than committed:

- **OpenSpec skill mirrors** — `.claude/skills/openspec-*`, `.claude/skills/tdd-*`, `.cursor/skills/`, and `.github/skills/`. They are gitignored, so a fresh clone will not have the `/opsx:*` skills until you regenerate them with the [OpenSpec](https://openspec.dev/) CLI (`npm install -g @fission-ai/openspec@latest`, then run it in the repo root).

  They are excluded deliberately. The `skills` CLI discovers skills additively across a repository's agent directories, and its `-s` flag matches exact names rather than globs — so while those mirrors were committed, anyone running `npx skills add formio/ai` was offered this repository's OpenSpec and TDD workflow skills alongside the Form.io library, with no way to filter them out.

- **`.claude/skills/formio-*`** — these are the exception: committed symlinks into `plugin/skills/`, which is how this repository's own sessions load the library. The `skills` CLI ignores them because it does not follow symlinks while discovering skills.

The OpenSpec **command** mirrors (`.claude/commands/opsx/`, `.cursor/commands/`, `.github/prompts/`) stay committed on purpose: they are what makes `/opsx:*` work on a fresh clone, and the `skills` CLI never looks at them — it discovers `SKILL.md` files only.

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
- Some skills have an eval harness at `packages/skill-tests/evals/<skill>/` (see each harness's `README.md` for the run loop). Use it to measure whether a skill change helped or regressed.
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

Three steps run inside `pnpm changeset:version` — which is what the release workflow invokes to build the Version Packages PR — so that PR carries their output and merging it is the only action needed:

1. `pnpm changeset:follow` adds a patch changeset for `@formio/ai` when the pending release bumps `@formio/mcp` without it. The pins below live in files that ship inside the plugin, so a server-only release would otherwise change plugin content that never republishes, leaving the published plugin launching the previous server. The coupling is one-directional: a plugin-only release leaves the server alone.
2. `pnpm sync:versions` writes `plugin/package.json`'s version into the three client manifests.
3. `pnpm sync:pins` writes `packages/mcp-server/package.json`'s version — already bumped by `changeset version` at this point, so it is the version about to publish — into every launch of the server: the manifests' `npx` args, the install docs, and every skill that prints the command.

Launches are pinned (`npx -y @formio/mcp@<version>`) rather than floating so an install runs the server the release was tested against instead of whatever the registry serves at that moment. Never hand-edit a pin or hand-write the follow-on changeset; the release PR is where both appear. `pnpm sync:pins --check` shows drift without writing, and `plugin-manifests.test.ts`, `plugin-follows-server.test.ts`, and `mcp-setup-project-config.test.ts` fail when either is stale.

CI also runs `pnpm check:releases`, which fails a PR that changes published content without a changeset releasing the owning package. It skips the `changeset-release/*` branch: that PR has already consumed every changeset, so a changeset added there would release the release.

Bumping the CDN assets the portal-login page loads (`packages/mcp-server/src/auth.ts`) means recomputing their Subresource Integrity digests. Do not hand-compute them — run `pnpm sync:sri`, which fetches each pinned URL and writes the digest of the bytes it served; `pnpm sync:sri --check` verifies them, and `login-asset-integrity.test.ts` runs that check whenever the CDN is reachable. A wrong digest passes every shape assertion and then blocks the renderer in the browser, hanging `authenticate` on a blank page.

## Pull requests

- Branch from `main`; keep PRs focused on one change.
- Include the changeset when a published package is affected.
- All CI checks must pass.

## Questions

Open a [GitHub issue](https://github.com/formio/ai/issues) or see [form.io](https://form.io) for product documentation and support.
