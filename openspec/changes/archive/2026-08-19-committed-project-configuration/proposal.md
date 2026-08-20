## Why

The working-directory → project mapping lives in `~/.formio/projects.json`, keyed by an absolute path. Both properties make it un-versionable: a clone on another machine, a CI runner, or a teammate's checkout of the same repository starts with nothing mapped, and nothing about which deployment a repository targets is reviewable in a pull request. The only alternative today is `FORMIO_PROJECT_URL` in the environment, which is per-process rather than per-folder and equally invisible to review.

What a team actually wants to express is a property of the code, not of one developer's machine: *this directory targets this project on this deployment.* That belongs in a file next to the code, tracked in git — so a monorepo can point two application folders at two different projects, and a branch that deploys the same application to another environment can carry its own target.

## What Changes

- **A committed configuration file, discovered by walking up from `cwd`.** A `formio.json` holding `projectUrl` and optionally `baseUrl`. Resolution walks from the caller's `cwd` toward the filesystem root and stops at the FIRST file it finds, so the nearest one wins and per-folder targeting comes for free — `apps/web/formio.json` governs `apps/web`, and the repository root's file governs everything else. This is the `.editorconfig` / `tsconfig.json` / `.npmrc` discovery rule, which the ecosystem already teaches.
- **The walk stops at a repository boundary.** It will not ascend past a directory containing `.git`. Without that, a stray `formio.json` in `$HOME` would silently govern every repository under it — the same class of silent wrong-deployment failure the shape-aware base URL work removed.
- **One target per file; environments are expressed by branch.** The file holds a single `projectUrl` / `baseUrl` pair. A branch that deploys the same application to staging commits staging values. No environment selector, no named-environment blocks, no new "which environment am I on" concept.
- **BREAKING — precedence is reordered by scope, narrowest first:** the committed file, then the personal `~/.formio/projects.json` entry, then the environment, then derivation, then an actionable error. Today `FORMIO_PROJECT_URL` from the environment wins over everything and `project_set` cannot redirect it; after this change the environment is the *weakest* source rather than a pin.
- **This makes the two halves of the pair consistent for the first time.** The current spec resolves the project URL environment-first but the base URL mapping-first (`env.FORMIO_BASE_URL` from the matched entry, "otherwise the configured base URL"). The same pair therefore resolves in opposite directions today. Scope-ordering both halves removes that asymmetry rather than adding one.
- **Where the file belongs is part of the design.** `formio.json` is written into the application workspace a developer is building — the folder that app lives in, created by the skills that scaffold it. It is not a file this library's own repository carries, and not something to scatter across unrelated directories: because discovery walks upward, a `formio.json` at the root of a working tree governs every directory beneath it.
- **`project get` reports which layer won**, naming the committed file by path. It already distinguishes environment from mapping; it gains a `committed file` source, and it reports when a lower layer was shadowed so a stale personal mapping is visible rather than merely inert.
- **`project set` gains `--scope`.** `user` (default, today's behavior) writes the personal mapping; `repo` writes or updates the nearest committed `formio.json`, creating it in the `cwd` when none is found. The `project_set` tool takes the same argument, so the tool and the command stay one behavior.

## Capabilities

### New Capabilities

- `committed-project-config`: the `formio.json` file — its shape, its upward discovery rule, its repository boundary, and its relationship to the personal mapping and the environment.

### Modified Capabilities

- `project-map-routing`: the precedence requirement is reordered to committed file → personal mapping → environment → derived → error, applied identically to both URLs; the base-URL source list gains `committed`; the actionable-error requirement covers a committed file that is present but unreadable or holds an unusable URL, which is a distinct answer from "nothing is configured".
- `server-config`: `project get` reports the new sources and names the committed file's path; `project set` gains `--scope`, and the `project_set` tool matches; the stand-alone guidance describes the committed file as the reviewable way to record a target.
- `formio-mcp-setup-skill`: the preflight probe is unchanged in mechanism, but the skills gain the vocabulary to explain WHERE a resolved value came from, and `formio-mcp-setup` offers the `repo` scope when the working directory is inside a git repository.

## Impact

- `packages/mcp-server/src/committed-config.ts` (new) — the file's schema, the upward walk, and the `.git` boundary.
- `packages/mcp-server/src/project-resolver.ts` — the precedence chain and the widened source unions for both URLs.
- `packages/mcp-server/src/cli/project-command.ts` — `--scope`, the new `Source:` wording, and the shadowed-layer report.
- A guard test asserting this repository contains no `formio.json` of its own — one committed here would govern every skill invocation and eval run in the tree.
- `packages/mcp-server/src/tools/project_set.ts` — the `scope` argument and its description.
- `packages/mcp-server/src/server.ts` — the stand-alone `instructions` describe the committed file.
- `packages/mcp-server/src/__tests__/` — resolver, committed-config, project-command, and project_set suites.
- `plugin/skills/*/SKILL.md` — the shared preflight clause names `formio.json` as a possible source of the resolved values; the commands it runs do not change.
- `.gitignore` guidance — `formio.json` is meant to be committed in a consumer's application repository, so nothing ignores it there; the proposal explicitly does NOT move any secret into it (a project URL names infrastructure, not a credential).
- No change to `~/.formio/projects.json`'s format, mode, or merge semantics, and no change to the token cache.
